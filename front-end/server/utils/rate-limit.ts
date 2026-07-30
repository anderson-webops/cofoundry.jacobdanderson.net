import type { H3Event } from "h3"
import { isIP } from "node:net"
import process from "node:process"
import { createError, getHeader, getRequestIP, setHeader } from "h3"
import { isTrustedProxyAddress } from "./trusted-proxy"

interface RateLimitBucket {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  key?: string
  limit: number
  scope: string
  windowMs: number
}

const buckets = new Map<string, RateLimitBucket>()
const maximumBucketCount = 20_000

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, "_") || "unknown"
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

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 500)
    return

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now)
      buckets.delete(key)
  }
}

export function assertRateLimit(event: H3Event, options: RateLimitOptions) {
  const now = Date.now()
  const identity = options.key ? normalizeKeyPart(options.key) : getRequesterIp(event)
  const key = `${options.scope}:${identity}`
  const existing = buckets.get(key)

  cleanupExpiredBuckets(now)

  if (!existing || existing.resetAt <= now) {
    if (!existing && buckets.size >= maximumBucketCount) {
      setHeader(event, "Retry-After", 60)
      throw createError({
        statusCode: 429,
        statusMessage: "Request capacity is temporarily limited. Please retry shortly.",
      })
    }

    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    setHeader(event, "Retry-After", retryAfterSeconds)
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests. Please wait before trying again.",
    })
  }

  existing.count += 1
}

export function buildRateLimitKey(event: H3Event, ...parts: string[]) {
  return [getRequesterIp(event), ...parts].map(normalizeKeyPart).join(":")
}

export function clearRateLimitBucketsForTests() {
  buckets.clear()
}
