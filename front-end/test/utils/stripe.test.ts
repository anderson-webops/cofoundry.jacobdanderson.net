import { describe, expect, it } from "vitest"
import { validateStripeHostedUrl } from "../../server/utils/stripe"

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
