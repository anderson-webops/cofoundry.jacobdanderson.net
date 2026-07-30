import { describe, expect, it } from "vitest"
import { getPricingTierCta, getSecondaryAccessCta, resolveProductAccessPolicy } from "../../shared/utils/product-access"

describe("product access policy", () => {
  it("keeps local mock development fully usable", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, true)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.marketingShellOnly).toBe(false)
    expect(policy.mockBillingPreviewEnabled).toBe(true)
    expect(policy.operatorManagedBilling).toBe(false)
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
    expect(policy.mockBillingPreviewEnabled).toBe(false)
    expect(policy.operatorManagedBilling).toBe(false)
    expect(policy.showDemoConveniences).toBe(false)
    expect(policy.signInEnabled).toBe(true)
  })

  it("does not expose bundled demo accounts on hosted staging origins", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: true,
    }, false)

    expect(policy.accountsEnabled).toBe(false)
    expect(policy.mockBillingPreviewEnabled).toBe(false)
    expect(policy.operatorManagedBilling).toBe(false)
    expect(policy.showDemoConveniences).toBe(false)
  })

  it("treats live accounts without Stripe as operator-managed billing", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "supabase",
      billingMode: "mock",
      enableDemoAccess: false,
    }, false)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.selfServeBillingEnabled).toBe(false)
    expect(policy.mockBillingPreviewEnabled).toBe(false)
    expect(policy.operatorManagedBilling).toBe(true)
  })

  it("keeps local Supabase development with mock billing in preview mode", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "supabase",
      billingMode: "mock",
      enableDemoAccess: false,
    }, true)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.mockBillingPreviewEnabled).toBe(true)
    expect(policy.operatorManagedBilling).toBe(false)
  })

  it("enables self-serve billing only when live accounts and stripe are both enabled", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "supabase",
      billingMode: "stripe",
      enableDemoAccess: false,
    }, false)

    expect(policy.accountsEnabled).toBe(true)
    expect(policy.operatorManagedBilling).toBe(false)
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
      to: "/auth/sign-up?source=pricing-free",
    })
    expect(getPricingTierCta(policy, "pro", "pricing-pro")).toEqual({
      label: "Talk to the team",
      to: "/contact?source=pricing-pro&topic=pricing",
    })
  })

  it("keeps sign-in visible even when self-serve account creation is closed", () => {
    const policy = resolveProductAccessPolicy({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, false)

    expect(getSecondaryAccessCta(policy, "site-header")).toEqual({
      label: "Sign in",
      to: "/auth/sign-in",
    })
  })
})
