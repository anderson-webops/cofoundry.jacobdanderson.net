import { describe, expect, it } from "vitest"
import { applyAuthoritativeTrustEvents, sanitizeProfileWrite } from "../../server/utils/member-workspace"
import { workspaceSeed } from "../../shared/data/seed"
import { buildMemberWorkspaceState } from "../../shared/utils/workspace-persistence"

describe("member trust-state writes", () => {
  it("preserves server-owned trust signals instead of accepting browser claims", () => {
    const current = buildMemberWorkspaceState(workspaceSeed, "user_emma")
    expect(current).not.toBeNull()

    const incoming = structuredClone(current!.profile)
    incoming.trustSignals.governmentIdVerified = true
    incoming.trustSignals.identityVerified = true
    incoming.trustSignals.workHistoryVerified = true
    incoming.verificationBadges.linkedAccounts = true

    const sanitized = sanitizeProfileWrite(current!, incoming, "2026-07-29T12:00:00.000Z")

    expect(sanitized.trustSignals.governmentIdVerified).toBe(current!.profile.trustSignals.governmentIdVerified)
    expect(sanitized.trustSignals.identityVerified).toBe(current!.profile.trustSignals.identityVerified)
    expect(sanitized.trustSignals.workHistoryVerified).toBe(current!.profile.trustSignals.workHistoryVerified)
    expect(sanitized.verificationBadges.linkedAccounts).toBe(
      current!.profile.trustSignals.linkedInVerified
      || current!.profile.trustSignals.githubVerified
      || current!.profile.trustSignals.workDomainVerified
      || current!.profile.trustSignals.websiteVerified,
    )
  })

  it("derives trust from the newest authoritative event and ignores stale reversals", () => {
    const current = buildMemberWorkspaceState(workspaceSeed, "user_emma")
    expect(current).not.toBeNull()

    const projected = applyAuthoritativeTrustEvents(current!, [
      {
        occurred_at: "2026-07-29T12:00:00.000Z",
        status: "verified",
        target_id: current!.profile.id,
        target_type: "profile",
        verification_type: "github",
      },
      {
        occurred_at: "2026-07-28T12:00:00.000Z",
        status: "failed",
        target_id: current!.profile.id,
        target_type: "profile",
        verification_type: "github",
      },
    ])

    expect(projected.profile.trustSignals.githubVerified).toBe(true)
    expect(projected.profile.verificationBadges.linkedAccounts).toBe(true)
    expect(projected.profile.trustSignals.phoneVerified).toBe(false)
  })
})
