import { describe, expect, it } from "vitest"
import { collectEnvironmentValidationErrors, readDeploymentMetadata, readPublicEnvironment } from "../../shared/utils/environment"

describe("environment helpers", () => {
  it("keeps localhost defaults only for local mock development", () => {
    const environment = readPublicEnvironment({
      NODE_ENV: "development",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    })

    expect(environment.appUrl).toBe("http://localhost:3000")
    expect(environment.backendMode).toBe("mock")
    expect(environment.billingMode).toBe("mock")
    expect(environment.enableDemoAccess).toBe(true)
  })

  it("does not inject a localhost app url into production by default", () => {
    const environment = readPublicEnvironment({
      NODE_ENV: "production",
    })

    expect(environment.appUrl).toBe("")
  })

  it("treats a configured non-local app url as hosted even when NODE_ENV is omitted", () => {
    const environment = readPublicEnvironment({
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    })
    const errors = collectEnvironmentValidationErrors({
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    })

    expect(environment.appUrl).toBe("https://cofoundry.example")
    expect(errors).toContain("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")
  })

  it("keeps explicitly configured localhost urls in local development mode", () => {
    const environment = readPublicEnvironment({
      NUXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    })

    expect(environment.appUrl).toBe("http://127.0.0.1:3000")
  })

  it("reads safe deployment metadata from canonical or deploy-provider env", () => {
    expect(readDeploymentMetadata({
      BUILD_TIMESTAMP: "2026-06-12T11:55:00.000Z",
      RELEASE_VERSION: "v1.1.78",
      SOURCE_VERSION: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
    })).toEqual({
      commitSha: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
      deployedAt: "2026-06-12T11:55:00.000Z",
      release: "v1.1.78",
    })

    expect(readDeploymentMetadata({
      COFOUNDRY_COMMIT_SHA: "cofoundry-sha",
      COFOUNDRY_DEPLOYED_AT: "2026-06-12T12:00:00.000Z",
      COFOUNDRY_RELEASE: "v1.1.79",
      SOURCE_VERSION: "source-version",
    })).toEqual({
      commitSha: "cofoundry-sha",
      deployedAt: "2026-06-12T12:00:00.000Z",
      release: "v1.1.79",
    })
  })

  it("requires public and secret supabase values when supabase mode is enabled", () => {
    const errors = collectEnvironmentValidationErrors({
      NODE_ENV: "production",
      NUXT_PUBLIC_BACKEND_MODE: "supabase",
    })

    expect(errors).toContain("NUXT_PUBLIC_SUPABASE_URL is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
    expect(errors).toContain("NUXT_PUBLIC_SUPABASE_ANON_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
    expect(errors).toContain("SUPABASE_SERVICE_ROLE_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
    expect(errors).toContain("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")
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

  it("requires a session signing secret when staged review access is enabled outside local development", () => {
    const errors = collectEnvironmentValidationErrors({
      NODE_ENV: "production",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    })

    expect(errors).toContain("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")
  })
})
