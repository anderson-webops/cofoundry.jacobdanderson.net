import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildSubscriptionUsage, getPlanPriceLabel, getSubscriptionEntitlements } from "../../shared/utils/billing"

describe("billing helpers", () => {
  it("keeps matched messaging free while metering higher-intent actions", () => {
    const entitlements = getSubscriptionEntitlements({
      id: "subscription_test",
      userId: "user_test",
      plan: "free",
      status: "active",
      billingCycle: "monthly",
      renewsAt: null,
      cancelAtPeriodEnd: false,
      visibilityBoost: false,
      unlimitedMessaging: false,
      proposalWorkflow: false,
      contractBuilder: false,
    })

    expect(entitlements.canMessageFreely).toBe(true)
    expect(entitlements.introLimit).toBe(5)
    expect(entitlements.savedSearchLimit).toBe(1)
    expect(entitlements.proposalSendLimit).toBe(2)
    expect(entitlements.canSignContracts).toBe(false)
  })

  it("counts current-cycle usage against the active plan limits", () => {
    const seed = structuredClone(workspaceSeed)
    const now = new Date().toISOString()

    seed.connectRequests.unshift(
      {
        id: "connect_limit_1",
        fromUserId: "user_malik",
        toUserId: "user_olivia",
        note: "First intro",
        status: "pending",
        declineReason: null,
        createdAt: now,
        respondedAt: null,
      },
      {
        id: "connect_limit_2",
        fromUserId: "user_malik",
        toUserId: "user_sofia",
        note: "Second intro",
        status: "pending",
        declineReason: null,
        createdAt: now,
        respondedAt: null,
      },
      {
        id: "connect_limit_3",
        fromUserId: "user_malik",
        toUserId: "user_emma",
        note: "Third intro",
        status: "pending",
        declineReason: null,
        createdAt: now,
        respondedAt: null,
      },
      {
        id: "connect_limit_4",
        fromUserId: "user_malik",
        toUserId: "user_noah",
        note: "Fourth intro",
        status: "pending",
        declineReason: null,
        createdAt: now,
        respondedAt: null,
      },
      {
        id: "connect_limit_5",
        fromUserId: "user_malik",
        toUserId: "user_ava",
        note: "Fifth intro",
        status: "pending",
        declineReason: null,
        createdAt: now,
        respondedAt: null,
      },
    )

    seed.savedSearches = seed.savedSearches.filter(search => search.userId !== "user_malik")
    seed.savedSearches.unshift({
      id: "saved_limit_1",
      userId: "user_malik",
      label: "B2B SaaS operators",
      scope: "profiles",
      filters: {
        query: "",
        roles: [],
        skills: [],
        industries: [],
        location: "",
        remotePreference: "any",
        stage: "any",
        timeCommitment: "any",
        compensationType: "any",
        minimumWeeklyHours: "",
        runwayBucket: "any",
        equityPhilosophy: "any",
        equityExpectationRange: "",
      },
      createdAt: now,
    })

    const subscription = seed.subscriptions.find(item => item.userId === "user_malik")
    const usage = buildSubscriptionUsage(seed, "user_malik", subscription)

    expect(usage.intros.used).toBe(5)
    expect(usage.intros.exhausted).toBe(true)
    expect(usage.savedSearches.used).toBe(1)
    expect(usage.savedSearches.exhausted).toBe(true)
  })

  it("formats plan pricing for monthly and annual billing", () => {
    expect(getPlanPriceLabel("free", "monthly")).toBe("$0")
    expect(getPlanPriceLabel("pro", "monthly")).toBe("$29/mo")
    expect(getPlanPriceLabel("pro", "annual")).toBe("$240/yr")
  })
})
