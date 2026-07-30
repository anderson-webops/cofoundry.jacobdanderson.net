import { describe, expect, it } from "vitest"
import { collectEnvironmentValidationErrors, isLocalDevelopmentEnvironment, isLoopbackBackendHost, readDeploymentMetadata, readPublicEnvironment, releaseTagFromPackageVersion } from "../../shared/utils/environment"

describe("environment helpers", () => {
  it("recognizes only explicit loopback backend hosts", () => {
    expect(isLoopbackBackendHost("LOCALHOST")).toBe(true)
    expect(isLoopbackBackendHost("127.0.0.1")).toBe(true)
    expect(isLoopbackBackendHost("0.0.0.0")).toBe(false)
  })

  it("requires a strong operations token for a non-loopback backend bind", () => {
    const errors = collectEnvironmentValidationErrors({
      BACKEND_HOST: "0.0.0.0",
      COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND: "true",
    })

    expect(errors).toContain("A strong COFOUNDRY_OPERATIONS_TOKEN is required whenever BACKEND_HOST uses a non-loopback address.")
  })

  it("rejects malformed public support addresses", () => {
    const errors = collectEnvironmentValidationErrors({
      NUXT_PUBLIC_SUPPORT_EMAIL: "security@cofoundry.dev\nPolicy: https://attacker.example",
    })

    expect(errors).toContain("NUXT_PUBLIC_SUPPORT_EMAIL must be a valid single email address.")
  })

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
    expect(isLocalDevelopmentEnvironment({ NUXT_PUBLIC_APP_URL: "https://cofoundry.example" })).toBe(false)
    expect(errors).toContain("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")
  })

  it("keeps explicitly configured localhost urls in local development mode", () => {
    const environment = readPublicEnvironment({
      NUXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    })

    expect(environment.appUrl).toBe("http://127.0.0.1:3000")
    expect(isLocalDevelopmentEnvironment({ NUXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" })).toBe(true)
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

  it("uses build metadata as a deployment fallback without overriding host env", () => {
    expect(readDeploymentMetadata({}, {
      commitSha: "build-sha",
      deployedAt: "2026-06-12T12:30:00.000Z",
      release: "v1.1.80",
    })).toEqual({
      commitSha: "build-sha",
      deployedAt: "2026-06-12T12:30:00.000Z",
      release: "v1.1.80",
    })

    expect(readDeploymentMetadata({
      COFOUNDRY_COMMIT_SHA: "host-sha",
      COFOUNDRY_RELEASE: "v1.1.81",
    }, {
      commitSha: "build-sha",
      deployedAt: "2026-06-12T12:30:00.000Z",
      release: "v1.1.80",
    })).toEqual({
      commitSha: "host-sha",
      deployedAt: "2026-06-12T12:30:00.000Z",
      release: "v1.1.81",
    })
  })

  it("normalizes package versions into release-tag fallbacks", () => {
    expect(releaseTagFromPackageVersion("1.1.105")).toBe("v1.1.105")
    expect(releaseTagFromPackageVersion(" 1.1.106-beta.1 ")).toBe("v1.1.106-beta.1")
    expect(releaseTagFromPackageVersion("local-release")).toBe("")
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
    expect(errors).toContain("COFOUNDRY_OPERATIONS_TOKEN is required in a non-local environment.")
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
    expect(errors).toContain("NUXT_PUBLIC_BILLING_MODE=\"stripe\" requires NUXT_PUBLIC_BACKEND_MODE=\"supabase\" for durable subscription reconciliation.")
  })

  it("requires distinct Stripe prices and credentials", () => {
    const errors = collectEnvironmentValidationErrors({
      NUXT_PUBLIC_BACKEND_MODE: "supabase",
      NUXT_PUBLIC_BILLING_MODE: "stripe",
      NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY: "price_shared",
      NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY: "price_shared",
      NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "stripe-shared-credential",
      NUXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NUXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      STRIPE_SECRET_KEY: "stripe-shared-credential",
      STRIPE_WEBHOOK_SECRET: "stripe-shared-credential",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    })

    expect(errors).toContain("The Stripe Pro and Team price IDs must be different.")
    expect(errors).toContain("Stripe publishable, secret, and webhook credentials must be different.")
  })

  it("requires a session signing secret when staged review access is enabled outside local development", () => {
    const errors = collectEnvironmentValidationErrors({
      NODE_ENV: "production",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    })

    expect(errors).toContain("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")
    expect(errors).toContain("NUXT_PUBLIC_ENABLE_DEMO_ACCESS must be false outside local development.")
  })

  it("requires a canonical HTTPS URL and strong session secret in production", () => {
    const errors = collectEnvironmentValidationErrors({
      NODE_ENV: "production",
      NUXT_PUBLIC_APP_URL: "http://localhost:3000",
      SESSION_SIGNING_SECRET: "short",
    })

    expect(errors).toContain("NUXT_PUBLIC_APP_URL must not use a local origin in production.")
    expect(errors).toContain("NUXT_PUBLIC_APP_URL must use HTTPS in production.")
    expect(errors).toContain("SESSION_SIGNING_SECRET must be at least 32 characters in a non-local environment.")
  })

  it("requires an explicit direct-proxy allowlist before trusting forwarded headers", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_TRUST_PROXY_HEADERS: "true",
    })

    expect(errors).toContain("COFOUNDRY_TRUSTED_PROXY_IPS is required when COFOUNDRY_TRUST_PROXY_HEADERS=true.")
  })

  it("rejects broad or malformed trusted-proxy ranges", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_TRUSTED_PROXY_IPS: "0.0.0.0/0",
      COFOUNDRY_TRUST_PROXY_HEADERS: "true",
      NODE_ENV: "production",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
      NUXT_PUBLIC_BACKEND_MODE: "mock",
      NUXT_PUBLIC_BILLING_MODE: "mock",
      SESSION_SIGNING_SECRET: "a".repeat(32),
    })

    expect(errors).toContain("COFOUNDRY_TRUSTED_PROXY_IPS must contain only exact proxy host addresses (/32 or /128), not broad or malformed ranges.")
  })

  it("rejects weak operations worker tokens", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_OPERATIONS_TOKEN: "short-token",
    })

    expect(errors).toContain("COFOUNDRY_OPERATIONS_TOKEN must be at least 32 characters when it is configured.")
  })

  it("requires canonical origins and distinct deployment credentials", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_OPERATIONS_TOKEN: "same-secret-value-at-least-32-characters",
      NODE_ENV: "production",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example/admin?from=host",
      NUXT_PUBLIC_BACKEND_MODE: "supabase",
      NUXT_PUBLIC_SUPABASE_ANON_KEY: "shared-supabase-key",
      NUXT_PUBLIC_SUPABASE_URL: "http://supabase.example/auth",
      SESSION_SIGNING_SECRET: "same-secret-value-at-least-32-characters",
      SUPABASE_SERVICE_ROLE_KEY: "shared-supabase-key",
    })

    expect(errors).toContain("NUXT_PUBLIC_APP_URL must be an origin without credentials, a path, query parameters, or a fragment.")
    expect(errors).toContain("NUXT_PUBLIC_SUPABASE_URL must be an origin without credentials, a path, query parameters, or a fragment.")
    expect(errors).toContain("NUXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be different credentials.")
    expect(errors).toContain("COFOUNDRY_OPERATIONS_TOKEN and SESSION_SIGNING_SECRET must be different secrets.")
  })

  it("rejects multi-instance hosted operation until rate limits are shared", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_APP_INSTANCE_COUNT: "2",
      COFOUNDRY_EXPECT_MULTI_INSTANCE: "true",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
      SESSION_SIGNING_SECRET: "a-secure-session-signing-secret-32",
    })

    expect(errors).toContain("Multi-instance production is unsupported until CoFoundry has a shared atomic rate limiter; run exactly one app process.")
  })

  it("keeps realtime fanout off production and isolates cross-origin relay credentials", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_OPERATIONS_TOKEN: "operations-token-value-at-least-32-chars",
      COFOUNDRY_REALTIME_FANOUT_TOKEN: "operations-token-value-at-least-32-chars",
      COFOUNDRY_REALTIME_FANOUT_URL: "https://relay.example/events",
      NODE_ENV: "production",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
      SESSION_SIGNING_SECRET: "a-distinct-session-signing-secret-value",
    })

    expect(errors).toContain("COFOUNDRY_REALTIME_FANOUT_URL must be unset in production until shared rate limiting is implemented.")
    expect(errors).toContain("COFOUNDRY_REALTIME_FANOUT_TOKEN must be different from operations and session secrets.")
  })

  it("validates multi-instance topology markers", () => {
    const errors = collectEnvironmentValidationErrors({
      COFOUNDRY_APP_INSTANCE_COUNT: "many",
      COFOUNDRY_EXPECT_MULTI_INSTANCE: "sometimes",
    })

    expect(errors).toContain("COFOUNDRY_EXPECT_MULTI_INSTANCE must be true or false when it is set.")
    expect(errors).toContain("COFOUNDRY_APP_INSTANCE_COUNT must be a positive integer when it is set.")
  })
})
