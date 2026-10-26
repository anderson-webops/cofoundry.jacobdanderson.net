import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream, constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip, createGzip } from "node:zlib";

const maxArchiveBytes = 1024 * 1024 * 1024;
const maxManifestBytes = 8 * 1024 * 1024;
const maxEntries = 100_000;
const nativeFileName = /(?:\.node|\.so(?:\.\d+)*)$/;

function sha256(bytes) {
	return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function digestFile(filePath) {
	const file = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		const metadata = await file.stat();
		if (!metadata.isFile() || metadata.nlink !== 1) {
			throw new Error("Transport input must be a single regular file.");
		}
		const hash = crypto.createHash("sha256");
		for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk);
		return { sha256: hash.digest("hex"), size: metadata.size };
	}
	finally {
		await file.close();
	}
}

function isWithin(root, candidate) {
	const relative = path.relative(root, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function canonicalJson(value) {
	if (Array.isArray(value)) return value.map(canonicalJson);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map(key => [key, canonicalJson(value[key])]),
		);
	}
	return value;
}

function hasControlCharacters(value) {
	for (const character of value) {
		const codePoint = character.codePointAt(0);
		if (codePoint < 32 || codePoint === 127) return true;
	}
	return false;
}

export function createUstarHeader(record) {
	const header = Buffer.alloc(512);
	const memberName = Buffer.from(record.path);
	let basename = memberName;
	let prefix = Buffer.alloc(0);
	if (memberName.length > 100) {
		for (let index = memberName.length - 1; index > 0; index -= 1) {
			if (memberName[index] !== 47) continue;
			const candidatePrefix = memberName.subarray(0, index);
			const candidateName = memberName.subarray(index + 1);
			if (candidatePrefix.length <= 155 && candidateName.length <= 100) {
				prefix = candidatePrefix;
				basename = candidateName;
				break;
			}
		}
	}
	if (
		basename.length > 100
		|| prefix.length > 155
		|| !/^[\x20-\x7E]+$/.test(record.path)
		|| record.path.includes("\\")
	) {
		throw new Error(`Transport path cannot fit in portable USTAR: ${record.path}`);
	}

	const octal = (offset, width, value) => {
		const digits = value.toString(8).padStart(width - 1, "0");
		if (digits.length !== width - 1) throw new Error("Transport metadata exceeds USTAR limits.");
		header.write(`${digits}\0`, offset, width, "ascii");
	};
	basename.copy(header, 0);
	prefix.copy(header, 345);
	octal(100, 8, record.mode);
	octal(108, 8, 0);
	octal(116, 8, 0);
	octal(124, 12, record.type === "file" ? record.size : 0);
	octal(136, 12, 0);
	header.fill(32, 148, 156);
	header.write(record.type === "directory" ? "5" : record.type === "symlink" ? "2" : "0", 156);
	if (record.type === "symlink") {
		const target = Buffer.from(record.target);
		if (target.length > 100) {
			throw new Error(`Transport link target exceeds USTAR limits: ${record.path}`);
		}
		target.copy(header, 157);
	}
	header.write("ustar\0", 257, 6, "ascii");
	header.write("00", 263, 2, "ascii");
	const checksum = header.reduce((total, byte) => total + byte, 0);
	header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
	return header;
}

async function readNativeIdentity(filePath, relativePath) {
	const file = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		const bytes = Buffer.alloc(20);
		const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
		if (
			bytesRead !== bytes.length
			|| bytes.toString("binary", 0, 4) !== "\x7FELF"
			|| bytes[4] !== 2
			|| bytes[5] !== 1
			|| bytes.readUInt16LE(18) !== 183
		) {
			throw new Error(`A native binding is not Linux ARM64 ELF64 little-endian: ${relativePath}`);
		}
	}
	finally {
		await file.close();
	}
}

async function* archiveBlocks(root, records) {
	for (const record of records) {
		yield createUstarHeader(record);
		if (record.type !== "file") continue;
		const relative = record.path.slice("runtime/".length);
		const fullPath = path.join(root, relative);
		const metadata = await fs.lstat(fullPath);
		const file = await fs.open(fullPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
		try {
			const opened = await file.stat();
			if (
				opened.dev !== metadata.dev
				|| opened.ino !== metadata.ino
				|| opened.size !== record.size
			) {
				throw new Error(`Transport source changed during archive creation: ${relative}`);
			}
			const hash = crypto.createHash("sha256");
			const buffer = Buffer.alloc(64 * 1024);
			let remaining = record.size;
			while (remaining > 0) {
				const { bytesRead } = await file.read(buffer, 0, Math.min(buffer.length, remaining), null);
				if (bytesRead === 0) throw new Error(`Transport source truncated: ${relative}`);
				const chunk = Buffer.from(buffer.subarray(0, bytesRead));
				hash.update(chunk);
				yield chunk;
				remaining -= bytesRead;
			}
			if (hash.digest("hex") !== record.sha256 || (await file.stat()).size !== record.size) {
				throw new Error(`Transport source changed while archived: ${relative}`);
			}
		}
		finally {
			await file.close();
		}
		const padding = (512 - (record.size % 512)) % 512;
		if (padding) yield Buffer.alloc(padding);
	}
	yield Buffer.alloc(1024);
}

export async function writeTransportArchive(
	root,
	records,
	archivePath,
	maxBytes = maxArchiveBytes,
) {
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > maxArchiveBytes) {
		throw new Error("Invalid transport archive limit.");
	}
	let written = 0;
	const output = createWriteStream(archivePath, { flags: "wx", mode: 0o600 });
	await once(output, "open");
	try {
		await pipeline(
			Readable.from(archiveBlocks(root, records)),
			createGzip({ level: 9, mtime: 0 }),
			new Transform({
				transform(chunk, _encoding, callback) {
					written += chunk.length;
					callback(
						written > maxBytes ? new Error("Transport archive exceeds the reviewed limit.") : null,
						chunk,
					);
				},
			}),
			output,
		);
		return await digestFile(archivePath);
	}
	catch (error) {
		await fs.rm(archivePath, { force: true });
		throw error;
	}
}

function parseOctal(bytes) {
	const text = bytes.toString("ascii").replace(/\0+$/, "");
	if (!/^[0-7]+$/.test(text)) throw new Error("Transport USTAR metadata is invalid.");
	return Number.parseInt(text, 8);
}

function parseUstarHeader(header) {
	const checksumBytes = Buffer.from(header);
	checksumBytes.fill(32, 148, 156);
	const checksum = checksumBytes.reduce((total, byte) => total + byte, 0);
	const basename = header.toString("utf8", 0, 100).split("\0")[0];
	const prefix = header.toString("utf8", 345, 500).split("\0")[0];
	const type = { 0: "file", 5: "directory", 2: "symlink" }[header.toString("ascii", 156, 157)];
	if (
		header.toString("ascii", 257, 263) !== "ustar\0"
		|| header.toString("ascii", 263, 265) !== "00"
		|| parseOctal(header.subarray(148, 155)) !== checksum
		|| parseOctal(header.subarray(108, 116)) !== 0
		|| parseOctal(header.subarray(116, 124)) !== 0
		|| parseOctal(header.subarray(136, 148)) !== 0
		|| !type
	) {
		throw new Error("Transport contains an unsupported or corrupted USTAR header.");
	}
	return {
		path: prefix ? `${prefix}/${basename}` : basename,
		type,
		mode: parseOctal(header.subarray(100, 108)),
		size: parseOctal(header.subarray(124, 136)),
		...(type === "symlink" ? { target: header.toString("utf8", 157, 257).split("\0")[0] } : {}),
	};
}

export async function verifyTransportArchive(archivePath, records) {
	if (!Array.isArray(records) || records.length === 0 || records.length > maxEntries) {
		throw new Error("The transport inventory is empty or exceeds its entry limit.");
	}
	const archiveMetadata = await fs.lstat(archivePath);
	if (
		!archiveMetadata.isFile()
		|| archiveMetadata.nlink !== 1
		|| archiveMetadata.size > maxArchiveBytes
	) {
		throw new Error("Transport archive is not a bounded regular file.");
	}
	const source = createReadStream(archivePath);
	const stream = source.pipe(createGunzip());
	const iterator = stream[Symbol.asyncIterator]();
	let pending = Buffer.alloc(0);
	let expandedBytes = 0;
	const readExact = async (length) => {
		const pieces = [];
		let received = 0;
		while (received < length) {
			if (pending.length === 0) {
				const next = await iterator.next();
				if (next.done) throw new Error("The transport archive was truncated.");
				pending = next.value;
			}
			const count = Math.min(length - received, pending.length);
			pieces.push(pending.subarray(0, count));
			pending = pending.subarray(count);
			received += count;
		}
		return Buffer.concat(pieces, length);
	};
	let embeddedManifestBytes;
	let embeddedPackageBytes;
	const seen = new Set();

	try {
		for (const expected of records) {
			if (
				typeof expected.path !== "string"
				|| !expected.path.startsWith("runtime/")
				|| expected.path === "runtime/"
				|| expected.path.includes("\\")
				|| path.posix.normalize(expected.path) !== expected.path
				|| seen.has(expected.path)
			) {
				throw new Error("Unsafe or repeated transport inventory path.");
			}
			seen.add(expected.path);
			const header = await readExact(512);
			if (!header.equals(createUstarHeader(expected))) {
				throw new Error(`Transport archive header is not canonical: ${expected.path}`);
			}
			const actual = parseUstarHeader(header);
			if (
				actual.path !== expected.path
				|| actual.type !== expected.type
				|| actual.mode !== expected.mode
				|| actual.size !== (expected.type === "file" ? expected.size : 0)
				|| (expected.type === "symlink" && actual.target !== expected.target)
			) {
				throw new Error(`Transport archive member differs from its manifest: ${expected.path}`);
			}
			if (expected.type === "symlink") {
				const resolved = path.posix.resolve(path.posix.dirname(`/${expected.path}`), expected.target);
				if (path.posix.isAbsolute(expected.target) || !isWithin("/runtime", resolved)) {
					throw new Error("Transport symlink escapes its runtime.");
				}
			}
			if (expected.type !== "file") continue;
			if (
				!Number.isSafeInteger(expected.size)
				|| expected.size < 0
				|| expandedBytes + expected.size > maxArchiveBytes
			) {
				throw new Error("Transport expanded payload exceeds the reviewed limit.");
			}
			expandedBytes += expected.size;
			const hash = crypto.createHash("sha256");
			let remaining = expected.size;
			const nativeHead = Buffer.alloc(20);
			let nativeBytes = 0;
			const manifestChunks = [];
			if (expected.path === "runtime/runtime-manifest.json" && expected.size > 64 * 1024 * 1024) {
				throw new Error("Embedded runtime manifest exceeds its limit.");
			}
			if (expected.path === "runtime/package.json" && expected.size > 64 * 1024) {
				throw new Error("Embedded package metadata exceeds its limit.");
			}
			while (remaining > 0) {
				const chunk = await readExact(Math.min(remaining, 64 * 1024));
				hash.update(chunk);
				if (nativeFileName.test(expected.path) && nativeBytes < nativeHead.length) {
					const count = Math.min(chunk.length, nativeHead.length - nativeBytes);
					chunk.copy(nativeHead, nativeBytes, 0, count);
					nativeBytes += count;
				}
				if (expected.path === "runtime/runtime-manifest.json" || expected.path === "runtime/package.json") manifestChunks.push(chunk);
				remaining -= chunk.length;
			}
			if (hash.digest("hex") !== expected.sha256) {
				throw new Error(`Transport archive file hash differs: ${expected.path}`);
			}
			if (
				nativeFileName.test(expected.path)
				&& (nativeBytes !== 20
					|| nativeHead.toString("binary", 0, 4) !== "\x7FELF"
					|| nativeHead[4] !== 2
					|| nativeHead[5] !== 1
					|| nativeHead.readUInt16LE(18) !== 183)
			) {
				throw new Error(
					`Transport native binding is not Linux ARM64 ELF64 little-endian: ${expected.path}`,
				);
			}
			if (manifestChunks.length && expected.path === "runtime/runtime-manifest.json") embeddedManifestBytes = Buffer.concat(manifestChunks);
			if (manifestChunks.length && expected.path === "runtime/package.json") embeddedPackageBytes = Buffer.concat(manifestChunks);
			const padding = (512 - (expected.size % 512)) % 512;
			if (padding && !(await readExact(padding)).equals(Buffer.alloc(padding))) {
				throw new Error("Transport archive has nonzero file padding.");
			}
		}
		if (!(await readExact(1024)).equals(Buffer.alloc(1024)) || pending.length) {
			throw new Error("Transport archive has an invalid end marker.");
		}
		if (!(await iterator.next()).done) throw new Error("Transport archive has unlisted members.");
		if (!embeddedManifestBytes) throw new Error("Transport archive lacks its runtime manifest.");
		if (!embeddedPackageBytes) throw new Error("Transport archive lacks package metadata.");
		return { manifest: JSON.parse(embeddedManifestBytes.toString()), package: JSON.parse(embeddedPackageBytes.toString()) };
	}
	finally {
		stream.destroy();
		source.destroy();
	}
}

function exactKeys(value, names) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
	const actual = Object.keys(value).sort();
	const expected = [...names].sort();
	return actual.length === expected.length && actual.every((name, index) => name === expected[index]);
}

async function readRegular(filePath, limit = maxManifestBytes) {
	const file = await fs.open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
	try {
		const metadata = await file.stat();
		if (!metadata.isFile() || metadata.nlink !== 1 || metadata.size > limit) {
			throw new Error("Expected a bounded, single regular transport input.");
		}
		const bytes = await file.readFile();
		if (bytes.length !== metadata.size) throw new Error("Transport input changed while read.");
		return bytes;
	}
	finally {
		await file.close();
	}
}

function safeRelative(name) {
	return typeof name === "string" && !hasControlCharacters(name) && /^[\x20-\x7E]+$/.test(name)
		&& !name.includes("\\") && !name.startsWith("/")
		&& name.split("/").every(part => part && part !== "." && part !== "..");
}

function allowedRuntimePath(name, contract) {
	return contract.allowedFiles.includes(name)
		|| contract.allowedRoots.some(root => name === root || name.startsWith(`${root}/`));
}

function assertProfile(profile) {
	if (!exactKeys(profile, ["schema_version", "site", "repository", "builder_id", "runtime", "environment"])
		|| profile.schema_version !== 1 || profile.builder_id !== "jacob-m3"
		|| !/^[a-z0-9][a-z0-9.-]{2,100}$/.test(profile.site)
		|| profile.repository.toLowerCase() !== `anderson-webops/${profile.site}`
		|| !exactKeys(profile.runtime, ["os", "architecture", "libc", "node", "npm", "package_manager"])
		|| profile.runtime.os !== "linux" || profile.runtime.architecture !== "arm64"
		|| profile.runtime.libc !== "glibc" || !["24.18.1", "24.22.1"].includes(profile.runtime.node)
		|| profile.runtime.npm !== "12.0.2" || profile.runtime.package_manager !== "npm@12.0.2"
		|| !exactKeys(profile.environment, [])) {
		throw new Error("Unsupported native application transport profile.");
	}
}

function validateReceipt(receipt, commit, tag) {
	if (!exactKeys(receipt, ["commit", "tag", "checks"]) || receipt.commit !== commit
		|| receipt.tag !== tag
		|| !exactKeys(receipt.checks, ["tests", "dependency_audit", "package_signatures", "native_bindings"])
		|| Object.values(receipt.checks).some(value => value !== true)) {
		throw new Error("Incomplete or mismatched exact-release acceptance receipt.");
	}
}

function validateContract(bytes, profile) {
	const contract = JSON.parse(bytes.toString("utf8"));
	if (contract.version !== 1 || !Array.isArray(contract.required)
		|| !Array.isArray(contract.allowedRoots) || !Array.isArray(contract.allowedFiles)
		|| !Array.isArray(contract.nativeBindings)
		|| contract.runtime?.os !== "linux" || contract.runtime.arch !== "arm64"
		|| contract.runtime.node !== profile.runtime.node
		|| contract.runtime.npmBuildOnly !== profile.runtime.npm
		|| (contract.application !== undefined && contract.application !== profile.site)) {
		throw new Error("Native application contract differs from its transport profile.");
	}
	return contract;
}

function validateEnvelope(manifest, profile, contractBytes, receipt, configurationBytes) {
	assertProfile(profile);
	if (!exactKeys(manifest, ["schema_version", "site", "repository", "builder_id", "commit", "version", "tag", "source_clean", "runtime", "configuration_sha256", "runtime_contract_sha256", "checks", "archive", "files"])
		|| manifest.schema_version !== 1 || manifest.site !== profile.site
		|| manifest.repository !== profile.repository || manifest.builder_id !== profile.builder_id
		|| manifest.source_clean !== true || !/^[a-f0-9]{40}$/.test(manifest.commit)
		|| !/^v1\.\d+\.\d+$/.test(manifest.tag)
		|| manifest.tag !== `v${manifest.version}`
		|| JSON.stringify(canonicalJson(manifest.runtime)) !== JSON.stringify(canonicalJson(profile.runtime))
		|| manifest.runtime_contract_sha256 !== sha256(contractBytes)
		|| manifest.configuration_sha256 !== sha256(configurationBytes)
		|| !exactKeys(manifest.archive, ["name", "sha256", "size"])
		|| manifest.archive.name !== `${profile.site}-${manifest.tag}-linux-arm64-runtime.tar.gz`
		|| !/^[a-f0-9]{64}$/.test(manifest.archive.sha256)
		|| !Number.isSafeInteger(manifest.archive.size) || manifest.archive.size < 1
		|| manifest.archive.size > maxArchiveBytes
		|| !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > maxEntries) {
		throw new Error("Native transport identity, runtime or bound inputs differ.");
	}
	validateReceipt(receipt, manifest.commit, manifest.tag);
	if (JSON.stringify(canonicalJson(receipt.checks)) !== JSON.stringify(canonicalJson(manifest.checks))) {
		throw new Error("Transport and acceptance checks differ.");
	}
	const expectedConfiguration = {
		schema_version: 1,
		site: profile.site,
		repository: profile.repository,
		environment: profile.environment,
	};
	if (!configurationBytes.equals(Buffer.from(`${JSON.stringify(canonicalJson(expectedConfiguration))}\n`))) {
		throw new Error("Unreviewed public build configuration.");
	}
	const seen = new Set();
	for (const record of manifest.files) {
		if (!record.path?.startsWith("runtime/") || !safeRelative(record.path) || seen.has(record.path)
			|| (record.type !== "file" && record.type !== "directory")
			|| record.mode !== (record.type === "file" ? 0o644 : 0o755)
			|| !exactKeys(record, record.type === "file"
				? ["path", "type", "mode", "size", "sha256"]
				: ["path", "type", "mode"])
			|| (record.type === "file" && (!Number.isSafeInteger(record.size) || record.size < 0
				|| !/^[a-f0-9]{64}$/.test(record.sha256)))) {
			throw new Error("Unsafe, repeated or unsupported native transport member.");
		}
		seen.add(record.path);
	}
}

function verifyNativeInventory(manifest, embedded, contractBytes, profile) {
	const contract = validateContract(contractBytes, profile);
	if (embedded?.format !== 1 || embedded.commit !== manifest.commit
		|| embedded.contractSha256 !== sha256(contractBytes) || embedded.contractVersion !== 1
		|| (embedded.application !== undefined && embedded.application !== profile.site)
		|| !embedded.files || typeof embedded.files !== "object" || Array.isArray(embedded.files)) {
		throw new Error("Embedded native identity differs from its transport.");
	}
	const actualFiles = new Map(manifest.files.filter(record => record.type === "file")
		.map(record => [record.path.slice("runtime/".length), record]));
	if (actualFiles.size !== Object.keys(embedded.files).length + 1
		|| !actualFiles.has("runtime-manifest.json")) {
		throw new Error("Embedded native inventory is incomplete.");
	}
	for (const [name, entry] of Object.entries(embedded.files)) {
		const actual = actualFiles.get(name);
		if (!exactKeys(entry, ["size", "sha256", "mode"]) || entry.mode !== "0644"
			|| !safeRelative(name) || !allowedRuntimePath(name, contract)
			|| /(?:^|\/)(?:\.env(?:\.|$)|\.ai-work|\.git|credentials\.json)(?:\/|$)/.test(name)
			|| /\.(?:key|pem|p12|pfx|sqlite3?|db)$/.test(name)
			|| !actual || actual.size !== entry.size || actual.sha256 !== entry.sha256
			|| actual.mode !== Number.parseInt(entry.mode, 8)) {
			throw new Error("Native payload bytes, modes or allowed paths differ.");
		}
	}
	for (const required of contract.required) {
		if (!actualFiles.has(required)) throw new Error("Native payload lacks an independent required path.");
	}
	for (const record of manifest.files.filter(entry => entry.type === "directory")) {
		const name = record.path.slice("runtime/".length);
		if (!allowedRuntimePath(name, contract)
			&& ![...contract.allowedFiles, ...contract.allowedRoots].some(allowed => allowed.startsWith(`${name}/`))) {
			throw new Error("Unlisted native payload directory.");
		}
	}
	const nativePaths = [...actualFiles.keys()].filter(name => nativeFileName.test(name)).sort();
	if (JSON.stringify(nativePaths) !== JSON.stringify([...contract.nativeBindings].sort())) {
		throw new Error("Native binding inventory differs from the application contract.");
	}
}

async function collectNativeRecords(root, embedded) {
	const records = [];
	const seenFiles = new Set();
	async function walk(relative, depth) {
		if (depth > 64) throw new Error("Native directory nesting exceeds its bound.");
		const names = await fs.readdir(path.join(root, relative));
		for (const basename of names.sort()) {
			const name = relative ? `${relative}/${basename}` : basename;
			if (!safeRelative(name) || records.length >= maxEntries) throw new Error("Unsafe native inventory.");
			const fullPath = path.join(root, name);
			const metadata = await fs.lstat(fullPath);
			const mode = metadata.mode & 0o7777;
			if (metadata.isDirectory() && mode === 0o755) {
				records.push({ path: `runtime/${name}`, type: "directory", mode });
				await walk(name, depth + 1);
			}
			else if (metadata.isFile() && metadata.nlink === 1 && mode === 0o644) {
				const digest = await digestFile(fullPath);
				if (name !== "runtime-manifest.json"
					&& (digest.sha256 !== embedded.files?.[name]?.sha256
						|| digest.size !== embedded.files?.[name]?.size)) {
					throw new Error("Native file changed or is absent from its embedded inventory.");
				}
				if (nativeFileName.test(name)) await readNativeIdentity(fullPath, name);
				records.push({ path: `runtime/${name}`, type: "file", mode, ...digest });
				seenFiles.add(name);
			}
			else {
				throw new Error("Native payload has links, unreadable files or unexpected modes.");
			}
		}
	}
	await walk("", 0);
	if (seenFiles.size !== Object.keys(embedded.files).length + 1) {
		throw new Error("Native payload has an incomplete file inventory.");
	}
	return records;
}

export async function prepareNativeTransport({ runtimeRoot, outputDir, profile, contractBytes, commit, tag, receipt }) {
	assertProfile(profile);
	validateContract(contractBytes, profile);
	if (!/^[a-f0-9]{40}$/.test(commit) || !/^v1\.\d+\.\d+$/.test(tag)) {
		throw new Error("Expected an exact commit and stable native release tag.");
	}
	validateReceipt(receipt, commit, tag);
	const root = await fs.realpath(runtimeRoot);
	const embedded = JSON.parse((await readRegular(path.join(root, "runtime-manifest.json"))).toString());
	const records = await collectNativeRecords(root, embedded);
	const configurationBytes = Buffer.from(`${JSON.stringify(canonicalJson({
		schema_version: 1,
		site: profile.site,
		repository: profile.repository,
		environment: profile.environment,
	}))}\n`);
	const archiveName = `${profile.site}-${tag}-linux-arm64-runtime.tar.gz`;
	await fs.mkdir(outputDir, { recursive: false, mode: 0o700 });
	const archive = await writeTransportArchive(root, records, path.join(outputDir, archiveName));
	const manifest = {
		schema_version: 1,
		site: profile.site,
		repository: profile.repository,
		builder_id: profile.builder_id,
		commit,
		version: tag.slice(1),
		tag,
		source_clean: true,
		runtime: profile.runtime,
		configuration_sha256: sha256(configurationBytes),
		runtime_contract_sha256: sha256(contractBytes),
		checks: receipt.checks,
		archive: { name: archiveName, ...archive },
		files: records,
	};
	validateEnvelope(manifest, profile, contractBytes, receipt, configurationBytes);
	verifyNativeInventory(manifest, embedded, contractBytes, profile);
	const packed = await verifyTransportArchive(path.join(outputDir, archiveName), records);
	if (packed.package.version !== manifest.version) throw new Error("Native package version differs from its tag.");
	verifyNativeInventory(manifest, packed.manifest, contractBytes, profile);
	const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
	if (manifestBytes.length > maxManifestBytes) throw new Error("Native envelope exceeds its bound.");
	for (const [name, bytes] of [
		["anderson-runtime-manifest.json", manifestBytes],
		["public-build-configuration.json", configurationBytes],
		["acceptance-receipt.json", Buffer.from(`${JSON.stringify(receipt)}\n`)],
	]) {
		await fs.writeFile(path.join(outputDir, name), bytes, { flag: "wx", mode: 0o600 });
	}
	return manifest;
}

export async function verifyNativeTransport({ outputDir, profile, contractBytes, publicKey }) {
	const manifestBytes = await readRegular(path.join(outputDir, "anderson-runtime-manifest.json"));
	const manifest = JSON.parse(manifestBytes.toString());
	const receipt = JSON.parse((await readRegular(path.join(outputDir, "acceptance-receipt.json"))).toString());
	const configurationBytes = await readRegular(path.join(outputDir, "public-build-configuration.json"));
	validateEnvelope(manifest, profile, contractBytes, receipt, configurationBytes);
	const unsignedNames = [manifest.archive.name, "anderson-runtime-manifest.json", "public-build-configuration.json", "acceptance-receipt.json"].sort();
	const names = (await fs.readdir(outputDir)).sort();
	const expected = publicKey ? [...unsignedNames, "anderson-runtime-manifest.sig", "SHA256SUMS"].sort() : unsignedNames;
	if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error("Incomplete or unexpected release assets.");
	const archivePath = path.join(outputDir, manifest.archive.name);
	const archive = await digestFile(archivePath);
	if (archive.size !== manifest.archive.size || archive.sha256 !== manifest.archive.sha256) {
		throw new Error("Native transport archive digest differs.");
	}
	const embedded = await verifyTransportArchive(archivePath, manifest.files);
	if (embedded.package.version !== manifest.version) throw new Error("Native package version differs from its tag.");
	verifyNativeInventory(manifest, embedded.manifest, contractBytes, profile);
	if (publicKey) {
		const key = crypto.createPublicKey(publicKey);
		const signature = await readRegular(path.join(outputDir, "anderson-runtime-manifest.sig"), 64);
		if (key.asymmetricKeyType !== "ed25519" || signature.length !== 64
			|| !crypto.verify(null, manifestBytes, key, signature)) {
			throw new Error("Native transport signature failed.");
		}
		const checksums = [];
		for (const name of [...unsignedNames, "anderson-runtime-manifest.sig"].sort()) {
			checksums.push(`${(await digestFile(path.join(outputDir, name))).sha256}  ${name}`);
		}
		if (!(await readRegular(path.join(outputDir, "SHA256SUMS"))).equals(Buffer.from(`${checksums.join("\n")}\n`))) {
			throw new Error("Native release checksums differ.");
		}
	}
	return manifest;
}

async function main() {
	const [operation, ...args] = process.argv.slice(2);
	const options = {};
	const allowed = operation === "prepare"
		? ["--runtime", "--output", "--profile", "--contract", "--commit", "--tag", "--receipt"]
		: ["--output", "--profile", "--contract", "--public-key"];
	if (!["prepare", "verify"].includes(operation) || args.length % 2) throw new Error("Invalid native transport invocation.");
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index];
		if (!allowed.includes(name) || options[name] || !args[index + 1]) throw new Error("Invalid native transport option.");
		options[name] = args[index + 1];
	}
	for (const name of allowed.filter(name => name !== "--public-key")) {
		if (!options[name]) throw new Error("Required native transport option is missing.");
	}
	const input = {
		outputDir: options["--output"],
		profile: JSON.parse(await readRegular(options["--profile"])),
		contractBytes: await readRegular(options["--contract"])
	};
	const result = operation === "prepare"
		? await prepareNativeTransport({ ...input, runtimeRoot: options["--runtime"], commit: options["--commit"], tag: options["--tag"], receipt: JSON.parse(await readRegular(options["--receipt"])) })
		: await verifyNativeTransport({ ...input, publicKey: options["--public-key"] ? await readRegular(options["--public-key"]) : undefined });
	console.log(JSON.stringify({ site: result.site, commit: result.commit, tag: result.tag, archiveSha256: result.archive.sha256, signed: operation === "verify" && Boolean(options["--public-key"]), productionActivated: false }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch(() => {
		console.error("Native transport validation failed; no signing or publication was performed.");
		process.exitCode = 1;
	});
}
