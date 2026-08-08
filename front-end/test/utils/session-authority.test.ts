import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { canAccessCoreMemberWorkspace, resolveSeededStaffSessionFromSeed } from "../../shared/utils/session-authority"
import { buildSessionUser } from "../../shared/utils/workspace"

describe("seeded staff session authority", () => {
  it("preserves the pre-provisioned investment reviewer role without a member subscription", () => {
    const session = buildSessionUser(workspaceSeed, "user_priya")!

    expect(resolveSeededStaffSessionFromSeed(workspaceSeed, session)).toMatchObject({
      email: "priya@cofoundry.dev",
      id: "user_priya",
      onboardingCompleted: true,
      role: "investor_admin",
    })
  })

  it("rejects email mismatches and regular member identities", () => {
    const reviewer = buildSessionUser(workspaceSeed, "user_priya")!
    const founder = buildSessionUser(workspaceSeed, "user_olivia")!

    expect(resolveSeededStaffSessionFromSeed(workspaceSeed, {
      ...reviewer,
      email: "someone-else@example.com",
    })).toBeNull()
    expect(resolveSeededStaffSessionFromSeed(workspaceSeed, founder)).toBeNull()
  })

  it("requires seeded staff email verification", () => {
    const source = structuredClone(workspaceSeed)
    const reviewer = buildSessionUser(source, "user_priya")!
    source.users.find(user => user.id === reviewer.id)!.verifiedEmail = false

    expect(resolveSeededStaffSessionFromSeed(source, reviewer)).toBeNull()
  })

  it("keeps investment-only reviewers outside the core member workspace", () => {
    expect(canAccessCoreMemberWorkspace({ role: "investor_admin" })).toBe(false)
    expect(canAccessCoreMemberWorkspace({ role: "admin" })).toBe(true)
    expect(canAccessCoreMemberWorkspace({ role: "founder" })).toBe(true)
  })
})
