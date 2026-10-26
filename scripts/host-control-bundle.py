#!/usr/bin/env python3
"""Build and verify the immutable host-control bundle used by the root installer."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import stat
import subprocess
import tarfile
import tempfile


FORMAT = 1
MANIFEST = "control-manifest.json"
MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
MAX_MEMBER_BYTES = 2 * 1024 * 1024
FILES = {
    "deploy/runtime-artifact.json": 0o644,
    "deploy/systemd/cofoundry-app.env.example": 0o644,
    "deploy/systemd/cofoundry-app.service": 0o644,
    "deploy/systemd/cofoundry-backend.service": 0o644,
    "deploy/systemd/install-app-unit.sh": 0o755,
    "deploy/systemd/promote-release.sh": 0o755,
    "deploy/systemd/trusted-paths.py": 0o755,
    "scripts/host-control-bundle.py": 0o755,
    "scripts/runtime-artifact.py": 0o755,
}


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def require_hex(value: str, length: int, label: str) -> None:
    if len(value) != length or any(character not in "0123456789abcdef" for character in value):
        raise ValueError(f"{label} must be {length} lowercase hexadecimal characters")


def canonical_json(value: object) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def stable_source_bytes(path: Path, expected_mode: int) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1:
        raise ValueError(f"control source must be one regular file: {path}")
    if stat.S_IMODE(before.st_mode) != expected_mode:
        raise ValueError(f"control source has unexpected mode: {path}")
    value = path.read_bytes()
    after = path.lstat()
    identity_before = (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns)
    identity_after = (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns)
    if identity_before != identity_after or len(value) != before.st_size:
        raise ValueError(f"control source changed while it was read: {path}")
    if len(value) > MAX_MEMBER_BYTES:
        raise ValueError(f"control source is unexpectedly large: {path}")
    return value


def write_bundle(archive: Path, commit: str, payloads: dict[str, bytes]) -> dict[str, object]:
    require_hex(commit, 40, "commit")
    if set(payloads) != set(FILES):
        raise ValueError("control bundle payload does not match the fixed file contract")

    entries = {
        name: {
            "mode": FILES[name],
            "sha256": sha256_bytes(payloads[name]),
            "size": len(payloads[name]),
        }
        for name in sorted(FILES)
    }
    manifest = {
        "commit": commit,
        "files": entries,
        "format": FORMAT,
    }
    manifest_bytes = canonical_json(manifest)
    archive.parent.mkdir(parents=True, exist_ok=True)
    if archive.exists():
        raise ValueError(f"refusing to replace existing control archive: {archive}")

    temporary = archive.with_name(f".{archive.name}.next-{os.getpid()}")
    try:
        with temporary.open("xb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as target:
                    for name, value, mode in [
                        (MANIFEST, manifest_bytes, 0o644),
                        *((name, payloads[name], FILES[name]) for name in sorted(FILES)),
                    ]:
                        info = tarfile.TarInfo(name)
                        info.mode = mode
                        info.uid = 0
                        info.gid = 0
                        info.uname = "root"
                        info.gname = "root"
                        info.mtime = 0
                        info.size = len(value)
                        target.addfile(info, io.BytesIO(value))
        temporary.replace(archive)
    finally:
        temporary.unlink(missing_ok=True)

    return {
        "archive": archive.name,
        "commit": commit,
        "files": len(FILES),
        "manifestSha256": sha256_bytes(manifest_bytes),
        "sha256": sha256_file(archive),
    }


def verify_git_source(root: Path, commit: str) -> dict[str, bytes]:
    actual_commit = subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
    ).strip()
    if actual_commit != commit:
        raise ValueError(f"control bundle commit does not match HEAD: {actual_commit}")
    subprocess.run(
        ["git", "-C", str(root), "diff", "--quiet", "--", *FILES], check=True
    )
    subprocess.run(
        ["git", "-C", str(root), "diff", "--cached", "--quiet", "--", *FILES], check=True
    )
    subprocess.run(
        ["git", "-C", str(root), "ls-files", "--error-unmatch", *FILES],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return {
        name: stable_source_bytes(root / name, mode)
        for name, mode in FILES.items()
    }


def safe_member_name(name: str) -> bool:
    pure = PurePosixPath(name)
    return (
        name == pure.as_posix()
        and not pure.is_absolute()
        and "\\" not in name
        and all(part not in {"", ".", ".."} for part in pure.parts)
    )


def verified_payloads(archive: Path, expected_sha: str, commit: str) -> tuple[dict[str, bytes], dict[str, object]]:
    require_hex(expected_sha, 64, "archive SHA-256")
    require_hex(commit, 40, "commit")
    if archive.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("control archive exceeds the size ceiling")
    actual_sha = sha256_file(archive)
    if actual_sha != expected_sha:
        raise ValueError("control archive SHA-256 does not match")

    expected_names = {MANIFEST, *FILES}
    payloads: dict[str, bytes] = {}
    modes: dict[str, int] = {}
    with tarfile.open(archive, "r:gz") as source:
        members = source.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)):
            raise ValueError("control archive contains duplicate paths")
        if set(names) != expected_names:
            raise ValueError("control archive member set does not match the fixed contract")
        for member in members:
            if not safe_member_name(member.name) or not member.isreg() or member.size > MAX_MEMBER_BYTES:
                raise ValueError(f"unsafe control archive member: {member.name}")
            expected_mode = 0o644 if member.name == MANIFEST else FILES[member.name]
            if member.mode != expected_mode or member.uid != 0 or member.gid != 0:
                raise ValueError(f"control archive metadata does not match: {member.name}")
            extracted = source.extractfile(member)
            if extracted is None:
                raise ValueError(f"control archive member is unreadable: {member.name}")
            value = extracted.read(MAX_MEMBER_BYTES + 1)
            if len(value) != member.size:
                raise ValueError(f"control archive member size does not match: {member.name}")
            payloads[member.name] = value
            modes[member.name] = member.mode

    manifest = json.loads(payloads.pop(MANIFEST))
    if manifest.get("format") != FORMAT or manifest.get("commit") != commit:
        raise ValueError("control manifest identity does not match")
    entries = manifest.get("files")
    if not isinstance(entries, dict) or set(entries) != set(FILES):
        raise ValueError("control manifest file set does not match")
    for name, value in payloads.items():
        expected = entries[name]
        if expected != {
            "mode": FILES[name],
            "sha256": sha256_bytes(value),
            "size": len(value),
        }:
            raise ValueError(f"control manifest file evidence does not match: {name}")
    return payloads, manifest


def extract_verified(archive: Path, expected_sha: str, commit: str, destination: Path) -> dict[str, object]:
    payloads, manifest = verified_payloads(archive, expected_sha, commit)
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    for name, value in payloads.items():
        target = destination / name
        target.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
        target.write_bytes(value)
        target.chmod(FILES[name])
    manifest_target = destination / MANIFEST
    manifest_target.write_bytes(canonical_json(manifest))
    manifest_target.chmod(0o644)
    return {
        "commit": commit,
        "destination": str(destination),
        "files": len(payloads),
        "sha256": expected_sha,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    pack = subparsers.add_parser("pack")
    pack.add_argument("--archive", required=True, type=Path)
    pack.add_argument("--commit", required=True)
    pack.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    verify = subparsers.add_parser("verify")
    verify.add_argument("--archive", required=True, type=Path)
    verify.add_argument("--sha256", required=True)
    verify.add_argument("--commit", required=True)
    verify.add_argument("--extract-to", type=Path)
    args = parser.parse_args()

    if args.command == "pack":
        result = write_bundle(args.archive, args.commit, verify_git_source(args.root.resolve(), args.commit))
    elif args.extract_to:
        result = extract_verified(args.archive, args.sha256, args.commit, args.extract_to)
    else:
        payloads, _ = verified_payloads(args.archive, args.sha256, args.commit)
        result = {"commit": args.commit, "files": len(payloads), "sha256": args.sha256}
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
