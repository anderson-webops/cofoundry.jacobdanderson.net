set -euo pipefail
umask 077
case "$(uname -m)" in
  x86_64) arch=x64; digest=5c063e46bab0fbc1c17cc445d7ff129cbdcd0471be6ed83b6ab864f8143bc864 ;;
  aarch64) arch=arm64; digest=89e1853138db51e8b82d3e98ba9c0d3f2956a28e5e55ea1b7e12d25aae92d5dd ;;
  *) exit 1 ;;
esac
prefix=$(mktemp -d "${RUNNER_TEMP:?}/verified-node.XXXXXXXX")
version=$(<.node-version)
archive="node-v${version#v}-linux-$arch.tar.xz"
curl --fail --silent --show-error --location --proto '=https' "https://nodejs.org/dist/v${version#v}/$archive" -o "$prefix/archive"
printf '%s  %s\n' "$digest" "$prefix/archive" | sha256sum --check --status
tar -xJf "$prefix/archive" -C "$prefix" --strip-components=1 --no-same-permissions
rm "$prefix/archive"
printf '%s\n' "$prefix/bin"
