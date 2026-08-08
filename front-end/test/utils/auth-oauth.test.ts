import { describe, expect, it } from "vitest"
import { inferSupabaseOAuthProvider, resolveProvisionedInvestmentReviewerSession, validateSupabaseOAuthRedirectUrl } from "../../server/utils/auth"
import { isOAuthProviderEnabled, normalizeOAuthProvider, readConfiguredOAuthProviders } from "../../shared/utils/oauth-providers"

describe("oauth provider configuration", () => {
  it("uses the provisioned Supabase role for verified investment reviewers", () => {
    const input = {
      email: "priya@cofoundry.dev",
      id: "user_priya",
      name: "Priya Shah",
      onboardingCompleted: false,
      role: "founder" as const,
      subscriptionPlan: "free" as const,
    }

    expect(resolveProvisionedInvestmentReviewerSession({
      email: input.email,
      id: input.id,
      onboarding_completed: true,
      role: "investor_admin",
      suspended_at: null,
      verified_email: true,
    }, input)).toMatchObject({
      onboardingCompleted: true,
      role: "investor_admin",
    })
    expect(resolveProvisionedInvestmentReviewerSession({
      email: input.email,
      id: input.id,
      onboarding_completed: true,
      role: "investor_admin",
      suspended_at: null,
      verified_email: false,
    }, input)).toBeNull()
  })

  it("normalizes only supported production OAuth providers", () => {
    expect(normalizeOAuthProvider("github")).toBe("github")
    expect(normalizeOAuthProvider("Google")).toBe("google")
    expect(normalizeOAuthProvider("email")).toBeNull()
    expect(normalizeOAuthProvider("linkedin")).toBeNull()
  })

  it("reads provider-specific and generic OAuth markers", () => {
    const providers = readConfiguredOAuthProviders({
      COFOUNDRY_GITHUB_OAUTH_PROVIDER: "github-app-id",
      COFOUNDRY_GOOGLE_OAUTH_PROVIDER: "",
      COFOUNDRY_OAUTH_PROVIDER: "google",
    })

    expect([...providers].sort()).toEqual(["github", "google"])
  })

  it("supports comma and space separated generic provider markers", () => {
    const providers = readConfiguredOAuthProviders({
      COFOUNDRY_OAUTH_PROVIDER: "google, github",
    })

    expect([...providers]).toEqual(["google", "github"])
  })

  it("does not treat non-provider marker values as enabled providers", () => {
    expect(isOAuthProviderEnabled("github", {
      COFOUNDRY_OAUTH_PROVIDER: "enabled",
    })).toBe(false)
    expect(isOAuthProviderEnabled("github", {
      COFOUNDRY_GITHUB_OAUTH_PROVIDER: "enabled",
    })).toBe(true)
  })

  it("uses the authenticated identity provider instead of an untrusted callback hint", () => {
    const user = {
      app_metadata: {
        provider: "google",
        providers: ["google"],
      },
      identities: [{ provider: "google" }],
    } as Parameters<typeof inferSupabaseOAuthProvider>[0]

    expect(inferSupabaseOAuthProvider(user, "github")).toBe("google")
  })

  it("accepts only the configured Supabase OAuth authorization endpoint and provider", () => {
    expect(validateSupabaseOAuthRedirectUrl(
      "https://project.supabase.co/auth/v1/authorize?provider=github&redirect_to=https%3A%2F%2Fcofoundry.example%2Fcallback",
      "https://project.supabase.co",
      "github",
    )).toBe("https://project.supabase.co/auth/v1/authorize?provider=github&redirect_to=https%3A%2F%2Fcofoundry.example%2Fcallback")

    expect(validateSupabaseOAuthRedirectUrl(
      "https://attacker.example/auth/v1/authorize?provider=github",
      "https://project.supabase.co",
      "github",
    )).toBeNull()
    expect(validateSupabaseOAuthRedirectUrl(
      "https://project.supabase.co/auth/v1/token?provider=github",
      "https://project.supabase.co",
      "github",
    )).toBeNull()
    expect(validateSupabaseOAuthRedirectUrl(
      "https://project.supabase.co/auth/v1/authorize?provider=google",
      "https://project.supabase.co",
      "github",
    )).toBeNull()
    expect(validateSupabaseOAuthRedirectUrl(
      "http://project.supabase.co/auth/v1/authorize?provider=github",
      "http://project.supabase.co",
      "github",
    )).toBeNull()
  })

  it("allows the local Supabase OAuth endpoint during local development", () => {
    expect(validateSupabaseOAuthRedirectUrl(
      "http://127.0.0.1:54321/auth/v1/authorize?provider=google",
      "http://127.0.0.1:54321",
      "google",
    )).toBe("http://127.0.0.1:54321/auth/v1/authorize?provider=google")
  })
})
