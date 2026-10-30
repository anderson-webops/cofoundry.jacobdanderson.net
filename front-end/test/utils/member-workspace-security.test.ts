import { describe, expect, it } from "vitest"
import { buildBootstrapState, sanitizeOpportunityWrites, sanitizeProfileWrite } from "../../server/utils/member-workspace"
import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"
import { memberWorkspaceWriteEnvelopeSchema } from "../../shared/utils/validation"
import { buildMemberWorkspaceState } from "../../shared/utils/workspace-persistence"

describe("member workspace security boundary", () => {
  it("bootstraps missing member state with a free, non-administrator baseline", () => {
    const state = buildBootstrapState({
      email: "new-member@example.com",
      id: "user_new_member",
      name: "New Member",
      onboardingCompleted: true,
      role: "admin",
      subscriptionPlan: "team",
      verifiedEmail: true,
    })

    expect(state.user.role).toBe("founder")
    expect(state.user.onboardingCompleted).toBe(false)
    expect(state.subscription.plan).toBe("free")
    expect(state.subscription.visibilityBoost).toBe(false)
    expect(state.subscription.unlimitedMessaging).toBe(false)
  })

  it("preserves server-controlled trust evidence and verification badges", () => {
    const state = buildMemberWorkspaceState(workspaceSeed, "user_emma")
    expect(state).toBeDefined()
    const incoming = cloneValue(state!.profile)
    incoming.verificationBadges.emailVerified = true
    incoming.verificationBadges.linkedAccounts = true
    incoming.trustSignals.governmentIdVerified = true
    incoming.trustSignals.identityVerified = true
    incoming.trustSignals.replyRatePercent = 100
    incoming.trustSignals.builderProofs = [
      {
        id: "proof_forged",
        outcome: "Forged",
        summary: "Forged",
        title: "Forged",
        url: "https://attacker.example/forged",
      }
    ]

    const sanitized = sanitizeProfileWrite(state!, incoming, "2026-07-29T12:00:00.000Z")

    expect(sanitized.verificationBadges.emailVerified).toBe(state!.user.verifiedEmail)
    expect(sanitized.trustSignals.governmentIdVerified).toBe(state!.profile.trustSignals.governmentIdVerified)
    expect(sanitized.trustSignals.identityVerified).toBe(state!.profile.trustSignals.identityVerified)
    expect(sanitized.trustSignals.replyRatePercent).toBe(state!.profile.trustSignals.replyRatePercent)
    expect(sanitized.trustSignals.builderProofs).toEqual(state!.profile.trustSignals.builderProofs)
  })

  it("recomputes opportunity risk and verification state when member content changes", () => {
    const state = buildMemberWorkspaceState(workspaceSeed, "user_olivia")
    expect(state?.opportunities.length).toBeGreaterThan(0)
    const incoming = cloneValue(state!.opportunities)
    incoming[0]!.problem = "Guaranteed returns with a wire transfer before we reveal the details."
    incoming[0]!.riskFlags = []
    incoming[0]!.verificationStatus = "domain_verified"

    const sanitized = sanitizeOpportunityWrites(state!, incoming, "2026-07-29T12:00:00.000Z")

    expect(sanitized[0]!.verificationStatus).not.toBe("domain_verified")
    expect(sanitized[0]!.riskFlags).not.toEqual([])
    expect(sanitized[0]!.ownerUserId).toBe("user_olivia")
  })

  it("rejects non-HTTP links and oversized workspace values at runtime", () => {
    const state = buildMemberWorkspaceState(workspaceSeed, "user_emma")
    expect(state).toBeDefined()
    const payload = {
      state: {
        onboardingCompleted: state!.user.onboardingCompleted,
        notificationPreferences: state!.user.notificationPreferences,
        profile: {
          ...state!.profile,
          links: {
            ...state!.profile.links,
            website: "javascript:alert(1)",
          },
        },
        opportunities: state!.opportunities,
        bookmarks: state!.bookmarks,
        savedSearches: state!.savedSearches,
      },
    }

    expect(memberWorkspaceWriteEnvelopeSchema.safeParse(payload).success).toBe(false)

    payload.state.profile.links.website = "https://user:password@example.com/private"
    expect(memberWorkspaceWriteEnvelopeSchema.safeParse(payload).success).toBe(false)
  })
})
