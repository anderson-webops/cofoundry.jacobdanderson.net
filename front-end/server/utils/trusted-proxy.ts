import { BlockList, isIP } from "node:net"

function normalizeIp(address: string) {
  const value = address.trim()
  return value.startsWith("::ffff:") && isIP(value.slice(7)) === 4
    ? value.slice(7)
    : value
}

export function parseTrustedProxyList(configured: string | undefined) {
  const entries = (configured || "")
    .split(",")
    .map(entry => entry.trim())
    .filter(Boolean)
  const blockList = new BlockList()
  const invalidEntries: string[] = []

  for (const entry of entries) {
    const parts = entry.split("/")
    if (parts.length > 2) {
      invalidEntries.push(entry)
      continue
    }

    const [rawAddress, rawPrefix] = parts
    const address = normalizeIp(rawAddress || "")
    const family = isIP(address)
    if (!family) {
      invalidEntries.push(entry)
      continue
    }

    if (typeof rawPrefix === "undefined") {
      blockList.addAddress(address, family === 4 ? "ipv4" : "ipv6")
      continue
    }

    if (!/^\d+$/.test(rawPrefix)) {
      invalidEntries.push(entry)
      continue
    }

    const prefix = Number.parseInt(rawPrefix, 10)
    const maximumPrefix = family === 4 ? 32 : 128
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > maximumPrefix) {
      invalidEntries.push(entry)
      continue
    }

    try {
      blockList.addSubnet(address, prefix, family === 4 ? "ipv4" : "ipv6")
    }
    catch {
      invalidEntries.push(entry)
    }
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

  return blockList.check(normalizedAddress, family === 4 ? "ipv4" : "ipv6")
}
