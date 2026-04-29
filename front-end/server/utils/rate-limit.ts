import type { H3Event } from "h3"
import { createError, getHeader, getRequestIP, setHeader } from "h3"

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

function normalizeKeyPart(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, "_") || "unknown"
}

function getRequester(event: H3Event) {
  return getRequestIP(event, { xForwardedFor: true })
    || getHeader(event, "x-real-ip")
    || getHeader(event, "cf-connecting-ip")
    || "unknown"
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
  const identity = options.key ? normalizeKeyPart(options.key) : getRequester(event)
  const key = `${options.scope}:${identity}`
  const existing = buckets.get(key)

  cleanupExpiredBuckets(now)

  if (!existing || existing.resetAt <= now) {
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
  return [getRequester(event), ...parts].map(normalizeKeyPart).join(":")
}

export function clearRateLimitBucketsForTests() {
  buckets.clear()
}
