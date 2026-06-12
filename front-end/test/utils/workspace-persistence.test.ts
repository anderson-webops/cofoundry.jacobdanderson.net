import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceState, buildMemberWorkspaceWritePayload, createInitialWorkspaceDocument, findWorkspaceUserIdByEmail, mergeMemberWorkspaceState, resolveSessionUserFromWorkspace } from "../../shared/utils/workspace-persistence"

describe("workspace persistence helpers", () => {
  it("maps known emails back to seeded users", () => {
    expect(findWorkspaceUserIdByEmail(workspaceSeed, "olivia@cofoundry.dev")).toBe("user_olivia")
    expect(findWorkspaceUserIdByEmail(workspaceSeed, "missing@cofoundry.dev")).toBeNull()
  })

  it("resolves existing workspace sessions before falling back to auth identity defaults", () => {
    const seededSession = resolveSessionUserFromWorkspace(workspaceSeed, {
      id: "external_auth_id",
      email: "olivia@cofoundry.dev",
      name: "Olivia Chen",
      onboardingCompleted: false,
      role: "founder",
      subscriptionPlan: "free",
    })
    const fallbackSession = resolveSessionUserFromWorkspace(workspaceSeed, {
      id: "auth_new_member",
      email: "new.member@cofoundry.dev",
      name: "New Member",
      onboardingCompleted: false,
      role: "founder",
      subscriptionPlan: "free",
    })

    expect(seededSession.id).toBe("user_olivia")
    expect(seededSession.subscriptionPlan).toBe("pro")
    expect(fallbackSession.id).toBe("auth_new_member")
    expect(fallbackSession.onboardingCompleted).toBe(false)
  })

  it("builds a draft member state for brand-new auth users", () => {
    const state = buildDraftMemberWorkspaceState({
      id: "auth_new_member",
      email: "new.member@cofoundry.dev",
      name: "New Member",
      role: "founder",
      onboardingCompleted: false,
      subscriptionPlan: "free",
    })

    expect(state.user.id).toBe("auth_new_member")
    expect(state.user.notificationPreferences.unreadDigestEmail).toBe(false)
    expect(state.profile.userId).toBe("auth_new_member")
    expect(state.subscription.userId).toBe("auth_new_member")
    expect(state.opportunities).toEqual([])
  })

  it("merges persisted member slices over the shared workspace seed", () => {
    const seedState = buildMemberWorkspaceState(workspaceSeed, "user_olivia")
    expect(seedState).not.toBeNull()

    const merged = mergeMemberWorkspaceState(createInitialWorkspaceDocument(), {
      ...seedState!,
      profile: {
        ...seedState!.profile,
        headline: "Updated persisted headline",
      },
      bookmarks: [],
    })
    const payload = buildMemberWorkspaceWritePayload(merged, "user_olivia")

    expect(merged.profiles.find(profile => profile.userId === "user_olivia")?.headline).toBe("Updated persisted headline")
    expect(merged.bookmarks.some(bookmark => bookmark.userId === "user_olivia")).toBe(false)
    expect(payload?.profile.headline).toBe("Updated persisted headline")
    expect(payload?.notificationPreferences.unreadDigestEmail).toBe(true)
  })
})
