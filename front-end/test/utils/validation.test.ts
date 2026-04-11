import { describe, expect, it } from "vitest"
import { billingCheckoutSchema, contactSchema, onboardingSchema, proposalSchema, signUpSchema } from "../../shared/utils/validation"

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
      roles: ["Technical Co-Founder"],
      yearsExperience: 9,
      industries: ["Fintech"],
      startupStagePreferences: ["idea"],
      compensationPreferences: ["equity_only"],
      equityExpectationRange: "15% - 30%",
      timeCommitment: "full_time",
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
      roleTitle: "CTO",
      responsibilities: ["Architecture"],
      weeklyTimeCommitment: 45,
      startDate: "2026-05-01",
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
})
