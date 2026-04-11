import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildAlignmentCheck, buildConnectRequestDueCopy, buildIntentChecklist, buildMessageRiskFlags, buildProfileReadiness, buildProfileTrustScore, buildProfileTrustTier, buildStructuredIntroNote, canOpenProposalWorkflow } from "../../shared/utils/formation"
import { getTrialForMatch } from "../../shared/utils/workspace"

describe("formation utilities", () => {
  it("builds a complete seriousness checklist for a seeded high-signal profile", () => {
    const profile = workspaceSeed.profiles.find(item => item.userId === "user_olivia")
    expect(profile).toBeDefined()

    const checklist = buildIntentChecklist(profile!)
    const readiness = buildProfileReadiness(profile!)

    expect(checklist).toHaveLength(7)
    expect(checklist.every(item => item.complete)).toBe(true)
    expect(readiness.trustReady).toBe(true)
    expect(readiness.trustPercent).toBe(100)
  })

  it("scores higher-trust profiles above weaker-signal ones", () => {
    const malik = workspaceSeed.profiles.find(item => item.userId === "user_malik")
    const arjun = workspaceSeed.profiles.find(item => item.userId === "user_arjun")

    expect(malik).toBeDefined()
    expect(arjun).toBeDefined()
    expect(buildProfileTrustScore(malik!)).toBeGreaterThan(buildProfileTrustScore(arjun!))
  })

  it("assigns higher trust tiers only after stronger verification steps", () => {
    const olivia = workspaceSeed.profiles.find(item => item.userId === "user_olivia")
    const arjun = workspaceSeed.profiles.find(item => item.userId === "user_arjun")

    expect(olivia).toBeDefined()
    expect(arjun).toBeDefined()
    expect(buildProfileTrustTier(olivia!)).toBe("level_c")
    expect(buildProfileTrustTier(arjun!)).toBe("level_a")
  })

  it("distinguishes minimum onboarding from outreach and full-profile readiness", () => {
    const draft = structuredClone(workspaceSeed.profiles.find(item => item.userId === "user_arjun"))
    expect(draft).toBeDefined()

    draft!.displayName = "Jordan Alvarez"
    draft!.photoUrl = ""
    draft!.headline = "Founding operator evaluating serious workflow software teams."
    draft!.bio = "I want to join an early-stage company where the customer problem is already clear and the founder wants an operator to own execution."
    draft!.location = "Chicago, IL"
    draft!.roles = ["Operations"]
    draft!.industries = ["B2B SaaS"]
    draft!.roleScope.primaryRole = "Operations"
    draft!.intent.companyPreferences = ["Workflow software"]
    draft!.timeCommitment = "full_time"
    draft!.commitmentProfile.weeklyAvailabilityHours = 40
    draft!.intent.startTimeline = "30_days"
    draft!.commitmentProfile.fullTimeBy = "2026-07-01"
    draft!.commitmentProfile.runwayBucket = "3_to_6_months"
    draft!.remotePreference = "remote"
    draft!.privacy.profileVisibility = "members"
    draft!.governancePreferences.equityPhilosophy = "contribution_weighted"
    draft!.governancePreferences.leadershipPreference = "prefers_non_ceo_role"
    draft!.governancePreferences.decisionModelPreference = "area_owner_decides"
    draft!.governancePreferences.deadlockPreference = "advisor_tiebreaker"
    draft!.roleScope.nonResponsibilities = []
    draft!.roleScope.accountabilityMilestones = []
    draft!.ipReadiness.existingAssets = []
    draft!.ipReadiness.existingAssetsNotes = ""
    draft!.ipReadiness.readyToAssignIp = false
    draft!.links = {
      linkedin: "",
      github: "",
      portfolio: "",
      website: "",
    }
    draft!.trustSignals.builderProofs = []
    draft!.intent.nonNegotiables = []
    draft!.intent.introCapacity = ""
    draft!.values = []
    draft!.workStylePreferences = []
    draft!.compensationPreferences = ["equity_only"]
    draft!.startupStagePreferences = ["idea"]
    draft!.equityExpectationRange = "Flexible"
    draft!.trustSignals.phoneVerified = false

    const readiness = buildProfileReadiness(draft!)

    expect(readiness.percent).toBeGreaterThan(0)
    expect(readiness.profileComplete).toBe(false)
    expect(readiness.readyForOutreach).toBe(false)
    expect(readiness.trustReady).toBe(false)
    expect(readiness.missingOutreachItems).toContain("Proof and links")
    expect(readiness.missingTrustItems).toContain("Recognizable profile")
    expect(readiness.missingOutreachItems).toContain("IP readiness")
    expect(readiness.missingOutreachItems).toContain("Phone verification")
  })

  it("builds an alignment check across two serious profiles", () => {
    const olivia = workspaceSeed.profiles.find(item => item.userId === "user_olivia")
    const malik = workspaceSeed.profiles.find(item => item.userId === "user_malik")

    expect(olivia).toBeDefined()
    expect(malik).toBeDefined()

    const alignment = buildAlignmentCheck(olivia!, malik!)

    expect(alignment).toHaveLength(6)
    expect(alignment.some(item => item.status === "aligned")).toBe(true)
    expect(canOpenProposalWorkflow(olivia!, malik!)).toBe(true)
  })

  it("flags off-platform fee language in risky messages", () => {
    const flags = buildMessageRiskFlags("Move this to WhatsApp and send the diligence fee by wire once our investor partner reviews it.")

    expect(flags.length).toBeGreaterThan(0)
    expect(flags.join(" ")).toContain("off-platform")
  })

  it("builds a structured intro note and response target copy", () => {
    const request = workspaceSeed.connectRequests.find(item => item.id === "connect_arjun_noah")
    expect(request).toBeDefined()

    expect(buildStructuredIntroNote(request!.structuredIntro)).toContain("Proposed next step")
    expect(buildConnectRequestDueCopy(request!)).toContain("Reply target")
  })

  it("returns the trial collaboration attached to a match", () => {
    const trial = getTrialForMatch(workspaceSeed, "match_olivia_malik")

    expect(trial).toBeDefined()
    expect(trial?.status).toBe("active")
    expect(trial?.deliverables.length).toBeGreaterThan(1)
  })
})
