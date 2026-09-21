import importlib.util
import os
from pathlib import Path
import tempfile
import unittest


HELPER = Path(__file__).resolve().parent.parent / "deploy/systemd/trusted-paths.py"
SPEC = importlib.util.spec_from_file_location("trusted_paths", HELPER)
trusted_paths = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(trusted_paths)


class TrustedPathTests(unittest.TestCase):
    def setUp(self):
        runs = Path(__file__).resolve().parent.parent / ".ai-work/runs"
        runs.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=runs)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.root.chmod(0o700)
        self.release = self.root / "release"
        self.release.mkdir(mode=0o755)
        self.entrypoint = self.release / "index.mjs"
        self.entrypoint.write_text("export default true\n")
        self.entrypoint.chmod(0o644)

    def validate(self):
        trusted_paths.protected(
            self.release,
            tree=True,
            trusted_uid=os.getuid(),
            boundary=self.root,
        )

    def test_accepts_protected_tree(self):
        self.validate()

    def test_rejects_group_writable_content(self):
        self.entrypoint.chmod(0o664)
        with self.assertRaisesRegex(ValueError, "not protected"):
            self.validate()

    def test_rejects_symlink(self):
        link = self.release / "escape"
        link.symlink_to("/tmp")
        with self.assertRaisesRegex(ValueError, "not protected"):
            self.validate()

    def test_rejects_hard_link(self):
        os.link(self.entrypoint, self.release / "duplicate.mjs")
        with self.assertRaisesRegex(ValueError, "not protected"):
            self.validate()

    def test_rejects_wrong_owner_expectation(self):
        with self.assertRaisesRegex(ValueError, "not protected"):
            trusted_paths.protected(
                self.release,
                tree=True,
                trusted_uid=os.getuid() + 1,
                boundary=self.root,
            )


if __name__ == "__main__":
    unittest.main()
