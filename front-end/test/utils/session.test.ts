import type { SessionUser } from "../../shared/types/domain"
import { describe, expect, it } from "vitest"
import { decodeSessionUser, encodeSessionUser, sessionCookieName } from "../../shared/utils/session"

describe("session utilities", () => {
  it("round-trips a session payload", () => {
    const session: SessionUser = {
      id: "user_test",
      email: "tester@cofoundry.dev",
      name: "Test Founder",
      role: "founder",
      onboardingCompleted: true,
      subscriptionPlan: "pro",
    }

    const encoded = encodeSessionUser(session)

    expect(decodeSessionUser(encoded)).toEqual(session)
  })

  it("returns null for invalid payloads", () => {
    expect(decodeSessionUser("not-a-real-session")).toBeNull()
    expect(decodeSessionUser("")).toBeNull()
    expect(sessionCookieName).toBe("cofoundry_session")
  })
})
