import { describe, expect, it } from "vitest"
import { isOAuthProviderEnabled, normalizeOAuthProvider, readConfiguredOAuthProviders } from "../../shared/utils/oauth-providers"

describe("oauth provider configuration", () => {
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

  it("does not treat non-provider marker values as enabled providers", () => {
    expect(isOAuthProviderEnabled("github", {
      COFOUNDRY_OAUTH_PROVIDER: "enabled",
    })).toBe(false)
    expect(isOAuthProviderEnabled("github", {
      COFOUNDRY_GITHUB_OAUTH_PROVIDER: "enabled",
    })).toBe(true)
  })
})
