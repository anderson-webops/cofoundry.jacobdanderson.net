import type { Profile, User, WorkspaceSeed } from "../../shared/types/domain"
import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildActivationPlan, buildActivationPlanForMember } from "../../shared/utils/activation"

function createDraftActivationSeed(): { profile: Profile, seed: WorkspaceSeed, user: User } {
  const baseUser = workspaceSeed.users.find(user => user.id === "user_olivia")!
  const baseProfile = workspaceSeed.profiles.find(profile => profile.userId === "user_olivia")!
  const user: User = {
    ...baseUser,
    id: "user_activation_draft",
    email: "activation-draft@example.com",
    onboardingCompleted: false,
    verifiedEmail: false,
  }
  const profile: Profile = {
    ...baseProfile,
    id: "profile_activation_draft",
    userId: user.id,
    displayName: "",
    headline: "",
    bio: "",
    location: "",
    roles: [],
    industries: [],
    commitmentProfile: {
      ...baseProfile.commitmentProfile,
      weeklyAvailabilityHours: 0,
      fullTimeBy: "",
    },
    intent: {
      ...baseProfile.intent,
      companyPreferences: [],
      introCapacity: "",
      nonNegotiables: [],
    },
    links: {
      github: "",
      linkedin: "",
      portfolio: "",
      website: "",
    },
    trustSignals: {
      ...baseProfile.trustSignals,
      builderProofs: [],
      githubVerified: false,
      governmentIdVerified: false,
      identityVerified: false,
      linkedInVerified: false,
      phoneVerified: false,
      websiteVerified: false,
      workDomainVerified: false,
      workHistoryVerified: false,
    },
  }

  return {
    user,
    profile,
    seed: {
      ...workspaceSeed,
      users: [user],
      profiles: [profile],
      connectRequests: [],
      matches: [],
      conversations: [],
      messages: [],
      proposals: [],
      proposalVersions: [],
      proposalComments: [],
      contracts: [],
      contractVersions: [],
      signatures: [],
      trialCollaborations: [],
      relationshipDecisions: [],
      notifications: [],
      savedSearches: [],
    },
  }
}

describe("activation plan", () => {
  it("builds the ordered production activation gates for an active member", () => {
    const plan = buildActivationPlan(workspaceSeed, "user_olivia")

    expect(plan?.steps.map(step => step.id)).toEqual([
      "minimum_profile",
      "trust_ready",
      "first_intro",
      "inbox_follow_up",
    ])
    expect(plan?.steps.find(step => step.id === "minimum_profile")?.complete).toBe(true)
    expect(plan?.steps.find(step => step.id === "first_intro")?.complete).toBe(true)
    expect(plan?.currentStep?.id).toBe("inbox_follow_up")
    expect(plan?.stageLabel).toBe("Clear follow-through")
    expect(plan?.inboxActionCount).toBeGreaterThan(0)
  })

  it("keeps a draft account focused on the minimum profile before later gates unlock", () => {
    const { seed, user, profile } = createDraftActivationSeed()
    const plan = buildActivationPlanForMember(seed, user, profile)

    expect(plan.percent).toBe(0)
    expect(plan.currentStep?.id).toBe("minimum_profile")
    expect(plan.steps.find(step => step.id === "minimum_profile")?.missingItems).toEqual(expect.arrayContaining([
      "Identity basics",
      "Role signal",
      "Company fit",
      "Commitment plan",
    ]))
    expect(plan.steps.find(step => step.id === "trust_ready")?.status).toBe("locked")
    expect(plan.steps.find(step => step.id === "first_intro")?.status).toBe("locked")
  })

  it("does not treat waiting on the other side as an open inbox blocker", () => {
    const plan = buildActivationPlan(workspaceSeed, "user_arjun")

    expect(plan?.steps.find(step => step.id === "first_intro")?.complete).toBe(true)
    expect(plan?.waitingOnReplyCount).toBe(1)
    expect(plan?.inboxActionCount).toBe(0)
    expect(plan?.steps.find(step => step.id === "inbox_follow_up")?.complete).toBe(true)
  })
})
