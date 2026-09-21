"""Exercise the installed promoter as synthetic root with fake host services."""

import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tarfile


assert os.geteuid() == 0
SOURCE = Path("/source")
STUB = r'''#!/usr/bin/python3
import json, os, pathlib, signal, sys
root = pathlib.Path(os.environ["FIXTURE_ROOT"])
mode = os.environ["FIXTURE_MODE"]
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
current = root / "current"
candidate = current.is_symlink() and current.resolve().name == "candidate"
def once(key):
    marker = root / key
    if marker.exists(): return False
    marker.touch()
    return True
if name == "sleep": sys.exit(0)
if name == "nginx": sys.exit(0)
if name == "systemctl":
    if args[0] == "is-active": sys.exit(0 if current.is_symlink() else 3)
    if args[0] == "restart" and candidate and mode == "interrupt" and once("interrupted"):
        os.kill(os.getppid(), signal.SIGTERM)
    if args[0] == "restart" and not candidate and mode == "rollback-failure": sys.exit(1)
    sys.exit(0)
if name == "curl":
    if candidate and mode in {"bad-health", "first-failure", "rollback-failure"}: sys.exit(22)
    url = next(value for value in args if value.startswith(("http://", "https://")))
    output = pathlib.Path(args[args.index("--output") + 1])
    if "--dump-header" in args:
        pathlib.Path(args[args.index("--dump-header") + 1]).write_text("Cache-Control: no-store\n")
    if "--head" not in args and output != pathlib.Path("/dev/null"):
        if url.endswith("/api/health"):
            identity = json.loads((current / ".cofoundry-release-prepared.json").read_text())
            output.write_text(json.dumps({"deployment": identity}))
        else:
            output.write_text('{"ok":true}')
    sys.exit(0)
raise SystemExit(f"Unexpected fixture command: {name}")
'''


def load_artifact(control):
    os.environ["COFOUNDRY_RUNTIME_CONTRACT"] = str(control / "runtime-artifact.json")
    spec = importlib.util.spec_from_file_location("artifact", control / "runtime-artifact.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_control_bundle():
    spec = importlib.util.spec_from_file_location(
        "host_control_bundle", SOURCE / "scripts/host-control-bundle.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def make_release(root, artifact, name, commit, version):
    release = root / "releases" / name
    release.mkdir(parents=True)
    for required in artifact.CONTRACT["required"]:
        path = release / required
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("synthetic runtime file\n")

    root_package = {"name": "cofoundry-monorepo", "version": version, "workspaces": ["front-end", "back-end"]}
    frontend = {"name": "front-end", "version": version}
    backend = {"name": "back-end", "version": version, "dependencies": {"@supabase/supabase-js": "2.112.2"}}
    server_package = {"name": "front-end-prod", "version": version, "dependencies": {}}
    dependency = {"name": "@supabase/supabase-js", "version": "2.112.2"}
    lock = {
        "name": "cofoundry-monorepo",
        "version": version,
        "lockfileVersion": 3,
        "packages": {
            "": root_package,
            "back-end": backend,
            "front-end": frontend,
            "node_modules/@supabase/supabase-js": {"version": "2.112.2"},
        },
    }
    values = {
        "package.json": root_package,
        "package-lock.json": lock,
        "front-end/package.json": frontend,
        "back-end/package.json": backend,
        "front-end/.output/server/package.json": server_package,
        "node_modules/@supabase/supabase-js/package.json": dependency,
        artifact.IDENTITY: {
            "commitSha": commit,
            "deployedAt": "2026-09-20T00:00:00Z",
            "release": f"v{version}",
        },
    }
    for relative, value in values.items():
        (release / relative).write_text(json.dumps(value) + "\n")
    for directory in release.rglob("*"):
        if directory.is_dir(): directory.chmod(0o755)
    for file in release.rglob("*"):
        if file.is_file(): file.chmod(0o644)
    manifest = {
        "commit": commit,
        "contractSha256": artifact.contract_digest(),
        "contractVersion": artifact.CONTRACT["version"],
        "files": artifact.inventory(release),
        "format": 1,
    }
    (release / artifact.MANIFEST).write_text(json.dumps(manifest) + "\n")
    archive = root / f"{name}.tar.gz"
    with tarfile.open(archive, "w:gz") as target:
        for relative in sorted([artifact.MANIFEST, *manifest["files"]]):
            target.add(release / relative, arcname=relative, recursive=False)
    return release, archive, hashlib.sha256(archive.read_bytes()).hexdigest()


def setup(root):
    root.mkdir(parents=True, mode=0o755)
    control = root / "control"
    control.mkdir(mode=0o755)
    for source, destination, mode in [
        (SOURCE / "deploy/systemd/promote-release.sh", control / "promote-release.sh", 0o755),
        (SOURCE / "deploy/systemd/trusted-paths.py", control / "trusted-paths.py", 0o755),
        (SOURCE / "deploy/runtime-artifact.json", control / "runtime-artifact.json", 0o644),
        (SOURCE / "scripts/runtime-artifact.py", control / "runtime-artifact.py", 0o755),
    ]:
        shutil.copy2(source, destination)
        destination.chmod(mode)
    artifact = load_artifact(control)
    candidate = make_release(root, artifact, "candidate", "a" * 40, "1.2.1")
    previous = make_release(root, artifact, "previous", "b" * 40, "1.2.0")
    (root / "current").symlink_to(previous[0])
    recovery = root / ".deployment-recovery"
    recovery.mkdir(mode=0o700)
    return control, candidate, previous, recovery


Path("/fixture/runtime").mkdir(parents=True)
shutil.copy2("/runtime/node", "/fixture/runtime/node")
Path("/fixture/runtime/node").chmod(0o755)
Path("/usr/local/bin").mkdir(parents=True)
for command in ["curl", "nginx", "sleep", "systemctl"]:
    path = Path("/usr/local/bin") / command
    path.write_text(STUB)
    path.chmod(0o755)

modes = [
    "success",
    "bad-health",
    "interrupt",
    "rollback-failure",
    "lock-contention",
    "tampered-candidate",
    "mutable-candidate",
    "wrong-digest",
    "missing-rollback-evidence",
    "tampered-rollback",
    "first-success",
    "first-failure",
]
if len(sys.argv) > 1 and sys.argv[1] != "all":
    if sys.argv[1] == "control-installer":
        modes = []
    else:
        assert sys.argv[1] in modes
        modes = [sys.argv[1]]

for mode in modes:
    root = Path("/fixture") / mode
    control, candidate, previous, recovery = setup(root)
    candidate_tree, candidate_archive, candidate_sha = candidate
    previous_tree, previous_archive, previous_sha = previous
    if mode.startswith("first-"):
        (root / "current").unlink()
    if mode == "tampered-candidate":
        (candidate_tree / "back-end/dist/server.js").write_text("tampered\n")
    if mode == "mutable-candidate":
        (candidate_tree / "back-end/dist/server.js").chmod(0o666)
    if mode == "wrong-digest":
        candidate_sha = "0" * 64
    if mode == "tampered-rollback":
        (previous_tree / "back-end/dist/server.js").write_text("tampered\n")

    lock = None
    if mode == "lock-contention":
        lock = (recovery / "promotion.lock").open("w")
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)

    environment = {
        **os.environ,
        "CURRENT_LINK": str(root / "current"),
        "FIXTURE_MODE": mode,
        "FIXTURE_ROOT": str(root),
        "NODE_BIN_DIR": "/fixture/runtime",
        "RELEASE_ROOT": str(root / "releases"),
        "ROLLBACK_ARCHIVE": str(previous_archive),
        "ROLLBACK_COMMIT": "b" * 40,
        "ROLLBACK_SHA256": previous_sha,
    }
    if mode == "missing-rollback-evidence":
        environment.pop("ROLLBACK_ARCHIVE")
        environment.pop("ROLLBACK_COMMIT")
        environment.pop("ROLLBACK_SHA256")

    command = [
        "bash",
        str(control / "promote-release.sh"),
        str(candidate_tree),
        str(candidate_archive),
        candidate_sha,
        "a" * 40,
    ]
    try:
        result = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=15)
    finally:
        if lock: lock.close()
    evidence = result.stdout + result.stderr
    success = mode in {"success", "first-success"}
    assert (result.returncode == 0) == success, (mode, evidence)
    if mode == "first-failure":
        assert not (root / "current").exists(), evidence
    else:
        expected = candidate_tree if success else previous_tree
        assert (root / "current").resolve() == expected, (mode, evidence)
    records = list(recovery.glob("promotion-????????"))
    if mode == "rollback-failure":
        assert len(records) == 1 and "protected record retained" in evidence, evidence
        assert stat.S_IMODE(records[0].stat().st_mode) == 0o600
        record = json.loads(records[0].read_text())
        assert record["format"] == 1 and record["state"] == "rollback_failed", record
        assert record["candidate"] == {
            "archive": str(candidate_archive),
            "archiveSha256": candidate_sha,
            "commit": "a" * 40,
            "target": str(candidate_tree),
        }, record
        assert record["rollback"] == {
            "archive": str(previous_archive),
            "archiveSha256": previous_sha,
            "commit": "b" * 40,
            "target": str(previous_tree),
        }, record
        assert record["startedAt"].endswith("Z") and record["updatedAt"], record
    else:
        assert not records, (mode, evidence)
    if mode == "interrupt":
        assert result.returncode == 143 and (root / "interrupted").exists(), evidence
    print(json.dumps({"promotionRecovery": mode, "result": "passed"}), flush=True)


if len(sys.argv) == 1 or sys.argv[1] in {"all", "control-installer"}:
    root = Path("/fixture/control-installer")
    root.mkdir(parents=True)
    (root / "tmp").mkdir()
    control_bundle = load_control_bundle()
    payloads = {
        name: (SOURCE / name).read_bytes()
        for name in control_bundle.FILES
    }
    archive = root / "controls-v1.tar.gz"
    receipt = control_bundle.write_bundle(archive, "c" * 40, payloads)
    host = root / "host"
    environment = {
        **os.environ,
        "ENV_DEST": str(host / "etc/cofoundry/app.env"),
        "HELPER_DEST": str(host / "usr/local/libexec/cofoundry"),
        "LOCK_FILE": str(root / "control-install.lock"),
        "SYSTEMCTL_BIN": "/usr/local/bin/systemctl",
        "TMPDIR": str(root / "tmp"),
        "UNIT_DEST": str(host / "etc/systemd/system/cofoundry-app.service"),
    }
    command = [
        "bash",
        str(SOURCE / "deploy/systemd/install-app-unit.sh"),
        "--bundle", str(archive),
        "--sha256", receipt["sha256"],
        "--commit", "c" * 40,
    ]
    result = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=15)
    assert result.returncode == 0, result.stdout + result.stderr
    helper = host / "usr/local/libexec/cofoundry"
    current = helper / "current"
    unit = host / "etc/systemd/system/cofoundry-app.service"
    env_file = host / "etc/cofoundry/app.env"
    assert current.is_symlink() and current.resolve().name == receipt["sha256"]
    assert unit.is_symlink() and unit.resolve() == current.resolve() / "cofoundry-app.service"
    assert stat.S_IMODE(env_file.stat().st_mode) == 0o600
    assert (current / "promote-release.sh").is_file()
    assert (current / "runtime-artifact.py").is_file()
    assert (current / "control-manifest.json").is_file()

    failed = subprocess.run(
        [*command[:-3], "0" * 64, *command[-2:]],
        env=environment,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert failed.returncode != 0 and current.resolve().name == receipt["sha256"]

    second_archive = root / "controls-v2.tar.gz"
    second = control_bundle.write_bundle(second_archive, "d" * 40, payloads)
    upgraded = subprocess.run(
        [
            "bash", str(SOURCE / "deploy/systemd/install-app-unit.sh"),
            "--bundle", str(second_archive),
            "--sha256", second["sha256"],
            "--commit", "d" * 40,
        ],
        env=environment,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert upgraded.returncode == 0, upgraded.stdout + upgraded.stderr
    assert current.resolve().name == second["sha256"]
    assert (helper / "bundles" / receipt["sha256"]).is_dir()
    assert unit.resolve() == current.resolve() / "cofoundry-app.service"
    print(json.dumps({"controlInstaller": "immutable-bundle-activation", "result": "passed"}), flush=True)
