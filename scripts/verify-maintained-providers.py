import base64
import hashlib
import io
import json
import stat
import tarfile
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parent.parent


def require(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    records = json.loads((ROOT / "vendor/maintained-providers.json").read_text())
    lock = json.loads((ROOT / "package-lock.json").read_text())["packages"]
    manifest = json.loads((ROOT / "package.json").read_text())
    installed = {}
    for name, record in records["providers"].items():
        payload = (ROOT / record["archive"]).read_bytes()
        require(hashlib.sha256(payload).hexdigest() == record["sha256"], f"Changed {name} archive requires producer review")
        files = {}
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
            for member in archive:
                if member.isdir():
                    continue
                path = PurePosixPath(member.name)
                require(member.isfile() and path.parts[0] == "package" and ".." not in path.parts, "Unexpected maintained package member")
                relative = "/".join(path.parts[1:])
                require(relative not in files, "Duplicate maintained package member")
                files[relative] = archive.extractfile(member).read()
        identity = json.loads(files["package.json"])
        require(identity["name"] == name, "Maintained package identity mismatch")
        reference = "file:" + record["archive"]
        require(manifest["devDependencies"][name] == reference and manifest["overrides"][name] == "$" + name, "Maintained package must cover all application consumers")
        integrity = "sha512-" + base64.b64encode(hashlib.sha512(payload).digest()).decode()
        consumers = []
        for location, entry in lock.items():
            if location != "node_modules/" + name and not location.endswith("/node_modules/" + name):
                continue
            require(entry["version"] == identity["version"] and entry["integrity"] == integrity, f"Unreviewed locked {name} copy")
            directory = ROOT / location
            require(not directory.is_symlink(), "Maintained provider must be independently installed")
            for relative, expected in files.items():
                actual = directory / relative
                require(stat.S_ISREG(actual.lstat().st_mode) and actual.read_bytes() == expected, f"Installed {name} differs from its accepted archive")
            consumers.append(location)
        require(consumers, f"Missing installed {name} consumer")
        installed[name] = len(consumers)
    print(json.dumps({"producerTag": records["producerTag"], "installedConsumers": installed}))


if __name__ == "__main__":
    main()
