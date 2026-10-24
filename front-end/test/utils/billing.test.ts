import { describe, expect, it } from "vitest"
import { pricingTiers } from "../../shared/data/marketing"
import { workspaceSeed } from "../../shared/data/seed"
import { buildSubscriptionUsage, checkSavedSearchCount, checkSubscriptionGate, getPlanLimits, getPlanPriceLabel, getSubscriptionEntitlements, hasPaidContractWorkflowSponsor } from "../../shared/utils/billing"

describe("billing helpers", () => {
  it("exposes enforced plan limits for every public pricing tier", () => {
    for (const tier of pricingTiers) {
      const limits = getPlanLimits(tier.id)

      expect(limits.introLimit === null || limits.introLimit > 0).toBe(true)
      expect(limits.proposalSendLimit === null || limits.proposalSendLimit > 0).toBe(true)
      expect(limits.contractDraftLimit === null || limits.contractDraftLimit > 0).toBe(true)
    }

    expect(getPlanLimits("free").canSignContracts).toBe(false)
    expect(getPlanLimits("pro").introLimit).toBe(40)
  })

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

  it("lets one paid participant sponsor the shared agreement workflow", () => {
    const seed = structuredClone(workspaceSeed)
    const contract = seed.contracts.find(item => item.id === "contract_ledgerloop")!

    expect(seed.subscriptions.find(item => item.userId === "user_olivia")?.plan).toBe("pro")
    expect(seed.subscriptions.find(item => item.userId === "user_malik")?.plan).toBe("free")
    expect(hasPaidContractWorkflowSponsor(seed, contract)).toBe(true)

    const sponsor = seed.subscriptions.find(item => item.userId === "user_olivia")!
    sponsor.status = "canceled"
    expect(hasPaidContractWorkflowSponsor(seed, contract)).toBe(false)
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

  it("blocks server-side actions when plan limits are exhausted", () => {
    const seed = structuredClone(workspaceSeed)
    const now = new Date().toISOString()

    seed.connectRequests = seed.connectRequests.filter(request => request.fromUserId !== "user_malik")
    for (let index = 0; index < 5; index += 1) {
      seed.connectRequests.unshift({
        id: `connect_gate_${index}`,
        fromUserId: "user_malik",
        toUserId: "user_olivia",
        note: "Intro gate check",
        status: "pending",
        declineReason: null,
        createdAt: now,
        respondedAt: null,
      })
    }

    const subscription = seed.subscriptions.find(item => item.userId === "user_malik")
    const gate = checkSubscriptionGate(seed, "user_malik", subscription, "send_intro")

    expect(gate.allowed).toBe(false)
    expect(gate.reason).toContain("no structured intros left")
  })

  it("allows replacing an existing saved search but blocks adding over the limit", () => {
    const subscription = workspaceSeed.subscriptions.find(item => item.userId === "user_malik")

    expect(checkSavedSearchCount(subscription, 1).allowed).toBe(true)
    expect(checkSavedSearchCount(subscription, 2).allowed).toBe(false)
  })

  it("formats plan pricing for monthly and annual billing", () => {
    expect(getPlanPriceLabel("free", "monthly")).toBe("$0")
    expect(getPlanPriceLabel("pro", "monthly")).toBe("$29/mo")
    expect(getPlanPriceLabel("pro", "annual")).toBe("$240/yr")
  })

  it("fails closed to free entitlements when a paid subscription is not active", () => {
    const entitlements = getSubscriptionEntitlements({
      id: "subscription_canceled",
      userId: "user_canceled",
      plan: "team",
      status: "canceled",
      billingCycle: "monthly",
      renewsAt: null,
      cancelAtPeriodEnd: false,
      visibilityBoost: true,
      unlimitedMessaging: true,
      proposalWorkflow: true,
      contractBuilder: true,
    })

    expect(entitlements.plan).toBe("free")
    expect(entitlements.canSignContracts).toBe(false)
    expect(entitlements.hasVisibilityBoost).toBe(false)
  })
})
