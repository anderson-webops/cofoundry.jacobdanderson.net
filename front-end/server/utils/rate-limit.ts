import type { H3Event } from "h3"
import { createHash } from "node:crypto"
import { isIP } from "node:net"
import process from "node:process"
import { createError, getHeader, getRequestIP, setHeader } from "h3"
import { BoundedRateLimitStore } from "./bounded-rate-limit-store"
import { isTrustedProxyAddress } from "./trusted-proxy"

interface RateLimitOptions {
  key?: string
  limit: number
  scope: string
  windowMs: number
}

const buckets = new BoundedRateLimitStore()

function normalizeKeyPart(value: string) {
  const normalized = value.trim().toLowerCase().replaceAll(/\s+/g, "_") || "unknown"
  return normalized.length <= 256
    ? normalized
    : `sha256:${createHash("sha256").update(normalized).digest("base64url")}`
}

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() || ""
}

function validIp(value: string | null | undefined) {
  const candidate = firstHeaderValue(value)
  return isIP(candidate) ? candidate : ""
}

function forwardedClientIp(value: string | null | undefined, trustedProxyIps: string | undefined) {
  const addresses = (value || "")
    .split(",")
    .map(address => address.trim())
    .filter(address => isIP(address))

  for (let index = addresses.length - 1; index >= 0; index -= 1) {
    const address = addresses[index] || ""
    if (!isTrustedProxyAddress(address, trustedProxyIps))
      return address
  }

  return ""
}

export function resolveRequesterIp(input: {
  cfConnectingIp?: string | null
  directIp?: string | null
  forwardedFor?: string | null
  realIp?: string | null
  trustedProxyIps?: string
  trustProxyHeaders?: boolean
}) {
  const directIp = validIp(input.directIp)
  if (
    !input.trustProxyHeaders
    || !isTrustedProxyAddress(directIp, input.trustedProxyIps)
  ) {
    return directIp || "unknown"
  }

  return forwardedClientIp(input.forwardedFor, input.trustedProxyIps)
    || validIp(input.realIp)
    || validIp(input.cfConnectingIp)
    || directIp
    || "unknown"
}

export function getRequesterIp(event: H3Event) {
  return resolveRequesterIp({
    cfConnectingIp: getHeader(event, "cf-connecting-ip"),
    directIp: getRequestIP(event),
    forwardedFor: getHeader(event, "x-forwarded-for"),
    realIp: getHeader(event, "x-real-ip"),
    trustedProxyIps: process.env.COFOUNDRY_TRUSTED_PROXY_IPS,
    trustProxyHeaders: process.env.COFOUNDRY_TRUST_PROXY_HEADERS?.trim().toLowerCase() === "true",
  })
}

export function assertRateLimit(event: H3Event, options: RateLimitOptions) {
  const identity = options.key ? normalizeKeyPart(options.key) : getRequesterIp(event)
  const key = `${options.scope}:${identity}`
  const decision = buckets.consume(key, options.scope, options.limit, options.windowMs)

  if (!decision.allowed) {
    setHeader(event, "Retry-After", decision.retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests. Please wait before trying again.",
    })
  }
}

export function buildRateLimitKey(event: H3Event, ...parts: string[]) {
  return [getRequesterIp(event), ...parts].map(normalizeKeyPart).join(":")
}

export function clearRateLimitBucketsForTests() {
  buckets.clear()
}
