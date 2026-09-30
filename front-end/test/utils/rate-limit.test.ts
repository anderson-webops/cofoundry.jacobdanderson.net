import { describe, expect, it } from "vitest"
import { BoundedRateLimitStore } from "../../server/utils/bounded-rate-limit-store"
import { resolveRequesterIp } from "../../server/utils/rate-limit"

describe("rate-limit requester identity", () => {
  it("ignores spoofable proxy headers by default", () => {
    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "203.0.113.8",
      realIp: "203.0.113.9",
    })).toBe("127.0.0.1")
  })

  it("uses validated proxy headers only when explicitly trusted", () => {
    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "203.0.113.8, 127.0.0.1",
      trustedProxyIps: "127.0.0.1/32",
      trustProxyHeaders: true,
    })).toBe("203.0.113.8")
    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "attacker-controlled",
      trustedProxyIps: "127.0.0.1",
      trustProxyHeaders: true,
    })).toBe("127.0.0.1")
  })

  it("walks appended proxy chains from the trusted edge instead of accepting spoofed prefixes", () => {
    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "198.51.100.77, 203.0.113.8",
      trustedProxyIps: "127.0.0.1/32",
      trustProxyHeaders: true,
    })).toBe("203.0.113.8")

    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "198.51.100.77, 10.0.0.2",
      trustedProxyIps: "127.0.0.1/32,10.0.0.0/8",
      trustProxyHeaders: true,
    })).toBe("198.51.100.77")
  })

  it("ignores forwarded headers when the direct peer is not on the proxy allowlist", () => {
    expect(resolveRequesterIp({
      directIp: "198.51.100.5",
      forwardedFor: "203.0.113.8",
      trustedProxyIps: "127.0.0.1,10.0.0.0/8",
      trustProxyHeaders: true,
    })).toBe("198.51.100.5")
  })

  it("keeps one proxied client's exhausted bucket separate from another client", () => {
    const proxy = {
      directIp: "127.0.0.1",
      trustedProxyIps: "127.0.0.1",
      trustProxyHeaders: true,
    }
    const attacker = resolveRequesterIp({ ...proxy, forwardedFor: "198.51.100.77, 203.0.113.8" })
    const legitimate = resolveRequesterIp({ ...proxy, forwardedFor: "192.0.2.9" })
    const store = new BoundedRateLimitStore()

    expect(attacker).toBe("203.0.113.8")
    expect(legitimate).toBe("192.0.2.9")
    for (let attempt = 0; attempt < 20; attempt += 1)
      expect(store.consume(`access-requests:ip:${attacker}`, "access-requests:ip", 20, 3_600_000).allowed).toBe(true)

    expect(store.consume(`access-requests:ip:${attacker}`, "access-requests:ip", 20, 3_600_000).allowed).toBe(false)
    expect(store.consume(`access-requests:ip:${legitimate}`, "access-requests:ip", 20, 3_600_000).allowed).toBe(true)
  })

  it("fails closed when the proxy allowlist is malformed", () => {
    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "203.0.113.8",
      trustedProxyIps: "127.0.0.1/32/extra",
      trustProxyHeaders: true,
    })).toBe("127.0.0.1")

    expect(resolveRequesterIp({
      directIp: "127.0.0.1",
      forwardedFor: "203.0.113.8",
      trustedProxyIps: "127.0.0.1/24abc",
      trustProxyHeaders: true,
    })).toBe("127.0.0.1")
  })
})
