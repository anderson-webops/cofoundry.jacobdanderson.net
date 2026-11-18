import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("runtime-artifact.py")
SPEC = importlib.util.spec_from_file_location("runtime_artifact", SCRIPT)
artifact = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(artifact)


class RuntimeArtifactTests(unittest.TestCase):
    def setUp(self):
        runs = Path(__file__).resolve().parent.parent / ".ai-work/runs"
        runs.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=runs)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.commit = "a" * 40
        self.version = "1.2.1"

        for name in artifact.CONTRACT["required"]:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("synthetic runtime file\n")
            path.chmod(0o644)

        root_package = {
            "name": "cofoundry-monorepo",
            "version": self.version,
            "workspaces": ["front-end", "back-end"],
        }
        frontend_package = {"name": "front-end", "version": self.version}
        backend_package = {
            "name": "back-end",
            "version": self.version,
            "dependencies": {"@supabase/supabase-js": "2.112.2"},
        }
        runtime_package = {"name": "@supabase/supabase-js", "version": "2.112.2"}
        server_package = {"name": "front-end-prod", "version": self.version, "dependencies": {}}
        (self.root / "front-end/.output/server/node_modules").mkdir(parents=True, exist_ok=True)
        lock = {
            "name": "cofoundry-monorepo",
            "version": self.version,
            "lockfileVersion": 3,
            "packages": {
                "": root_package,
                "back-end": backend_package,
                "front-end": frontend_package,
                "node_modules/@supabase/supabase-js": {
                    "version": "2.112.2",
                },
            },
        }
        values = {
            "package.json": root_package,
            "package-lock.json": lock,
            "front-end/package.json": frontend_package,
            "back-end/package.json": backend_package,
            "front-end/.output/server/package.json": server_package,
            "node_modules/@supabase/supabase-js/package.json": runtime_package,
            artifact.IDENTITY: {
                "commitSha": self.commit,
                "deployedAt": "2026-09-20T00:00:00Z",
                "release": f"v{self.version}",
            },
        }
        for name, value in values.items():
            (self.root / name).write_text(json.dumps(value) + "\n")

    def manifest(self):
        return {
            "commit": self.commit,
            "contractSha256": artifact.contract_digest(),
            "contractVersion": artifact.CONTRACT["version"],
            "files": artifact.inventory(self.root),
            "format": 1,
        }

    def test_valid_tree(self):
        artifact.validate(self.root, self.manifest())

    def test_candidate_contract_requires_exact_reviewed_toolchain(self):
        original = json.loads(artifact.CONTRACT_PATH.read_text())
        for runtime in (
            {"os": "linux", "arch": "arm64", "node": "24.18.1", "npmBuildOnly": "12.0.2"},
            {"os": "linux", "arch": "arm64", "node": "26.13.1", "npmBuildOnly": "12.0.2"},
            {"os": "linux", "arch": "x64", "node": "26.13.1", "npmBuildOnly": "12.2.2"},
        ):
            with self.subTest(runtime=runtime):
                candidate = {**original, "runtime": runtime}
                contract_path = self.root / "contract.json"
                contract_path.write_text(json.dumps(candidate))
                with patch.object(artifact, "CONTRACT_PATH", contract_path):
                    with self.assertRaisesRegex(ValueError, "reviewed Node 26"):
                        artifact.load_contract()

    def test_identity_writer_is_readable_under_restrictive_umasks(self):
        identity = self.root / artifact.IDENTITY
        package = json.loads((SCRIPT.parent.parent / "package.json").read_text())
        for mask in (0o077, 0o002):
            with self.subTest(umask=oct(mask)):
                identity.unlink()
                subprocess.run(
                    [
                        "node",
                        str(SCRIPT.with_name("write-runtime-identity.mjs")),
                        str(self.root),
                        self.commit,
                        f"v{package['version']}",
                        "2026-09-20T00:00:00Z",
                    ],
                    check=True,
                    capture_output=True,
                    umask=mask,
                )
                self.assertEqual(identity.stat().st_mode & 0o777, 0o644)
                self.assertEqual(
                    json.loads(identity.read_text())["commitSha"], self.commit
                )

    def test_service_unreadable_identity_is_rejected(self):
        (self.root / artifact.IDENTITY).chmod(0o600)
        with self.assertRaisesRegex(ValueError, "release identity mode"):
            artifact.validate(self.root, self.manifest())

    def test_modified_file_is_rejected(self):
        manifest = self.manifest()
        (self.root / "back-end/dist/server.js").write_text("tampered\n")
        with self.assertRaisesRegex(ValueError, "inventory or hashes"):
            artifact.validate(self.root, manifest)

    def test_missing_required_file_is_rejected_even_after_rehash(self):
        (self.root / "back-end/dist/environment.js").unlink()
        with self.assertRaisesRegex(ValueError, "required runtime path missing"):
            artifact.validate(self.root, self.manifest())

    def test_private_state_links_and_executables_are_rejected(self):
        secret = self.root / "back-end/dist/.env"
        secret.write_text("secret\n")
        with self.assertRaisesRegex(ValueError, "forbidden"):
            artifact.inventory(self.root)
        secret.unlink()

        link = self.root / "back-end/dist/escape"
        link.symlink_to("/tmp")
        with self.assertRaisesRegex(ValueError, "unsafe artifact object"):
            artifact.inventory(self.root)
        link.unlink()

        executable = self.root / "back-end/dist/unreviewed"
        executable.write_text("fixture\n")
        executable.chmod(0o755)
        with self.assertRaisesRegex(ValueError, "unexpected executable"):
            artifact.inventory(self.root)

    def test_hard_links_and_writable_modes_are_rejected(self):
        source = self.root / "back-end/dist/server.js"
        hard_link = self.root / "back-end/dist/duplicate.js"
        os.link(source, hard_link)
        with self.assertRaisesRegex(ValueError, "hard-linked"):
            artifact.inventory(self.root)
        hard_link.unlink()
        source.chmod(0o664)
        with self.assertRaisesRegex(ValueError, "unsafe artifact mode"):
            artifact.inventory(self.root)

    def test_special_permission_bits_are_rejected(self):
        source = self.root / "back-end/dist/server.js"
        source.chmod(0o4644)
        with self.assertRaisesRegex(ValueError, "unsafe artifact mode"):
            artifact.inventory(self.root)

    def test_development_dependency_is_rejected(self):
        package = self.root / "node_modules/tsx/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"name": "tsx", "version": "4.0.0"}))
        lock_path = self.root / "package-lock.json"
        lock = json.loads(lock_path.read_text())
        lock["packages"]["node_modules/tsx"] = {"dev": True, "version": "4.0.0"}
        lock_path.write_text(json.dumps(lock))
        with self.assertRaisesRegex(ValueError, "development dependency"):
            artifact.validate(self.root, self.manifest())

    def test_extra_generated_frontend_dependency_is_rejected(self):
        package = self.root / "front-end/.output/server/node_modules/unreviewed/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"name": "unreviewed", "version": "1.0.0"}))
        with self.assertRaisesRegex(ValueError, "generated front-end dependencies differ"):
            artifact.validate(self.root, self.manifest())

    def test_generated_frontend_dependency_must_match_the_root_lock(self):
        server_package_path = self.root / "front-end/.output/server/package.json"
        server_package = json.loads(server_package_path.read_text())
        server_package["dependencies"] = {"reviewed-runtime": "1.0.0"}
        server_package_path.write_text(json.dumps(server_package))
        package = self.root / "front-end/.output/server/node_modules/reviewed-runtime/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"name": "reviewed-runtime", "version": "1.0.0"}))
        with self.assertRaisesRegex(ValueError, "not bound to the root lock"):
            artifact.validate(self.root, self.manifest())

    def test_generated_frontend_dependency_matches_nested_build_lock(self):
        server_package_path = self.root / "front-end/.output/server/package.json"
        server_package = json.loads(server_package_path.read_text())
        server_package["dependencies"] = {"lru-cache": "11.5.3"}
        server_package_path.write_text(json.dumps(server_package))
        package = self.root / "front-end/.output/server/node_modules/lru-cache/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"name": "lru-cache", "version": "11.5.3"}))
        lock_path = self.root / "package-lock.json"
        lock = json.loads(lock_path.read_text())
        lock["packages"]["node_modules/unstorage/node_modules/lru-cache"] = {
            "dev": True,
            "version": "11.5.3",
        }
        lock_path.write_text(json.dumps(lock))
        artifact.validate(self.root, self.manifest())

    def test_generated_frontend_development_tool_is_rejected(self):
        server_package_path = self.root / "front-end/.output/server/package.json"
        server_package = json.loads(server_package_path.read_text())
        server_package["dependencies"] = {"vite": "7.0.0"}
        server_package_path.write_text(json.dumps(server_package))
        package = self.root / "front-end/.output/server/node_modules/vite/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"name": "vite", "version": "7.0.0"}))
        with self.assertRaisesRegex(ValueError, "development tool"):
            artifact.validate(self.root, self.manifest())

    def test_identity_mismatch_is_rejected(self):
        identity_path = self.root / artifact.IDENTITY
        identity = json.loads(identity_path.read_text())
        identity["commitSha"] = "b" * 40
        identity_path.write_text(json.dumps(identity))
        with self.assertRaisesRegex(ValueError, "identity does not match"):
            artifact.validate(self.root, self.manifest())

    def test_trusted_archive_rejects_regenerated_manifest(self):
        manifest = self.manifest()
        (self.root / artifact.MANIFEST).write_text(json.dumps(manifest))
        archive_path = self.root.parent / f"{self.root.name}.tar.gz"
        self.addCleanup(lambda: archive_path.unlink(missing_ok=True))
        with tarfile.open(archive_path, "w:gz") as archive:
            for name in sorted([artifact.MANIFEST, *manifest["files"]]):
                archive.add(self.root / name, arcname=name, recursive=False)

        with tempfile.TemporaryDirectory(dir=self.root.parent) as target_name:
            target = Path(target_name)
            sha = artifact.digest(archive_path)
            artifact.unpack(target, archive_path, sha, self.commit)
            changed = target / "back-end/dist/server.js"
            changed.write_text("tampered after staging\n")
            regenerated = json.loads((target / artifact.MANIFEST).read_text())
            regenerated["files"] = artifact.inventory(target)
            (target / artifact.MANIFEST).write_text(json.dumps(regenerated))
            result = subprocess.run(
                [sys.executable, "-B", str(SCRIPT), "verify", str(target),
                 "--archive", str(archive_path), "--sha256", sha, "--commit", self.commit],
                capture_output=True,
                text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("staged manifest differs from trusted archive", result.stderr)

    def test_trusted_archive_rejects_member_content_that_disagrees_with_manifest(self):
        manifest = self.manifest()
        (self.root / artifact.MANIFEST).write_text(json.dumps(manifest))
        archive_path = self.root.parent / f"{self.root.name}-tampered.tar.gz"
        self.addCleanup(lambda: archive_path.unlink(missing_ok=True))
        with tarfile.open(archive_path, "w:gz") as archive:
            for name in sorted([artifact.MANIFEST, *manifest["files"]]):
                path = self.root / name
                if name != "back-end/dist/server.js":
                    archive.add(path, arcname=name, recursive=False)
                    continue
                content = b"different archive content\n"
                info = tarfile.TarInfo(name)
                info.mode = 0o644
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        with tarfile.open(archive_path, "r:gz") as archive:
            with self.assertRaisesRegex(ValueError, "member differs"):
                artifact.verified_archive_manifest(archive)

    def test_archive_rejects_paths_that_normalize_to_the_same_target(self):
        archive_path = self.root.parent / f"{self.root.name}-duplicate.tar.gz"
        self.addCleanup(lambda: archive_path.unlink(missing_ok=True))
        with tarfile.open(archive_path, "w:gz") as archive:
            for name in ("package.json", "./package.json"):
                archive.add(self.root / "package.json", arcname=name, recursive=False)
        with tarfile.open(archive_path, "r:gz") as archive:
            with self.assertRaisesRegex(ValueError, "unsafe artifact path|duplicate"):
                artifact.safe_archive_members(archive)


if __name__ == "__main__":
    unittest.main()
