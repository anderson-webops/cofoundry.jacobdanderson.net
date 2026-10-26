import importlib.util
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parent.parent


class NativeServiceProfileTests(unittest.TestCase):
    def test_frontend_preserves_loopback_4013(self):
        unit = (ROOT / "deploy/systemd/cofoundry-app.service").read_text()
        self.assertIn("Environment=NITRO_HOST=127.0.0.1\n", unit)
        self.assertIn("Environment=NITRO_PORT=4013\n", unit)
        self.assertIn("front-end/.output/server/index.mjs\n", unit)

    def test_backend_preserves_loopback_3015(self):
        unit = (ROOT / "deploy/systemd/cofoundry-backend.service").read_text()
        self.assertIn("Environment=BACKEND_HOST=127.0.0.1\n", unit)
        self.assertIn("Environment=BACKEND_PORT=3015\n", unit)
        self.assertIn("back-end/dist/server.js\n", unit)

    def test_bundle_binds_both_units(self):
        spec = importlib.util.spec_from_file_location("controls", ROOT / "scripts/host-control-bundle.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for name in ["cofoundry-app.service", "cofoundry-backend.service"]:
            self.assertEqual(module.FILES[f"deploy/systemd/{name}"], 0o644)

    def test_installer_rejects_colliding_unit_paths(self):
        result = subprocess.run(
            ["bash", str(ROOT / "deploy/systemd/install-app-unit.sh"), "--help"],
            env={"UNIT_DEST": "/tmp/colliding.service", "BACKEND_UNIT_DEST": "/tmp/colliding.service"},
            capture_output=True,
            text=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("distinct installation paths", result.stderr)


if __name__ == "__main__":
    unittest.main()
