import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { prepareNativeTransport, verifyNativeTransport } from "./native-artifact-transport.mjs";

const commit = "a".repeat(40);
const tag = "v1.20.0";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const sites = ["cofoundry.jacobdanderson.net", "agroindustriatorca.com", "scheduler.classes.jacobdanderson.net"];

async function fixture(context, site = sites[2]) {
	const base = path.resolve(".ai-work/runs/native-transport-tests");
	await fs.mkdir(base, { recursive: true });
	const root = await fs.mkdtemp(path.join(base, "case-"));
	context.after(() => fs.rm(root, { recursive: true }));
	const runtimeRoot = path.join(root, "runtime");
	await fs.mkdir(runtimeRoot, { mode: 0o755 });
	await fs.mkdir(path.join(runtimeRoot, "empty"), { mode: 0o755 });
	const profile = {
		schema_version: 1,
		site,
		repository: `anderson-webops/${site}`,
		builder_id: "jacob-m3",
		runtime: {
			os: "linux", architecture: "arm64", libc: "glibc",
			node: site === sites[0] ? "26.13.1" : site === sites[2] ? "24.22.1" : "24.18.1",
			npm: site === sites[0] ? "12.2.2" : "12.0.2",
			package_manager: site === sites[0] ? "npm@12.2.2" : "npm@12.0.2"
		},
		environment: {}
	};
	const contract = { version: 1, application: site, required: ["package.json", "entry.mjs"], allowedFiles: ["package.json", "entry.mjs"], allowedRoots: ["empty"], nativeBindings: [], runtime: { os: "linux", arch: "arm64", node: profile.runtime.node, npmBuildOnly: profile.runtime.npm } };
	const contractBytes = Buffer.from(`${JSON.stringify(contract)}\n`);
	const files = {};
	for (const [name, content] of [["package.json", JSON.stringify({ version: tag.slice(1) })], ["entry.mjs", "throw Error('fixture entrypoint must never execute');\n"]]) {
		const bytes = Buffer.from(content);
		await fs.writeFile(path.join(runtimeRoot, name), bytes, { mode: 0o644 });
		files[name] = { size: bytes.length, sha256: hash(bytes), mode: "0644" };
	}
	const embedded = { format: 1, application: site, commit, sourceTree: "b".repeat(40), contractVersion: 1, contractSha256: hash(contractBytes), files };
	await fs.writeFile(path.join(runtimeRoot, "runtime-manifest.json"), `${JSON.stringify(embedded)}\n`, { mode: 0o644 });
	const receipt = { commit, tag, checks: { tests: true, dependency_audit: true, package_signatures: true, native_bindings: true } };
	return { root, runtimeRoot, outputDir: path.join(root, "assets"), profile, contractBytes, commit, tag, receipt };
}

async function signFixture(input) {
	const pair = crypto.generateKeyPairSync("ed25519");
	const manifestBytes = await fs.readFile(path.join(input.outputDir, "anderson-runtime-manifest.json"));
	const signature = crypto.sign(null, manifestBytes, pair.privateKey);
	assert.equal(signature.length, 64);
	await fs.writeFile(path.join(input.outputDir, "anderson-runtime-manifest.sig"), signature);
	const names = (await fs.readdir(input.outputDir)).sort();
	const lines = [];
	for (const name of names) lines.push(`${hash(await fs.readFile(path.join(input.outputDir, name)))}  ${name}`);
	await fs.writeFile(path.join(input.outputDir, "SHA256SUMS"), `${lines.join("\n")}\n`);
	return pair.publicKey.export({ type: "spki", format: "pem" });
}

for (const site of sites) {
	test(`native transport round trip: ${site}`, async (context) => {
		const input = await fixture(context, site);
		const manifest = await prepareNativeTransport(input);
		assert.deepEqual(await verifyNativeTransport(input), manifest);
		assert.equal(manifest.archive.name, `${site}-${tag}-linux-arm64-runtime.tar.gz`);
		assert.ok(manifest.files.some(record => record.type === "directory" && record.path === "runtime/empty"));
		const publicKey = await signFixture(input);
		assert.deepEqual(await verifyNativeTransport({ ...input, publicKey }), manifest);
		assert.equal((await fs.readdir(input.outputDir)).length, 6);
	});
}

test("CoFoundry rejects legacy and mixed toolchains without changing peer profiles", async (context) => {
	for (const runtime of [
		{ node: "24.18.1", npm: "12.0.2", package_manager: "npm@12.0.2" },
		{ node: "26.13.1", npm: "12.0.2", package_manager: "npm@12.0.2" },
		{ node: "26.13.1", npm: "12.2.2", package_manager: "npm@12.0.2" }
	]) {
		const input = await fixture(context, sites[0]);
		Object.assign(input.profile.runtime, runtime);
		await assert.rejects(prepareNativeTransport(input), /profile/);
	}
	for (const site of sites.slice(1)) {
		const input = await fixture(context, site);
		Object.assign(input.profile.runtime, { node: "26.13.1", npm: "12.2.2", package_manager: "npm@12.2.2" });
		await assert.rejects(prepareNativeTransport(input), /profile/);
	}
});

test("receipt requires exact identity and all four true checks", async (context) => {
	for (const mutate of [
		(value) => { value.checks.tests = false; },
		(value) => { value.tag = "v1.19.0"; },
		(value) => { value.commit = "c".repeat(40); },
		(value) => { value.extra = true; }
	]) {
		const input = await fixture(context);
		mutate(input.receipt);
		await assert.rejects(prepareNativeTransport(input), /acceptance receipt/);
	}
});

test("comma-joined property names cannot impersonate separate acceptance checks", async (context) => {
	const input = await fixture(context);
	input.receipt.checks = { "tests": true, "dependency_audit": true, "native_bindings,package_signatures": true };
	await assert.rejects(prepareNativeTransport(input), /acceptance receipt/);
});

test("wrong native contract and application identity fail closed", async (context) => {
	const input = await fixture(context);
	input.contractBytes = Buffer.from(input.contractBytes.toString().replace("\"version\":1", "\"version\":2"));
	await assert.rejects(prepareNativeTransport(input), /contract differs/);
	const changed = await fixture(context);
	changed.profile.site = "unrelated.example.com";
	await assert.rejects(prepareNativeTransport(changed), /profile/);
});

test("private public-configuration additions are rejected", async (context) => {
	const input = await fixture(context);
	input.profile.environment.DATABASE_URL = "fixture-only";
	await assert.rejects(prepareNativeTransport(input), /profile/);
});

test("unlisted files and unreadable native modes are rejected", async (context) => {
	const unlisted = await fixture(context);
	await fs.writeFile(path.join(unlisted.runtimeRoot, "extra.mjs"), "fixture", { mode: 0o644 });
	await assert.rejects(prepareNativeTransport(unlisted), /absent from/);
	const unreadable = await fixture(context);
	await fs.chmod(path.join(unreadable.runtimeRoot, "entry.mjs"), 0o600);
	await assert.rejects(prepareNativeTransport(unreadable), /unexpected modes/);
});

test("hardlinks and symlinks never become native payload members", async (context) => {
	const linked = await fixture(context);
	await fs.link(path.join(linked.runtimeRoot, "entry.mjs"), path.join(linked.root, "hardlink"));
	await assert.rejects(prepareNativeTransport(linked), /links/);
	const symbolic = await fixture(context);
	await fs.symlink("../outside", path.join(symbolic.runtimeRoot, "link"));
	await assert.rejects(prepareNativeTransport(symbolic), /links/);
});

test("missing independent native paths are rejected", async (context) => {
	const input = await fixture(context);
	const contract = JSON.parse(input.contractBytes);
	contract.required.push("required.mjs");
	input.contractBytes = Buffer.from(`${JSON.stringify(contract)}\n`);
	const file = path.join(input.runtimeRoot, "runtime-manifest.json");
	const embedded = JSON.parse(await fs.readFile(file, "utf8"));
	embedded.contractSha256 = hash(input.contractBytes);
	await fs.writeFile(file, JSON.stringify(embedded));
	await assert.rejects(prepareNativeTransport(input), /independent required path/);
});

test("archive corruption and unexpected assets are rejected", async (context) => {
	const input = await fixture(context);
	const manifest = await prepareNativeTransport(input);
	await fs.appendFile(path.join(input.outputDir, manifest.archive.name), "corruption");
	await assert.rejects(verifyNativeTransport(input), /archive digest differs/);
	const extra = await fixture(context);
	await prepareNativeTransport(extra);
	await fs.writeFile(path.join(extra.outputDir, "unrelated.txt"), "fixture");
	await assert.rejects(verifyNativeTransport(extra), /unexpected release assets/);
});

test("signature binds exact manifest whitespace and trailing newline", async (context) => {
	const input = await fixture(context);
	await prepareNativeTransport(input);
	const publicKey = await signFixture(input);
	await fs.appendFile(path.join(input.outputDir, "anderson-runtime-manifest.json"), " ");
	await assert.rejects(verifyNativeTransport({ ...input, publicKey }), /signature failed/);
});

test("wrong keys, truncated signatures and altered checksums fail", async (context) => {
	const input = await fixture(context);
	await prepareNativeTransport(input);
	const publicKey = await signFixture(input);
	const wrongKey = crypto.generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" });
	await assert.rejects(verifyNativeTransport({ ...input, publicKey: wrongKey }), /signature failed/);
	await fs.appendFile(path.join(input.outputDir, "SHA256SUMS"), "unexpected\n");
	await assert.rejects(verifyNativeTransport({ ...input, publicKey }), /checksums differ/);
	await fs.writeFile(path.join(input.outputDir, "anderson-runtime-manifest.sig"), Buffer.alloc(63));
	await assert.rejects(verifyNativeTransport({ ...input, publicKey }), /signature failed/);
});

test("replaced manifest symlink and path-traversing members are rejected", async (context) => {
	const input = await fixture(context);
	await prepareNativeTransport(input);
	const manifestPath = path.join(input.outputDir, "anderson-runtime-manifest.json");
	const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
	manifest.files[0].path = "runtime/../escape";
	await fs.writeFile(manifestPath, JSON.stringify(manifest));
	await assert.rejects(verifyNativeTransport(input), /Unsafe/);
	await fs.rename(manifestPath, path.join(input.root, "manifest.json"));
	await fs.symlink(path.join(input.root, "manifest.json"), manifestPath);
	await assert.rejects(verifyNativeTransport(input));
});

test("repository transport codec has no signing or process-execution authority", async () => {
	const source = await fs.readFile(new URL("./native-artifact-transport.mjs", import.meta.url), "utf8");
	assert.doesNotMatch(source, /createPrivateKey|crypto\.sign\(|private-key\.pem|node:child_process|execFile|spawn\(/);
});

test("native package version must match its release tag", async (context) => {
	const input = await fixture(context);
	const bytes = Buffer.from(JSON.stringify({ version: "1.19.0" }));
	await fs.writeFile(path.join(input.runtimeRoot, "package.json"), bytes);
	const file = path.join(input.runtimeRoot, "runtime-manifest.json");
	const embedded = JSON.parse(await fs.readFile(file, "utf8"));
	embedded.files["package.json"] = { size: bytes.length, sha256: hash(bytes), mode: "0644" };
	await fs.writeFile(file, JSON.stringify(embedded));
	await assert.rejects(prepareNativeTransport(input), /version differs/);
});

test("empty private scratch directories are not part of the native contract", async (context) => {
	const input = await fixture(context);
	await fs.mkdir(path.join(input.runtimeRoot, ".ai-work"), { mode: 0o755 });
	await assert.rejects(prepareNativeTransport(input), /Unlisted native payload directory/);
});

test("native binding bytes require the declared Linux ARM64 architecture", async (context) => {
	for (const architecture of [183, 62]) {
		const input = await fixture(context);
		const bytes = Buffer.alloc(20);
		bytes.write("\x7FELF", 0, "binary");
		bytes[4] = 2;
		bytes[5] = 1;
		bytes.writeUInt16LE(architecture, 18);
		await fs.writeFile(path.join(input.runtimeRoot, "binding.node"), bytes, { mode: 0o644 });
		const contract = JSON.parse(input.contractBytes);
		contract.allowedFiles.push("binding.node");
		contract.nativeBindings.push("binding.node");
		input.contractBytes = Buffer.from(`${JSON.stringify(contract)}\n`);
		const file = path.join(input.runtimeRoot, "runtime-manifest.json");
		const embedded = JSON.parse(await fs.readFile(file, "utf8"));
		embedded.contractSha256 = hash(input.contractBytes);
		embedded.files["binding.node"] = { size: bytes.length, sha256: hash(bytes), mode: "0644" };
		await fs.writeFile(file, JSON.stringify(embedded));
		if (architecture === 183) await prepareNativeTransport(input);
		else await assert.rejects(prepareNativeTransport(input), /not Linux ARM64/);
	}
});
