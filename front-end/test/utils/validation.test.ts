import { describe, expect, it } from "vitest"
import { billingCheckoutSchema, contactSchema, minimumOnboardingSchema, onboardingSchema, opportunitySchema, proposalSchema, reportSchema, signUpSchema } from "../../shared/utils/validation"

describe("validation schemas", () => {
  it("accepts a valid sign-up payload", () => {
    const result = signUpSchema.safeParse({
      name: "Olivia Chen",
      email: "olivia@cofoundry.dev",
      password: "founder123",
    })

    expect(result.success).toBe(true)
  })

  it("rejects contact submissions without enough detail", () => {
    const result = contactSchema.safeParse({
      name: "OC",
      email: "olivia@cofoundry.dev",
      company: "LedgerLoop",
      subject: "Hi",
      message: "Too short",
    })

    expect(result.success).toBe(false)
  })

  it("requires structured onboarding data", () => {
    const result = onboardingSchema.safeParse({
      displayName: "Malik Thompson",
      headline: "Staff engineer building a long-term company with a serious founder.",
      bio: "I want a high-trust founder partnership with clear customer access, strong judgment, and enough detail to evaluate fit well.",
      location: "Austin, TX",
      remotePreference: "remote",
      primaryRole: "Technical Co-Founder",
      roles: ["Technical Co-Founder"],
      yearsExperience: 9,
      industries: ["Fintech"],
      startupStagePreferences: ["idea"],
      compensationPreferences: ["equity_only"],
      equityExpectationRange: "15% - 30%",
      timeCommitment: "full_time",
      weeklyAvailabilityHours: 45,
      startTimeline: "30_days",
      fullTimeBy: "2026-06-01",
      runwayBucket: "6_to_12_months",
      currentStatus: "full_time_employed",
      equityPhilosophy: "contribution_weighted",
      leadershipPreference: "open_to_ceo_role",
      decisionModelPreference: "area_owner_decides",
      deadlockPreference: "advisor_tiebreaker",
      companyPreferences: ["Developer tools"],
      nonNegotiables: ["Need clear decision rights"],
      introCapacity: "One strong founder match this month.",
      nonResponsibilities: ["I do not want to own sales alone."],
      accountabilityMilestones: ["Ship the first production system."],
      existingAssets: ["Architecture notes"],
      existingAssetsNotes: "I may bring system design notes but not employer-owned code.",
      priorObligations: "possible_constraints",
      readyToAssignIp: true,
      linkedin: "https://linkedin.com/in/malikthompson",
      github: "https://github.com/malikthompson",
      portfolio: "",
      website: "https://malik.dev",
      hasIdea: false,
      wantsToJoinIdea: true,
      values: ["Candor"],
      workStylePreferences: ["Async updates"],
      profileVisibility: "members",
    })

    expect(result.success).toBe(true)
  })

  it("requires proposal responsibilities and narrative sections", () => {
    const result = proposalSchema.safeParse({
      relationshipType: "cofounder",
      roleTitle: "CTO",
      responsibilities: ["Architecture"],
      weeklyTimeCommitment: 45,
      startDate: "2026-05-01",
      fullTimeTrigger: "Once we confirm the first paying pilot and both founders commit full-time.",
      ceoDecision: "Founder remains CEO and final company-level decision-maker.",
      trialScope: "Ship one real workflow slice together and review how the working relationship felt.",
      trialIpHandling: "Trial artifacts stay confidential and transfer only through signed company docs.",
      cashCompensation: "$0 until funding",
      equity: "20%",
      vestingSchedule: "4 years",
      cliff: "1 year",
      decisionRights: "Product",
      ipAssignmentRequired: true,
      confidentiality: "Keep secrets",
      exitTerms: "We will discuss later",
      notes: "Short",
    })

    expect(result.success).toBe(false)
  })

  it("defaults billing interval to monthly", () => {
    const result = billingCheckoutSchema.parse({
      plan: "pro",
    })

    expect(result.interval).toBe("monthly")
  })

  it("accepts trust metadata on opportunity creation", () => {
    const result = opportunitySchema.safeParse({
      startupName: "LedgerLoop",
      oneLinePitch: "Compliance workflow software for fast-moving fintech teams.",
      problem: "Compliance review still lives across spreadsheets, email, and internal tickets, which slows launches and burns expensive operator time.",
      targetUsers: "Fintech operations and compliance teams at startups with 15 to 300 employees.",
      stage: "prototype",
      traction: "Three design partners, one pilot scheduled, and strong founder-introduced pipeline.",
      expectedCommitment: "full_time",
      compensationStructure: "cash_and_equity",
      equityRange: "15% - 30%",
      location: "New York, NY",
      remotePreference: "hybrid",
      officialWebsite: "https://ledgerloop.co",
      verificationMethod: "domain",
      industries: ["Fintech"],
      rolesNeeded: ["Technical Co-Founder"],
    })

    expect(result.success).toBe(true)
  })

  it("accepts the shorter minimum onboarding payload", () => {
    const result = minimumOnboardingSchema.safeParse({
      intentMode: "join",
      displayName: "Malik Thompson",
      headline: "Technical co-founder looking for a serious workflow software founder.",
      bio: "I want to join a technical, high-trust founding team where customer access and decision rights are clear from day one.",
      location: "Austin, TX",
      remotePreference: "remote",
      primaryRole: "Technical Co-Founder",
      roles: ["Technical Co-Founder"],
      industries: ["Developer Tools"],
      timeCommitment: "full_time",
      weeklyAvailabilityHours: 45,
      startTimeline: "30_days",
      fullTimeBy: "2026-06-01",
      runwayBucket: "6_to_12_months",
      equityPhilosophy: "contribution_weighted",
      companyPreferences: ["Workflow software"],
      profileVisibility: "members",
    })

    expect(result.success).toBe(true)
  })

  it("requires enough detail in safety reports", () => {
    const result = reportSchema.safeParse({
      reason: "impersonation",
      details: "Asked me to move the chat to WhatsApp and pay a diligence fee.",
    })

    expect(result.success).toBe(true)
  })
})
