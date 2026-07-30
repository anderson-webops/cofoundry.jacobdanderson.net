import { describe, expect, it } from "vitest"
import { areSeededReviewCredentialsEnabled } from "../../shared/utils/product-access"

describe("auth access policy", () => {
  it("keeps seeded review credentials disabled in production mock shells by default", () => {
    expect(areSeededReviewCredentialsEnabled({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, false)).toBe(false)
  })

  it("allows seeded review credentials only in local development", () => {
    expect(areSeededReviewCredentialsEnabled({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
    }, true)).toBe(true)

    expect(areSeededReviewCredentialsEnabled({
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: true,
    }, false)).toBe(false)
  })
})
