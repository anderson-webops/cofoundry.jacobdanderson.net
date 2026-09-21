interface RateLimitBucket {
  count: number
  resetAt: number
}

export interface RateLimitDecision {
  allowed: boolean
  retryAfterSeconds: number
}

/** Preserve ordinary fixed windows while excess identities share a strict scope bucket. */
export class BoundedRateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>()
  private readonly overflowBuckets = new Map<string, RateLimitBucket>()
  private lastNow = 0

  constructor(
    private readonly maximumIdentities = 2_048,
    private readonly maximumOverflowScopes = 128,
    private readonly clock = Date.now,
  ) {
    if (!Number.isSafeInteger(maximumIdentities) || maximumIdentities < 1)
      throw new RangeError("maximumIdentities must be a positive safe integer")
    if (!Number.isSafeInteger(maximumOverflowScopes) || maximumOverflowScopes < 1)
      throw new RangeError("maximumOverflowScopes must be a positive safe integer")
  }

  private now() {
    this.lastNow = Math.max(this.lastNow, this.clock())
    return this.lastNow
  }

  private pruneExpired(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now)
        this.buckets.delete(key)
    }
    for (const [key, bucket] of this.overflowBuckets) {
      if (bucket.resetAt <= now)
        this.overflowBuckets.delete(key)
    }
  }

  private consumeBucket(bucket: RateLimitBucket, limit: number, now: number): RateLimitDecision {
    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
      }
    }

    bucket.count = Math.min(Number.MAX_SAFE_INTEGER, bucket.count + 1)
    return { allowed: true, retryAfterSeconds: 0 }
  }

  consume(key: string, scope: string, limit: number, windowMs: number): RateLimitDecision {
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1)
      throw new RangeError("limit and windowMs must be positive safe integers")

    const now = this.now()
    let bucket = this.buckets.get(key)
    if (bucket?.resetAt && bucket.resetAt <= now) {
      this.buckets.delete(key)
      bucket = undefined
    }

    if (bucket)
      return this.consumeBucket(bucket, limit, now)

    if (this.buckets.size >= this.maximumIdentities)
      this.pruneExpired(now)

    if (this.buckets.size < this.maximumIdentities) {
      const next = { count: 0, resetAt: now + windowMs }
      this.buckets.set(key, next)
      return this.consumeBucket(next, limit, now)
    }

    const overflowKey = `${scope}\0${limit}\0${windowMs}`
    let overflow = this.overflowBuckets.get(overflowKey)
    if (overflow?.resetAt && overflow.resetAt <= now) {
      this.overflowBuckets.delete(overflowKey)
      overflow = undefined
    }

    if (!overflow) {
      if (this.overflowBuckets.size >= this.maximumOverflowScopes) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1_000)),
        }
      }
      overflow = { count: 0, resetAt: now + windowMs }
      this.overflowBuckets.set(overflowKey, overflow)
    }

    return this.consumeBucket(overflow, limit, now)
  }

  get size() {
    return this.buckets.size
  }

  get overflowSize() {
    return this.overflowBuckets.size
  }

  clear() {
    this.buckets.clear()
    this.overflowBuckets.clear()
  }
}
