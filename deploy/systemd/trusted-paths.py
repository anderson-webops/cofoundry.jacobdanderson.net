#!/usr/bin/env python3
"""Reject mutable administrative inputs. Install this helper as root before use."""

import argparse
import os
from pathlib import Path
import stat


def protected(path, tree=False, trusted_uid=0, boundary=None):
    raw = os.fspath(path)
    if not os.path.isabs(raw) or any(part in (".", "..") for part in raw.split(os.sep)):
        raise ValueError(f"administrative input must be absolute without dot components: {raw}")
    path = Path(raw)
    boundary_path = Path(boundary) if boundary else None

    parents = [path, *path.parents]
    if boundary_path:
        if boundary_path != path and boundary_path not in path.parents:
            raise ValueError(f"boundary does not contain administrative input: {boundary_path}")
        parents = parents[:parents.index(boundary_path) + 1]

    for item in parents:
        metadata = item.lstat()
        if stat.S_ISLNK(metadata.st_mode) or metadata.st_uid != trusted_uid or metadata.st_mode & 0o022:
            raise ValueError(f"administrative input is not protected: {item}")
        if not (stat.S_ISDIR(metadata.st_mode) or stat.S_ISREG(metadata.st_mode)):
            raise ValueError(f"administrative input has an unsafe type: {item}")

    if tree:
        for item in path.rglob("*"):
            metadata = item.lstat()
            unsafe_file = stat.S_ISREG(metadata.st_mode) and metadata.st_nlink != 1
            if (stat.S_ISLNK(metadata.st_mode) or metadata.st_uid != trusted_uid
                    or metadata.st_mode & 0o022 or unsafe_file
                    or not (stat.S_ISDIR(metadata.st_mode) or stat.S_ISREG(metadata.st_mode))):
                raise ValueError(f"release tree is not protected: {item}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tree", action="append", default=[])
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit("administrative path validation requires root")
    for path in args.paths:
        protected(path)
    for path in args.tree:
        protected(path, tree=True)


if __name__ == "__main__":
    main()
