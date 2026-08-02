#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
unit_dest="${UNIT_DEST:-/etc/systemd/system/cofoundry-app.service}"
env_dest="${ENV_DEST:-/etc/cofoundry/app.env}"
dry_run=false
force_env=false

usage() {
  cat <<'USAGE'
Install the direct CoFoundry application systemd unit without starting it.

Usage:
  install-app-unit.sh [--dry-run] [--force-env]

Options:
  --dry-run    Print the commands without changing the host.
  --force-env  Replace the target app env file from the fail-closed example.

Environment overrides:
  UNIT_DEST=/etc/systemd/system/cofoundry-app.service
  ENV_DEST=/etc/cofoundry/app.env
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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

run() {
  if [[ "$dry_run" == true ]]; then
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

run install -D -m 0644 "$script_dir/cofoundry-app.service" "$unit_dest"

if [[ "$force_env" == true || ! -e "$env_dest" ]]; then
  run install -D -m 0600 "$script_dir/cofoundry-app.env.example" "$env_dest"
else
  echo "Keeping existing $env_dest. Use --force-env only when replacing it intentionally."
fi

run systemctl daemon-reload
echo "Review $env_dest, promote a validated release, then run: systemctl enable --now cofoundry-app.service"
