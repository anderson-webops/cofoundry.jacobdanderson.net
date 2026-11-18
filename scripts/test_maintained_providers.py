import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import tarfile
import tempfile
import unittest
from pathlib import Path


SOURCE = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("maintained_providers", SOURCE / "scripts/verify-maintained-providers.py")
PROVIDERS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PROVIDERS)


class MaintainedProviderTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.previous = PROVIDERS.ROOT
        PROVIDERS.ROOT = self.root
        records = json.loads((SOURCE / "vendor/maintained-providers.json").read_text())
        self.write_json("vendor/maintained-providers.json", records)
        manifest = {"devDependencies": {}, "overrides": {}}
        lock = {"packages": {}}
        for name, record in records["providers"].items():
            payload = (SOURCE / record["archive"]).read_bytes()
            target = self.root / record["archive"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            location = "node_modules/" + name
            with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
                identity = json.loads(archive.extractfile("package/package.json").read())
                for member in archive:
                    if not member.isfile():
                        continue
                    destination = self.root / location / member.name.removeprefix("package/")
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_bytes(archive.extractfile(member).read())
            reference = "file:" + record["archive"]
            manifest["devDependencies"][name] = reference
            manifest["overrides"][name] = "$" + name
            lock["packages"][location] = {
                "version": identity["version"],
                "integrity": "sha512-" + base64.b64encode(hashlib.sha512(payload).digest()).decode(),
            }
        self.write_json("package.json", manifest)
        self.write_json("package-lock.json", lock)

    def tearDown(self):
        PROVIDERS.ROOT = self.previous
        self.temporary.cleanup()

    def write_json(self, filename, value):
        target = self.root / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(value))

    def test_accepts_complete_exact_provider_copies(self):
        with contextlib.redirect_stdout(io.StringIO()):
            PROVIDERS.main()

    def test_rejects_changed_installed_provider(self):
        (self.root / "node_modules/picomatch/index.js").write_text("module.exports = () => true")
        with self.assertRaisesRegex(ValueError, "differs from its accepted archive"):
            PROVIDERS.main()

    def test_rejects_an_unqualified_nested_copy(self):
        lock = json.loads((self.root / "package-lock.json").read_text())
        lock["packages"]["node_modules/consumer/node_modules/picomatch"] = {
            "version": "4.0.7",
            "integrity": "unreviewed",
        }
        self.write_json("package-lock.json", lock)
        with self.assertRaisesRegex(ValueError, "Unreviewed locked"):
            PROVIDERS.main()

    def test_rejects_changed_archive(self):
        with (self.root / "vendor/picomatch-4.0.7-webops.1.tgz").open("ab") as archive:
            archive.write(b"changed")
        with self.assertRaisesRegex(ValueError, "archive requires producer review"):
            PROVIDERS.main()


if __name__ == "__main__":
    unittest.main()
