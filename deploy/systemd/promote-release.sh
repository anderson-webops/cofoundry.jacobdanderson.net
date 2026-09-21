#!/usr/bin/env bash
set -euo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH
unset NODE_OPTIONS NODE_PATH PYTHONHOME PYTHONPATH
umask 077

release_root="${RELEASE_ROOT:-/srv/cofoundry/releases}"
current_link="${CURRENT_LINK:-/srv/cofoundry/current}"
service_name="${SERVICE_NAME:-cofoundry-app.service}"
health_url="${HEALTH_URL:-http://127.0.0.1:3000/healthz}"
readiness_url="${READINESS_URL:-http://127.0.0.1:3000/readyz}"
identity_url="${IDENTITY_URL:-http://127.0.0.1:3000/api/health}"
node_bin_dir="${NODE_BIN_DIR:-/opt/node-24.18.1/bin}"
node="$node_bin_dir/node"

if [[ $# -ne 4 ]]; then
  cat >&2 <<'USAGE'
Usage: promote-release.sh <protected-release> <protected-archive> <sha256> <commit>

When a current release exists, also pass its independently retained evidence:
  ROLLBACK_ARCHIVE=/protected/previous.tar.gz
  ROLLBACK_SHA256=<64 lowercase hex characters>
  ROLLBACK_COMMIT=<40 lowercase hex characters>
USAGE
  exit 2
fi
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run promotion with root privileges." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
promoter="$script_dir/promote-release.sh"
trusted_paths="$script_dir/trusted-paths.py"
artifact_verifier="$script_dir/runtime-artifact.py"
artifact_contract="$script_dir/runtime-artifact.json"
candidate_input="$1"
archive="$2"
archive_sha="$3"
commit="$4"

if [[ ! "$archive_sha" =~ ^[0-9a-f]{64}$ || ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Pass the independently reviewed archive digest and exact source commit." >&2
  exit 1
fi
if [[ ! -x "$node" || "$("$node" --version)" != v24.18.1 ]]; then
  echo "NODE_BIN_DIR must select the approved Node 24.18.1 runtime." >&2
  exit 1
fi

/usr/bin/python3 -I "$trusted_paths" \
  "$promoter" "$trusted_paths" "$artifact_verifier" "$artifact_contract" \
  "$node" "$archive" "$release_root" "$(dirname -- "$current_link")" \
  --tree "$candidate_input"

release_root_real="$(cd -- "$release_root" && pwd -P)"
candidate="$(cd -- "$candidate_input" && pwd -P)"
case "$candidate/" in
  "$release_root_real/"*) ;;
  *) echo "Candidate must resolve beneath $release_root_real: $candidate" >&2; exit 1 ;;
esac
if [[ "$candidate" == "$release_root_real" ]]; then
  echo "Candidate must be an immutable child of the release directory." >&2
  exit 1
fi
if [[ ! -f "$candidate/runtime-manifest.json" || ! -f "$candidate/.cofoundry-release-prepared.json" ]]; then
  echo "Candidate is missing its runtime manifest or release identity." >&2
  exit 1
fi

export COFOUNDRY_RUNTIME_CONTRACT="$artifact_contract"
/usr/bin/python3 -I "$artifact_verifier" verify "$candidate" \
  --archive "$archive" --sha256 "$archive_sha" --commit "$commit"

if [[ -e "$current_link" && ! -L "$current_link" ]]; then
  echo "Refusing to replace non-symlink deployment path: $current_link" >&2
  exit 1
fi
if ! nginx -t; then
  echo "Nginx configuration must pass before promotion." >&2
  exit 1
fi

recovery_root="$(dirname -- "$current_link")/.deployment-recovery"
if [[ ! -e "$recovery_root" ]]; then
  mkdir -m 0700 -- "$recovery_root"
fi
/usr/bin/python3 -I "$trusted_paths" "$recovery_root"
if [[ "$(stat -c '%a' "$recovery_root")" != 700 ]]; then
  echo "Deployment recovery directory must have mode 0700." >&2
  exit 1
fi
exec 9>"$recovery_root/promotion.lock"
if ! flock -n 9; then
  echo "Another CoFoundry promotion is active." >&2
  exit 1
fi

previous_target=""
rollback_archive="${ROLLBACK_ARCHIVE:-}"
rollback_sha="${ROLLBACK_SHA256:-}"
rollback_commit="${ROLLBACK_COMMIT:-}"
if [[ -L "$current_link" ]]; then
  previous_target="$(readlink -f -- "$current_link" 2>/dev/null || true)"
  if [[ -z "$previous_target" ]]; then
    echo "Existing deployment symlink does not resolve." >&2
    exit 1
  fi
  case "$previous_target/" in
    "$release_root_real/"*) ;;
    *) echo "Existing deployment target is outside $release_root_real." >&2; exit 1 ;;
  esac
  if [[ "$previous_target" == "$release_root_real" || "$previous_target" == "$candidate" ]]; then
    echo "Rollback target must be a distinct immutable release." >&2
    exit 1
  fi
  if [[ -z "$rollback_archive" || ! "$rollback_sha" =~ ^[0-9a-f]{64}$ || ! "$rollback_commit" =~ ^[0-9a-f]{40}$ ]]; then
    echo "A current release requires ROLLBACK_ARCHIVE, ROLLBACK_SHA256, and ROLLBACK_COMMIT." >&2
    exit 1
  fi
  /usr/bin/python3 -I "$trusted_paths" "$rollback_archive" --tree "$previous_target"
  /usr/bin/python3 -I "$artifact_verifier" verify "$previous_target" \
    --archive "$rollback_archive" --sha256 "$rollback_sha" --commit "$rollback_commit"
elif systemctl is-active --quiet "$service_name"; then
  echo "An active service without a verified current release needs operator review." >&2
  exit 1
fi

next_link="${current_link}.next.$$"
response_probe="$(mktemp)"
response_identity="$(mktemp)"
headers="$(mktemp)"
recovery_record="$(mktemp "$recovery_root/promotion-XXXXXXXX")"
promotion_started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mutation_started=false
finished=false
rollback_failed=false

write_recovery_record() {
  local state="$1"
  /usr/bin/python3 -I - \
    "$recovery_record" "$state" "$promotion_started_at" \
    "$candidate" "$archive" "$archive_sha" "$commit" \
    "$previous_target" "$rollback_archive" "$rollback_sha" "$rollback_commit" <<'PY'
import datetime
import json
from pathlib import Path
import sys

(record, state, started_at, candidate_target, candidate_archive,
 candidate_sha, candidate_commit, rollback_target, rollback_archive,
 rollback_sha, rollback_commit) = sys.argv[1:]
payload = {
    "candidate": {
        "archive": candidate_archive,
        "archiveSha256": candidate_sha,
        "commit": candidate_commit,
        "target": candidate_target,
    },
    "format": 1,
    "rollback": {
        "archive": rollback_archive,
        "archiveSha256": rollback_sha,
        "commit": rollback_commit,
        "target": rollback_target,
    },
    "startedAt": started_at,
    "state": state,
    "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
}
target = Path(record)
target.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
target.chmod(0o600)
PY
}

write_recovery_record "promotion_started"

activate_target() {
  local target="$1"
  if [[ -L "$next_link" ]]; then unlink -- "$next_link"; fi
  ln -s -- "$target" "$next_link"
  mv -Tf -- "$next_link" "$current_link"
}

probe_is_minimal() {
  "$node" -e '
const fs = require("node:fs")
const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
if (JSON.stringify(body) !== JSON.stringify({ ok: true })) process.exit(1)
' "$1"
}

identity_matches() {
  "$node" -e '
const fs = require("node:fs")
const expected = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
const actual = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))?.deployment
if (!actual || expected.release !== actual.release || expected.commitSha !== actual.commitSha
    || expected.deployedAt !== actual.deployedAt) process.exit(1)
' "$1" "$2"
}

head_is_safe() {
  local url="$1"
  : > "$headers"
  curl --noproxy '*' --fail --silent --show-error --max-time 5 --head \
    --dump-header "$headers" --output /dev/null "$url" \
    && grep -Eiq '^cache-control:[[:space:]]*no-store' "$headers" \
    && ! grep -Eiq '^(set-cookie|location|www-authenticate):' "$headers"
}

wait_for_target() {
  local target="$1"
  local marker="$target/.cofoundry-release-prepared.json"
  local attempt
  for attempt in {1..40}; do
    if curl --noproxy '*' --fail --silent --show-error --max-time 5 "$health_url" --output "$response_probe" \
      && probe_is_minimal "$response_probe" \
      && curl --noproxy '*' --fail --silent --show-error --max-time 5 "$readiness_url" --output "$response_probe" \
      && probe_is_minimal "$response_probe" \
      && head_is_safe "$health_url" \
      && head_is_safe "$readiness_url" \
      && curl --noproxy '*' --fail --silent --show-error --max-time 5 "$identity_url" --output "$response_identity" \
      && identity_matches "$marker" "$response_identity"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

verify_rollback() {
  /usr/bin/python3 -I "$trusted_paths" "$rollback_archive" --tree "$previous_target" \
    && /usr/bin/python3 -I "$artifact_verifier" verify "$previous_target" \
      --archive "$rollback_archive" --sha256 "$rollback_sha" --commit "$rollback_commit"
}

rollback() {
  local failed=0
  if [[ -n "$previous_target" ]]; then
    verify_rollback || failed=1
    if [[ "$failed" -eq 0 ]]; then
      activate_target "$previous_target" || failed=1
      systemctl restart "$service_name" || failed=1
      wait_for_target "$previous_target" || failed=1
    fi
  else
    if [[ -L "$current_link" ]]; then unlink -- "$current_link" || failed=1; fi
    systemctl stop "$service_name" || failed=1
  fi
  return "$failed"
}

cleanup() {
  if [[ -L "$next_link" ]]; then unlink -- "$next_link"; fi
  rm -f -- "$response_probe" "$response_identity" "$headers"
}

on_exit() {
  local status=$?
  trap - EXIT
  trap '' HUP INT TERM
  if [[ "$mutation_started" == true && "$finished" != true ]]; then
    if ! rollback; then
      rollback_failed=true
      write_recovery_record "rollback_failed" \
        || echo "CRITICAL: failed to update the protected recovery record." >&2
      echo "CRITICAL: rollback needs operator recovery; protected record retained at $recovery_record" >&2
    fi
    if [[ "$status" == 0 ]]; then status=1; fi
  fi
  cleanup
  if [[ "$rollback_failed" != true ]]; then rm -f -- "$recovery_record"; fi
  exit "$status"
}
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

mutation_started=true
activate_target "$candidate"
if systemctl restart "$service_name" && wait_for_target "$candidate"; then
  finished=true
  rm -f -- "$recovery_record"
  echo "Promoted $candidate and verified exact identity, health, and readiness."
  exit 0
fi

echo "Candidate acceptance failed; restoring the independently verified previous release." >&2
exit 1
