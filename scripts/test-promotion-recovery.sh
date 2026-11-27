#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "$0")/.." && pwd -P)
node=$(realpath "$(command -v node)")
python_prefix=$(python3 -c 'import sys; print(sys.base_prefix)')
test "$(uname -s)" = Linux
test "$(id -u)" -ne 0
test "$("$node" --version)" = v26.13.1
test -x "$python_prefix/bin/python3"
command -v bwrap >/dev/null
command -v timeout >/dev/null

timeout -k 5 120 bwrap --unshare-all --die-with-parent --new-session --uid 0 --gid 0 \
  --ro-bind /usr /usr --symlink usr/bin /bin --symlink usr/lib /lib --symlink usr/lib64 /lib64 \
  --ro-bind /etc/passwd /etc/passwd --ro-bind /etc/group /etc/group \
  --ro-bind "$python_prefix" /runtime/python-home --tmpfs /usr/local --ro-bind "$node" /runtime/node \
  --proc /proc --dev /dev --tmpfs /tmp \
  --ro-bind "$root/deploy" /source/deploy --ro-bind "$root/scripts" /source/scripts \
  --clearenv --setenv PATH /runtime:/usr/bin:/bin --setenv HOME /tmp \
  --setenv PYTHONHOME /runtime/python-home --setenv PYTHONNOUSERSITE 1 \
  --chdir /tmp /runtime/python-home/bin/python3 -I -B /source/scripts/test-promotion-recovery.py "${1:-all}"
