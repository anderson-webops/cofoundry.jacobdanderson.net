import { describe, expect, it } from "vitest"
import { BoundedRateLimitStore } from "../../server/utils/bounded-rate-limit-store"

describe("bounded rate limit store", () => {
  it("preserves tracked windows and sends excess identities to one strict scope bucket", () => {
    let now = 0
    const store = new BoundedRateLimitStore(4, 2, () => now)

    for (let index = 0; index < 4; index += 1)
      expect(store.consume(`scope:${index}`, "scope", 3, 60_000).allowed).toBe(true)

    expect(store.size).toBe(4)
    expect(store.consume("scope:0", "scope", 3, 60_000).allowed).toBe(true)
    expect(store.consume("scope:overflow-1", "scope", 3, 60_000).allowed).toBe(true)
    expect(store.consume("scope:overflow-2", "scope", 3, 60_000).allowed).toBe(true)
    expect(store.consume("scope:overflow-3", "scope", 3, 60_000).allowed).toBe(true)
    expect(store.consume("scope:overflow-4", "scope", 3, 60_000)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    })
    expect(store.size).toBe(4)
    expect(store.overflowSize).toBe(1)

    now = 60_000
    expect(store.consume("scope:new-window", "scope", 3, 60_000).allowed).toBe(true)
    expect(store.size).toBe(1)
    expect(store.overflowSize).toBe(0)
  })

  it("bounds overflow scopes and does not extend windows when the clock moves backward", () => {
    let now = 10_000
    const store = new BoundedRateLimitStore(1, 1, () => now)

    expect(store.consume("first", "first", 1, 1_000).allowed).toBe(true)
    expect(store.consume("overflow", "second", 1, 1_000).allowed).toBe(true)
    expect(store.consume("overflow-again", "second", 1, 1_000).retryAfterSeconds).toBe(1)
    expect(store.consume("third", "third", 1, 2_000).allowed).toBe(false)

    now = 5_000
    expect(store.consume("first", "first", 1, 1_000).retryAfterSeconds).toBe(1)
    expect(() => new BoundedRateLimitStore(0)).toThrow(RangeError)
    expect(() => store.consume("bad", "bad", 0, 1)).toThrow(RangeError)
  })
})
