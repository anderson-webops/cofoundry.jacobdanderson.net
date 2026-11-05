import { BlockList, isIP } from "node:net"

function normalizeIp(address: string) {
  const value = address.trim()
  return value.startsWith("::ffff:") && isIP(value.slice(7)) === 4
    ? value.slice(7)
    : value
}

function addTrustedProxyEntry(blockList: BlockList, entry: string) {
  const parts = entry.split("/")
  if (parts.length > 2)
    return false

  const [rawAddress, rawPrefix] = parts
  const address = normalizeIp(rawAddress || "")
  const family = isIP(address)
  if (!family)
    return false

  if (typeof rawPrefix === "undefined") {
    blockList.addAddress(address, family === 4
      ? "ipv4"
      : "ipv6")
    return true
  }

  if (!/^\d+$/.test(rawPrefix))
    return false

  const prefix = Number.parseInt(rawPrefix, 10)
  const maximumPrefix = family === 4
    ? 32
    : 128
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maximumPrefix)
    return false

  try {
    blockList.addSubnet(address, prefix, family === 4
      ? "ipv4"
      : "ipv6")
  }
  catch {
    return false
  }
  return true
}

export function parseTrustedProxyList(configured: string | undefined) {
  const entries = (configured || "")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
  const blockList = new BlockList()
  const invalidEntries: string[] = []

  for (const entry of entries) {
    if (!addTrustedProxyEntry(blockList, entry))
      invalidEntries.push(entry)
  }

  return { blockList, invalidEntries }
}

export function isTrustedProxyAddress(address: string | null | undefined, configured: string | undefined) {
  const normalizedAddress = normalizeIp(address || "")
  const family = isIP(normalizedAddress)
  if (!family)
    return false

  const { blockList, invalidEntries } = parseTrustedProxyList(configured)
  if (invalidEntries.length)
    return false

  return blockList.check(normalizedAddress, family === 4
    ? "ipv4"
    : "ipv6")
}
