#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
umask 077

unit_dest="${UNIT_DEST:-/etc/systemd/system/cofoundry-app.service}"
env_dest="${ENV_DEST:-/etc/cofoundry/app.env}"
helper_dest="${HELPER_DEST:-/usr/local/libexec/cofoundry}"
lock_file="${LOCK_FILE:-/run/lock/cofoundry-control-install.lock}"
systemctl_bin="${SYSTEMCTL_BIN:-systemctl}"
bundle=""
bundle_sha=""
commit=""
dry_run=false
force_env=false

usage() {
  cat <<'USAGE'
Install one reviewed, immutable CoFoundry host-control bundle without starting it.

Usage:
  install-app-unit.sh --bundle <archive> --sha256 <digest> --commit <commit> [options]

Required:
  --bundle     Protected host-control archive produced by package:runtime.
  --sha256     Independently reviewed SHA-256 for that archive.
  --commit     Exact 40-character source commit in the archive manifest.

Options:
  --dry-run    Verify and stage the bundle, then print permanent mutations.
  --force-env  Replace the target app env file from the fail-closed example.

Environment overrides:
  UNIT_DEST=/etc/systemd/system/cofoundry-app.service
  ENV_DEST=/etc/cofoundry/app.env
  HELPER_DEST=/usr/local/libexec/cofoundry
  LOCK_FILE=/run/lock/cofoundry-control-install.lock
  SYSTEMCTL_BIN=systemctl
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle)
      bundle="${2:-}"
      shift
      ;;
    --sha256)
      bundle_sha="${2:-}"
      shift
      ;;
    --commit)
      commit="${2:-}"
      shift
      ;;
    --dry-run)
      dry_run=true
      ;;
    --force-env)
      force_env=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ -z "$bundle" || ! "$bundle_sha" =~ ^[0-9a-f]{64}$ || ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  usage >&2
  exit 2
fi
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run the control-bundle installer with root privileges." >&2
  exit 1
fi
if [[ ! -f "$bundle" || -L "$bundle" ]]; then
  echo "Control bundle must be one regular file." >&2
  exit 1
fi

stage_root="$(mktemp -d "${TMPDIR:-/tmp}/cofoundry-control-install.XXXXXXXX")"
next_bundle=""
cleanup() {
  if [[ -n "$next_bundle" ]]; then
    case "$next_bundle" in
      "$helper_dest/bundles/.next-"*) rm -rf -- "$next_bundle" ;;
      *) echo "Refusing to remove unexpected installer staging path: $next_bundle" >&2 ;;
    esac
  fi
  rm -rf -- "$stage_root"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

staged_archive="$stage_root/control-bundle.tar.gz"
install -o root -g root -m 0600 "$bundle" "$staged_archive"
actual_sha="$(sha256sum "$staged_archive" | cut -d ' ' -f 1)"
if [[ "$actual_sha" != "$bundle_sha" ]]; then
  echo "Copied control bundle does not match the independently reviewed SHA-256." >&2
  exit 1
fi

# Extract only the verifier from the already root-owned, digest-bound snapshot.
verifier="$stage_root/host-control-bundle.py"
/usr/bin/python3 -I - "$staged_archive" "$verifier" <<'PY'
import pathlib
import sys
import tarfile

archive = pathlib.Path(sys.argv[1])
destination = pathlib.Path(sys.argv[2])
expected = "scripts/host-control-bundle.py"
with tarfile.open(archive, "r:gz") as source:
    matches = [member for member in source.getmembers() if member.name == expected]
    if len(matches) != 1 or not matches[0].isreg() or matches[0].size > 2 * 1024 * 1024:
        raise SystemExit("Control archive does not contain one safe verifier.")
    extracted = source.extractfile(matches[0])
    if extracted is None:
        raise SystemExit("Control verifier is unreadable.")
    value = extracted.read(2 * 1024 * 1024 + 1)
    if len(value) != matches[0].size:
        raise SystemExit("Control verifier size does not match.")
destination.write_bytes(value)
destination.chmod(0o700)
PY

verified="$stage_root/verified"
/usr/bin/python3 -I "$verifier" verify \
  --archive "$staged_archive" --sha256 "$bundle_sha" --commit "$commit" --extract-to "$verified" \
  > "$stage_root/verification.json"

run() {
  if [[ "$dry_run" == true ]]; then
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

bundle_dest="$helper_dest/bundles/$bundle_sha"
current_dest="$helper_dest/current"
unit_target="$helper_dest/current/cofoundry-app.service"

if [[ "$dry_run" == true ]]; then
  echo "Control bundle verified from one root-owned snapshot; planned mutations:"
  run install -o root -g root -d -m 0755 "$helper_dest" "$helper_dest/bundles" "$(dirname -- "$unit_dest")" "$(dirname -- "$env_dest")"
  run install -o root -g root -d -m 0755 "$bundle_dest"
  run ln -s "bundles/$bundle_sha" "$current_dest"
  run ln -s "$unit_target" "$unit_dest"
  if [[ "$force_env" == true || ! -e "$env_dest" ]]; then
    run install -o root -g root -m 0600 "$verified/deploy/systemd/cofoundry-app.env.example" "$env_dest"
  else
    echo "Keeping existing $env_dest. Use --force-env only when replacing it intentionally."
  fi
  run "$systemctl_bin" daemon-reload
  exit 0
fi

/usr/bin/python3 -I "$verified/deploy/systemd/trusted-paths.py" "$(dirname -- "$lock_file")"
exec 8>"$lock_file"
if ! flock -n 8; then
  echo "Another CoFoundry control-bundle installation is active." >&2
  exit 1
fi

install -o root -g root -d -m 0755 \
  "$helper_dest" "$helper_dest/bundles" "$(dirname -- "$unit_dest")" "$(dirname -- "$env_dest")"
/usr/bin/python3 -I "$verified/deploy/systemd/trusted-paths.py" \
  "$helper_dest" "$helper_dest/bundles" "$(dirname -- "$unit_dest")" "$(dirname -- "$env_dest")"

next_bundle="$helper_dest/bundles/.next-$bundle_sha-$$"
install -o root -g root -d -m 0755 "$next_bundle"
install -o root -g root -m 0755 "$verified/deploy/systemd/install-app-unit.sh" "$next_bundle/install-app-unit.sh"
install -o root -g root -m 0755 "$verified/deploy/systemd/promote-release.sh" "$next_bundle/promote-release.sh"
install -o root -g root -m 0755 "$verified/deploy/systemd/trusted-paths.py" "$next_bundle/trusted-paths.py"
install -o root -g root -m 0755 "$verified/scripts/host-control-bundle.py" "$next_bundle/host-control-bundle.py"
install -o root -g root -m 0755 "$verified/scripts/runtime-artifact.py" "$next_bundle/runtime-artifact.py"
install -o root -g root -m 0644 "$verified/deploy/runtime-artifact.json" "$next_bundle/runtime-artifact.json"
install -o root -g root -m 0644 "$verified/deploy/systemd/cofoundry-app.service" "$next_bundle/cofoundry-app.service"
install -o root -g root -m 0644 "$verified/deploy/systemd/cofoundry-app.env.example" "$next_bundle/cofoundry-app.env.example"
install -o root -g root -m 0644 "$verified/control-manifest.json" "$next_bundle/control-manifest.json"
/usr/bin/python3 -I "$next_bundle/trusted-paths.py" --tree "$next_bundle"

if [[ -e "$bundle_dest" ]]; then
  /usr/bin/python3 -I "$verified/deploy/systemd/trusted-paths.py" --tree "$bundle_dest"
  /usr/bin/python3 -I - "$next_bundle" "$bundle_dest" <<'PY'
from pathlib import Path
import hashlib
import stat
import sys

def inventory(root):
    result = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        metadata = path.lstat()
        if path.is_dir():
            result[relative] = ("dir", stat.S_IMODE(metadata.st_mode))
        elif path.is_file() and metadata.st_nlink == 1:
            result[relative] = ("file", stat.S_IMODE(metadata.st_mode), hashlib.sha256(path.read_bytes()).hexdigest())
        else:
            raise SystemExit(f"Unsafe installed control path: {path}")
    return result

if inventory(Path(sys.argv[1])) != inventory(Path(sys.argv[2])):
    raise SystemExit("Existing digest-named control bundle is not identical.")
PY
else
  mv -T -- "$next_bundle" "$bundle_dest"
  next_bundle=""
fi

if [[ -e "$current_dest" && ! -L "$current_dest" ]]; then
  echo "Refusing to replace non-symlink control activation path: $current_dest" >&2
  exit 1
fi
if [[ -e "$unit_dest" || -L "$unit_dest" ]]; then
  if [[ -L "$unit_dest" ]]; then
    if [[ "$(readlink -- "$unit_dest")" != "$unit_target" ]]; then
      echo "Refusing to replace an unexpected application unit symlink: $unit_dest" >&2
      exit 1
    fi
  elif ! cmp -s -- "$unit_dest" "$bundle_dest/cofoundry-app.service"; then
    echo "Existing application unit differs from the reviewed control bundle." >&2
    exit 1
  fi
fi
if [[ -e "$env_dest" && ( -L "$env_dest" || "$(stat -c '%u' "$env_dest")" != 0 || $(( 8#$(stat -c '%a' "$env_dest") & 8#077 )) -ne 0 ) ]]; then
  echo "Existing application environment file is not protected." >&2
  exit 1
fi

current_next="$helper_dest/.current.next.$$"
unit_next="${unit_dest}.next.$$"
ln -s "bundles/$bundle_sha" "$current_next"
ln -s "$unit_target" "$unit_next"
mv -Tf -- "$current_next" "$current_dest"
mv -Tf -- "$unit_next" "$unit_dest"

if [[ "$force_env" == true || ! -e "$env_dest" ]]; then
  env_next="${env_dest}.next.$$"
  install -o root -g root -m 0600 "$bundle_dest/cofoundry-app.env.example" "$env_next"
  mv -Tf -- "$env_next" "$env_dest"
else
  echo "Keeping existing $env_dest. Use --force-env only when replacing it intentionally."
fi

"$systemctl_bin" daemon-reload
echo "Activated verified controls at $current_dest. Review $env_dest, promote a validated release, then run: systemctl enable --now cofoundry-app.service"
