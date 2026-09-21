"""Security tests for the immutable host-control archive."""

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "host_control_bundle", Path(__file__).with_name("host-control-bundle.py")
)
bundle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bundle)


class HostControlBundleTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.commit = "a" * 40
        self.payloads = {
            name: f"fixture for {name}\n".encode()
            for name in bundle.FILES
        }
        self.archive = self.root / "controls.tar.gz"
        self.receipt = bundle.write_bundle(self.archive, self.commit, self.payloads)

    def tearDown(self):
        self.temporary.cleanup()

    def test_round_trip_extracts_exact_fixed_contract(self):
        destination = self.root / "verified"
        result = bundle.extract_verified(
            self.archive, self.receipt["sha256"], self.commit, destination
        )
        self.assertEqual(result["files"], len(bundle.FILES))
        for name, value in self.payloads.items():
            self.assertEqual((destination / name).read_bytes(), value)
            self.assertEqual((destination / name).stat().st_mode & 0o777, bundle.FILES[name])

    def test_wrong_digest_is_rejected_before_extraction(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            bundle.extract_verified(self.archive, "0" * 64, self.commit, self.root / "nope")
        self.assertFalse((self.root / "nope").exists())

    def rewrite_archive(self, mutate):
        members = []
        with tarfile.open(self.archive, "r:gz") as source:
            for member in source.getmembers():
                value = source.extractfile(member).read() if member.isreg() else b""
                members.append((member, value))
        mutate(members)
        replacement = self.root / "replacement.tar.gz"
        with tarfile.open(replacement, "w:gz") as target:
            for member, value in members:
                target.addfile(member, io.BytesIO(value) if member.isreg() else None)
        return replacement, hashlib.sha256(replacement.read_bytes()).hexdigest()

    def test_duplicate_member_is_rejected(self):
        replacement, digest = self.rewrite_archive(lambda members: members.append(members[-1]))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            bundle.verified_payloads(replacement, digest, self.commit)

    def test_link_member_is_rejected(self):
        def mutate(members):
            member, _ = members[-1]
            member.type = tarfile.SYMTYPE
            member.linkname = "/etc/shadow"
            member.size = 0
        replacement, digest = self.rewrite_archive(mutate)
        with self.assertRaisesRegex(ValueError, "unsafe|member set"):
            bundle.verified_payloads(replacement, digest, self.commit)

    def test_manifest_hash_tampering_is_rejected(self):
        def mutate(members):
            for index, (member, value) in enumerate(members):
                if member.name == bundle.MANIFEST:
                    manifest = json.loads(value)
                    first = next(iter(manifest["files"]))
                    manifest["files"][first]["sha256"] = "0" * 64
                    replacement = bundle.canonical_json(manifest)
                    member.size = len(replacement)
                    members[index] = (member, replacement)
        replacement, digest = self.rewrite_archive(mutate)
        with self.assertRaisesRegex(ValueError, "evidence"):
            bundle.verified_payloads(replacement, digest, self.commit)


if __name__ == "__main__":
    unittest.main()
