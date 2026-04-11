import { describe, expect, it } from "vitest"
import { collectEnvironmentValidationErrors, readPublicEnvironment } from "../../shared/utils/environment"

describe("environment helpers", () => {
  it("keeps localhost defaults only for local mock development", () => {
    const environment = readPublicEnvironment({
      NODE_ENV: "development",
    })

    expect(environment.appUrl).toBe("http://localhost:3000")
    expect(environment.backendMode).toBe("mock")
    expect(environment.billingMode).toBe("mock")
  })

  it("does not inject a localhost app url into production by default", () => {
    const environment = readPublicEnvironment({
      NODE_ENV: "production",
    })

    expect(environment.appUrl).toBe("")
  })

  it("requires public and secret supabase values when supabase mode is enabled", () => {
    const errors = collectEnvironmentValidationErrors({
      NUXT_PUBLIC_BACKEND_MODE: "supabase",
    })

    expect(errors).toContain("NUXT_PUBLIC_SUPABASE_URL is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
    expect(errors).toContain("NUXT_PUBLIC_SUPABASE_ANON_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
    expect(errors).toContain("SUPABASE_SERVICE_ROLE_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
  })

  it("requires public and secret stripe values when stripe billing mode is enabled", () => {
    const errors = collectEnvironmentValidationErrors({
      NUXT_PUBLIC_BILLING_MODE: "stripe",
    })

    expect(errors).toContain("NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")
    expect(errors).toContain("NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")
    expect(errors).toContain("NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")
    expect(errors).toContain("STRIPE_SECRET_KEY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")
    expect(errors).toContain("STRIPE_WEBHOOK_SECRET is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")
  })
})
