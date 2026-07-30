import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  createTimedSessionSignature,
  sessionCookieMaxAgeSeconds,
  verifyTimedSessionSignature,
} from "../../server/utils/session-signature"

describe("session signatures", () => {
  const encodedSession = "encoded-session"
  const secret = "a-strong-session-secret-used-for-testing"
  const issuedAt = Date.UTC(2026, 6, 29, 12)

  it("authenticates the exact session payload during the bounded lifetime", () => {
    const signature = createTimedSessionSignature(encodedSession, secret, issuedAt)

    expect(verifyTimedSessionSignature(encodedSession, signature, secret, issuedAt + 60_000)).toBe(true)
    expect(verifyTimedSessionSignature(`${encodedSession}-tampered`, signature, secret, issuedAt + 60_000)).toBe(false)
  })

  it("rejects expired, future, malformed, and legacy signatures", () => {
    const signature = createTimedSessionSignature(encodedSession, secret, issuedAt)

    expect(verifyTimedSessionSignature(
      encodedSession,
      signature,
      secret,
      issuedAt + (sessionCookieMaxAgeSeconds + 1) * 1000,
    )).toBe(false)
    expect(verifyTimedSessionSignature(
      encodedSession,
      createTimedSessionSignature(encodedSession, secret, issuedAt + 10 * 60_000),
      secret,
      issuedAt,
    )).toBe(false)
    expect(verifyTimedSessionSignature(encodedSession, "not-a-timed-signature", secret, issuedAt)).toBe(false)
    expect(verifyTimedSessionSignature(encodedSession, "legacyhmacvalue", secret, issuedAt)).toBe(false)
    const issuedAtSeconds = Math.floor(issuedAt / 1000)
    const legacyDigest = createHmac("sha256", secret)
      .update(`${issuedAtSeconds}.${encodedSession}`)
      .digest("base64url")
    expect(verifyTimedSessionSignature(
      encodedSession,
      `${issuedAtSeconds}.${legacyDigest}`,
      secret,
      issuedAt,
    )).toBe(false)
  })
})
