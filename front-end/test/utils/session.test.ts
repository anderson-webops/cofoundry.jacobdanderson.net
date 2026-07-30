import type { SessionUser } from "../../shared/types/domain"
import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"
import { decodeSessionUser, encodeSessionUser, sessionCookieName, sessionSignatureCookieName } from "../../shared/utils/session"
import { resolveActiveSessionFromSeed } from "../../shared/utils/session-authority"
import { buildSessionUser } from "../../shared/utils/workspace"

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
    expect(decodeSessionUser(encodeSessionUser({
      id: "user_test",
      email: "tester@cofoundry.dev",
      name: "Test Founder",
      role: "owner",
      onboardingCompleted: true,
      subscriptionPlan: "pro",
    } as unknown as SessionUser))).toBeNull()
    expect(sessionCookieName).toBe("cofoundry_session")
    expect(sessionSignatureCookieName).toBe("cofoundry_session_sig")
  })

  it("rehydrates roles from the current persisted workspace seed", () => {
    const seed = cloneValue(workspaceSeed)
    const staleSession = buildSessionUser(workspaceSeed, "user_malik")
    const persistedUser = seed.users.find(user => user.id === "user_malik")

    expect(staleSession?.role).toBe("collaborator")
    expect(persistedUser).toBeDefined()
    persistedUser!.role = "admin"

    expect(resolveActiveSessionFromSeed(seed, staleSession!)).toMatchObject({
      id: "user_malik",
      role: "admin",
    })
  })

  it("rejects sessions for suspended persisted users", () => {
    const seed = cloneValue(workspaceSeed)
    const staleSession = buildSessionUser(workspaceSeed, "user_malik")
    const persistedUser = seed.users.find(user => user.id === "user_malik")

    expect(persistedUser).toBeDefined()
    persistedUser!.suspendedAt = new Date("2026-04-18T10:00:00.000Z").toISOString()

    expect(resolveActiveSessionFromSeed(seed, staleSession!)).toBeNull()
  })

  it("rejects privileged sessions until the persisted email is verified", () => {
    const seed = cloneValue(workspaceSeed)
    const staleSession = buildSessionUser(workspaceSeed, "user_malik")
    const persistedUser = seed.users.find(user => user.id === "user_malik")

    expect(persistedUser).toBeDefined()
    persistedUser!.role = "admin"
    persistedUser!.verifiedEmail = false

    expect(resolveActiveSessionFromSeed(seed, staleSession!)).toBeNull()
  })

  it("rejects sessions when no persisted user exists", () => {
    const seed = cloneValue(workspaceSeed)
    const staleSession = buildSessionUser(workspaceSeed, "user_malik")

    seed.users = seed.users.filter(user => user.id !== "user_malik")

    expect(resolveActiveSessionFromSeed(seed, staleSession!)).toBeNull()
  })
})
