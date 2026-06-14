#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

unit_dest="${UNIT_DEST:-/etc/systemd/system}"
env_dest="${ENV_DEST:-/etc/cofoundry/operations.env}"
dry_run=false
enable_timers=true
force_env=false
include_restore_drill=false

usage() {
  cat <<'USAGE'
Install CoFoundry operations systemd units.

Usage:
  install-operations-units.sh [--dry-run] [--no-enable] [--force-env] [--enable-restore-drill]

Options:
  --dry-run                 Print the commands without changing the host.
  --no-enable               Install units and reload systemd, but do not enable timers.
  --force-env               Replace the target operations env file from the example.
  --enable-restore-drill    Also enable the monthly restore-drill timer.

Environment overrides:
  UNIT_DEST=/etc/systemd/system
  ENV_DEST=/etc/cofoundry/operations.env
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=true
      ;;
    --no-enable)
      enable_timers=false
      ;;
    --force-env)
      force_env=true
      ;;
    --enable-restore-drill)
      include_restore_drill=true
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
    printf '+'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi

  "$@"
}

copy_file() {
  local mode="$1"
  local source="$2"
  local dest="$3"

  run install -D -m "$mode" "$source" "$dest"
}

unit_files=(
  "$script_dir"/cofoundry-operations-*.service
  "$script_dir"/cofoundry-operations-*.timer
)

timers=(
  cofoundry-operations-heartbeat.timer
  cofoundry-operations-digest.timer
  cofoundry-operations-scan.timer
  cofoundry-operations-backup.timer
)

if [[ "$include_restore_drill" == true ]]; then
  timers+=(cofoundry-operations-restore-drill.timer)
fi

for unit_file in "${unit_files[@]}"; do
  copy_file 0644 "$unit_file" "$unit_dest/$(basename "$unit_file")"
done

if [[ "$force_env" == true || ! -e "$env_dest" ]]; then
  copy_file 0600 "$script_dir/cofoundry-operations.env.example" "$env_dest"
else
  echo "Keeping existing $env_dest. Use --force-env to replace it from the example."
fi

run systemctl daemon-reload

if [[ "$enable_timers" == true ]]; then
  run systemctl enable --now "${timers[@]}"
  run systemctl list-timers "cofoundry-operations-*.timer" --no-pager
else
  echo "Timer enable skipped. Start with: systemctl enable --now ${timers[*]}"
fi

echo "Review $env_dest before relying on provider-backed operations."
