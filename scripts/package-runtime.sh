#!/usr/bin/env bash
# Build and accept an immutable CoFoundry production artifact on Linux ARM64.
set -euo pipefail

root=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
cd -- "$root"
test "$(uname -s)" = Linux
test "$(uname -m)" = aarch64
test "$(node --version)" = v24.18.1
test "$(npm --version)" = 12.0.2
test -z "$(git status --porcelain)"

commit=$(git rev-parse HEAD)
version=$(node -p 'require("./package.json").version')
release="v$version"
deployed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
build_only=false
if [[ "${1:-}" == --build-only ]]; then
  build_only=true
  shift
fi
output=$(realpath "${1:?Pass an empty output directory under .ai-work/runs}")
case "$output/" in
  "$root/.ai-work/runs/"*) ;;
  *) echo "Output must be repository-owned .ai-work scratch." >&2; exit 1 ;;
esac
test -z "$(find "$output" -mindepth 1 -maxdepth 1 -print -quit)"

npm ci --include=dev --include=optional --no-fund
npm audit --workspaces --include=dev --audit-level=low
npm audit --workspaces --omit=dev --audit-level=low
npm audit signatures --include=dev
npm audit signatures --omit=dev
npm run verify:install-scripts
npm run verify:toolchain
npm run lint
npm run typecheck
NODE_ENV=test npm run test:unit
npm run test:runtime-artifact
node --test scripts/native-artifact-transport.test.mjs
export COFOUNDRY_COMMIT_SHA="$commit"
export COFOUNDRY_DEPLOYED_AT="$deployed_at"
export COFOUNDRY_LOCAL_DATA_DIR=/tmp/cofoundry-build-data
export COFOUNDRY_OPERATIONS_TOKEN=artifact-build-operations-token-000001
export COFOUNDRY_RELEASE="$release"
export NODE_ENV=production
export NUXT_PUBLIC_APP_URL=https://cofoundry.jacobdanderson.net
export NUXT_PUBLIC_BACKEND_MODE=mock
export NUXT_PUBLIC_BILLING_MODE=mock
export NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false
export NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE=false
export SESSION_SIGNING_SECRET=artifact-build-session-secret-0000001
npm run build

stage="$output/stage"
mkdir -p "$stage/front-end" "$stage/back-end"
install -m 0644 package.json package-lock.json "$stage/"
install -m 0644 front-end/package.json "$stage/front-end/"
install -m 0644 back-end/package.json "$stage/back-end/"
frontend_output=$(realpath front-end/.output)
while IFS= read -r -d '' link; do
  target=$(realpath "$link") || { echo "Invalid frontend build link: $link" >&2; exit 1; }
  case "$target" in
    "$frontend_output"/*) ;;
    *) echo "Frontend build link escapes output: $link" >&2; exit 1 ;;
  esac
  case "$link/" in
    "$target/"*) echo "Frontend build link cycles to an ancestor: $link" >&2; exit 1 ;;
  esac
done < <(find "$frontend_output" -type l -print0)
cp -RL "$frontend_output" "$stage/front-end/.output"
cp -R back-end/dist "$stage/back-end/"
mkdir "$stage/node_modules"
python3 -B scripts/copy-production-dependencies.py "$root" "$stage/node_modules" > "$output/dependency-tree.json"
npm audit --prefix "$stage" --omit=dev --audit-level=low

find "$stage" -type d -exec chmod 0755 {} +
find "$stage" -type f -exec chmod 0644 {} +
if find "$stage" -type l -print -quit | grep -q .; then
  echo "Runtime stage contains a symbolic link." >&2
  exit 1
fi
node scripts/write-runtime-identity.mjs "$stage" "$commit" "$release" "$deployed_at"

archive="$output/cofoundry-$release-${commit:0:12}-linux-arm64.tar.gz"
python3 -B scripts/runtime-artifact.py pack "$stage" --archive "$archive" --commit "$commit" > "$output/pack.json"
sha=$(sha256sum "$archive" | cut -d ' ' -f 1)
control_archive="$output/cofoundry-$release-${commit:0:12}-host-controls.tar.gz"
python3 -B scripts/host-control-bundle.py pack \
  --archive "$control_archive" --commit "$commit" > "$output/control-pack.json"
control_sha=$(sha256sum "$control_archive" | cut -d ' ' -f 1)
python3 -B scripts/host-control-bundle.py verify \
  --archive "$control_archive" --sha256 "$control_sha" --commit "$commit" \
  > "$output/control-verification.json"
cp "$stage/runtime-manifest.json" "$output/runtime-manifest.json"

if [[ "$build_only" == true ]]; then
  echo "Built native candidate; unpacked runtime and recovery acceptance remain pending: $archive"
  exit 0
fi

mkdir "$output/unpacked"
python3 -B scripts/runtime-artifact.py unpack "$output/unpacked" --archive "$archive" --sha256 "$sha" --commit "$commit"
bash scripts/test-unpacked-artifact.sh "$output/unpacked"

cp -R "$output/unpacked" "$output/copied"
python3 -B scripts/runtime-artifact.py verify "$output/copied" --archive "$archive" --sha256 "$sha" --commit "$commit"
bash scripts/test-unpacked-artifact.sh "$output/copied"
rm -- "$output/copied/back-end/dist/environment.js"
if python3 -B scripts/runtime-artifact.py verify "$output/copied" --archive "$archive" --sha256 "$sha" --commit "$commit"; then
  echo "Missing runtime module was incorrectly accepted." >&2
  exit 1
fi
bash scripts/test-unpacked-artifact.sh "$output/copied" missing-module
bash scripts/test-promotion-recovery.sh

python3 -B - "$output" <<'PY'
import datetime
import hashlib
import json
from pathlib import Path
import sys

output = Path(sys.argv[1])
receipt = json.loads((output / "pack.json").read_text())
receipt["hostControlBundle"] = json.loads((output / "control-pack.json").read_text())
receipt["acceptedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
receipt["bytes"] = (output / receipt["archive"]).stat().st_size
receipt["checks"] = [
    "full locked build install and exact production dependency closure",
    "production dependency audit",
    "registry signatures",
    "manifest and required paths",
    "isolated unpacked front-end and back-end runtimes",
    "minimal health and readiness probes",
    "compiled operations worker",
    "graceful shutdown",
    "post-copier verification",
    "missing-module rejection",
    "atomic promotion interruption and rollback",
    "immutable root-control bundle installation and activation",
]
receipt["harnessSha256"] = {
    name: hashlib.sha256(Path(name).read_bytes()).hexdigest()
    for name in [
        "deploy/runtime-artifact.json",
        "scripts/runtime-artifact.py",
        "scripts/host-control-bundle.py",
        "scripts/copy-production-dependencies.py",
        "scripts/package-runtime.sh",
        "scripts/test-unpacked-artifact.sh",
        "scripts/test-promotion-recovery.py",
        "scripts/test-promotion-recovery.sh",
        "scripts/artifact-acceptance.mjs",
        "scripts/write-runtime-identity.mjs",
        "deploy/systemd/promote-release.sh",
        "deploy/systemd/install-app-unit.sh",
        "deploy/systemd/trusted-paths.py",
    ]
}
(output / "acceptance.json").write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n")
PY

(
  cd -- "$output"
  sha256sum \
    "$(basename "$archive")" \
    "$(basename "$control_archive")" \
    runtime-manifest.json \
    acceptance.json > SHA256SUMS
  sha256sum --check SHA256SUMS
)

echo "Exact unpacked CoFoundry artifact accepted: $archive"
