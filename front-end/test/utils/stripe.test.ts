import { afterEach, describe, expect, it, vi } from "vitest"
import { createStripeClient, validateStripeHostedUrl } from "../../server/utils/stripe"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("stripe hosted URL validation", () => {
  it("accepts only the expected HTTPS Stripe host for each billing surface", () => {
    expect(validateStripeHostedUrl(
      "https://checkout.stripe.com/c/pay/cs_test_123?prefilled_email=member%40example.com",
      "checkout",
    )).toBe("https://checkout.stripe.com/c/pay/cs_test_123?prefilled_email=member%40example.com")
    expect(validateStripeHostedUrl(
      "https://billing.stripe.com/p/session/test_123",
      "portal",
    )).toBe("https://billing.stripe.com/p/session/test_123")

    expect(validateStripeHostedUrl("https://attacker.example/c/pay/cs_test_123", "checkout")).toBeNull()
    expect(validateStripeHostedUrl("http://checkout.stripe.com/c/pay/cs_test_123", "checkout")).toBeNull()
    expect(validateStripeHostedUrl("https://billing.stripe.com/p/session/test_123", "checkout")).toBeNull()
    expect(validateStripeHostedUrl(null, "portal")).toBeNull()
  })
})

describe("stripe client configuration", () => {
  it("uses the API version supported by the installed SDK", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture")
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { billingMode: "stripe" }
    }))

    expect(createStripeClient()?.getApiField("version")).toBe("2026-09-30.endive")
  })
})
