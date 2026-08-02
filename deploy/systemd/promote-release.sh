#!/usr/bin/env bash
set -euo pipefail
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH

release_root="${RELEASE_ROOT:-/srv/cofoundry/releases}"
current_link="${CURRENT_LINK:-/srv/cofoundry/current}"
service_name="${SERVICE_NAME:-cofoundry-app.service}"
health_url="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

if [[ $# -ne 1 ]]; then
  echo "Usage: promote-release.sh /srv/cofoundry/releases/<validated-release>" >&2
  exit 2
fi

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run this promotion with root privileges so systemd and the shared symlink can be updated." >&2
  exit 1
fi

release_root_real="$(realpath -e -- "$release_root")"
candidate="$(realpath -e -- "$1")"

case "$candidate/" in
  "$release_root_real/"*) ;;
  *)
    echo "Candidate must resolve beneath $release_root_real: $candidate" >&2
    exit 1
    ;;
esac

if [[ ! -f "$candidate/front-end/.output/server/index.mjs" ]]; then
  echo "Candidate is missing the built Nuxt server entry: $candidate/front-end/.output/server/index.mjs" >&2
  exit 1
fi

if [[ -e "$current_link" && ! -L "$current_link" ]]; then
  echo "Refusing to replace non-symlink deployment path: $current_link" >&2
  exit 1
fi

previous_target="$(readlink -f -- "$current_link" 2>/dev/null || true)"
next_link="${current_link}.next.$$"

cleanup() {
  if [[ -L "$next_link" ]]; then
    unlink -- "$next_link"
  fi
}
trap cleanup EXIT

activate_target() {
  local target="$1"
  ln -s -- "$target" "$next_link"
  mv -Tf -- "$next_link" "$current_link"
}

wait_for_health() {
  local attempt
  for attempt in {1..20}; do
    if curl --fail --silent --show-error --max-time 5 "$health_url" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

activate_target "$candidate"
systemctl restart "$service_name"

if wait_for_health; then
  echo "Promoted $candidate and verified $health_url."
  exit 0
fi

echo "Health verification failed for $candidate; restoring the previous release." >&2
if [[ -n "$previous_target" ]]; then
  activate_target "$previous_target"
  systemctl restart "$service_name"
  if ! wait_for_health; then
    echo "Previous release was restored, but its health check also failed." >&2
  fi
else
  unlink -- "$current_link"
  systemctl stop "$service_name"
fi

exit 1
