import { describe, expect, it } from "vitest"
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
