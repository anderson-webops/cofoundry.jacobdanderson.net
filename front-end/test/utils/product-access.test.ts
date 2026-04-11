import { describe, expect, it } from "vitest"
import { getPricingTierCta, resolveProductAccessPolicy } from "../../shared/utils/product-access"

describe("product access policy", () => {
  it("keeps local mock development fully usable", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, true)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.marketingShellOnly).toBe(false)
    expect(policy.showDemoConveniences).toBe(true)
  })

  it("treats production mock mode as a marketing shell by default", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, false)

    expect(policy.accountsEnabled).toBe(false)
    expect(policy.marketingShellOnly).toBe(true)
    expect(policy.showDemoConveniences).toBe(false)
  })

  it("allows deliberate staging demos behind an explicit flag", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: true,
    }, false)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.showDemoConveniences).toBe(true)
  })

  it("enables self-serve billing only when live accounts and stripe are both enabled", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "supabase",
      billingMode: "stripe",
      enableDemoAccess: false,
    }, false)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.selfServeBillingEnabled).toBe(true)
  })

  it("routes paid pricing CTAs to contact when self-serve billing is unavailable", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, false)

    expect(getPricingTierCta(policy, "free", "pricing-free")).toEqual({
      label: "Request access",
      to: "/contact?source=pricing-free&topic=access",
    })
    expect(getPricingTierCta(policy, "pro", "pricing-pro")).toEqual({
      label: "Talk to the team",
      to: "/contact?source=pricing-pro&topic=pricing",
    })
  })
})
