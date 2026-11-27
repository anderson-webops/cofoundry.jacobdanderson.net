import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile


ROOT = Path(__file__).resolve().parent.parent
BASE_ARCHIVE = "vendor/deepmerge-4.3.2-webops.2.tgz"
BASE_SHA256 = "d2f30826ebcc45fb843120296e12b6465d3afe4b50e457f4e053403ec534adb4"
VERSION = "4.3.2-cofoundry.1"
OUTPUT = "vendor/deepmerge-" + VERSION + ".tgz"
REQUIRED = {
    "package/UPSTREAM-PACKAGE.json", "package/UPSTREAM.md",
    "package/WEBOPS-PACKAGE.json", "package/dist/cjs.js", "package/dist/umd.js",
    "package/index.d.ts", "package/license.txt", "package/package.json",
}


def build_archive(root):
    source = root / BASE_ARCHIVE
    if source.is_symlink() or not source.is_file():
        raise ValueError("The reviewed base archive must be a regular local file")
    original = source.read_bytes()
    if hashlib.sha256(original).hexdigest() != BASE_SHA256:
        raise ValueError("The site policy requires the exact reviewed base archive")
    files = {}
    with tarfile.open(fileobj=io.BytesIO(original), mode="r:gz") as archive:
        for member in archive:
            if member.isdir():
                continue
            if not member.isfile() or member.name not in REQUIRED or member.name in files:
                raise ValueError("Unexpected or repeated Deepmerge base member")
            if member.mode != 0o644 or member.size > 1024 * 1024:
                raise ValueError("Unexpected Deepmerge base mode or size")
            files[member.name] = archive.extractfile(member).read()
    if set(files) != REQUIRED:
        raise ValueError("Missing Deepmerge base member")
    metadata = json.loads(files["package/package.json"])
    if metadata["name"] != "deepmerge" or metadata["version"] != "4.3.2-webops.2":
        raise ValueError("Unexpected Deepmerge base identity")
    metadata["version"] = VERSION
    files["package/package.json"] = (json.dumps(metadata, indent=2) + "\n").encode()
    for filename in ["package/dist/cjs.js", "package/dist/umd.js"]:
        before = b"return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))"
        after = before + b".filter(function(key) { return key !== '__proto__' })"
        if files[filename].count(before) != 1:
            raise ValueError("The reviewed Deepmerge key boundary changed")
        files[filename] = files[filename].replace(before, after)
    policy = {
        "schemaVersion": 1,
        "baseArchive": BASE_ARCHIVE,
        "baseSha256": BASE_SHA256,
        "baseProducer": "anderson-webops/vitesse-nuxt-template",
        "baseTag": "v2.1.41",
        "siteProducer": "anderson-webops/cofoundry.jacobdanderson.net",
        "sitePolicy": "Omit own __proto__ keys before reading values or invoking merge hooks",
        "preservedPolicySource": "e78fadbe32c061bc2e5f10512296d3418da66147:vendor/deepmerge/dist/cjs.js",
        "version": VERSION,
    }
    files["package/COFOUNDRY-POLICY.json"] = (json.dumps(policy, indent=2) + "\n").encode()
    output = io.BytesIO()
    with gzip.GzipFile(
        fileobj=output, mode="wb", compresslevel=6, mtime=0, filename=""
    ) as compressed:
        with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.PAX_FORMAT) as archive:
            for filename, payload in sorted(files.items()):
                path = PurePosixPath(filename)
                if ".." in path.parts:
                    raise ValueError("The site package must remain local")
                member = tarfile.TarInfo(filename)
                member.mode = 0o644
                member.size = len(payload)
                archive.addfile(member, io.BytesIO(payload))
    return output.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    payload = build_archive(ROOT)
    output = ROOT / OUTPUT
    if output.is_symlink():
        raise ValueError("The site package must be a regular local archive")
    if arguments.check or output.exists():
        if output.read_bytes() != payload:
            raise ValueError("The immutable site package differs from reviewed source")
    else:
        output.write_bytes(payload)
    print(json.dumps({"archive": OUTPUT, "sha256": hashlib.sha256(payload).hexdigest(), "version": VERSION}))


if __name__ == "__main__":
    main()
