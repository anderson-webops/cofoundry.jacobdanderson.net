import { describe, expect, it } from "vitest"
import { buildSecurityHeaders } from "../../server/utils/security-headers"

describe("security headers", () => {
  it("sets production-safe browser security headers", () => {
    const headers = buildSecurityHeaders({
      appUrl: "https://cofoundry.example",
      isProduction: true,
    })

    expect(headers).toMatchObject({
      "Content-Security-Policy": expect.stringContaining("default-src 'self'"),
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    })
    expect(headers["Permissions-Policy"]).toContain("camera=()")
    expect(headers["Permissions-Policy"]).toContain("microphone=()")
    expect(headers["Permissions-Policy"]).toContain("geolocation=()")
    expect(headers["Content-Security-Policy"]).toContain("object-src 'none'")
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'")
    expect(headers["Content-Security-Policy"]).toContain("https://analytics.cofoundry.jacobdanderson.net")
    expect(headers["Content-Security-Policy"]).toContain("https://analytics.jacobdanderson.net")
  })

  it("does not emit production-only headers for local development", () => {
    expect(buildSecurityHeaders({ appUrl: "https://cofoundry.example", isProduction: false })).not.toHaveProperty("Content-Security-Policy")
  })

  it("does not emit hsts for local or non-https origins", () => {
    expect(buildSecurityHeaders({ appUrl: "http://localhost:3000", isProduction: true })).not.toHaveProperty("Strict-Transport-Security")
    expect(buildSecurityHeaders({ appUrl: "https://cofoundry.example", isProduction: false })).not.toHaveProperty("Strict-Transport-Security")
    expect(buildSecurityHeaders({ appUrl: "", isProduction: true })).not.toHaveProperty("Strict-Transport-Security")
  })

  it("adds live-provider CSP origins only when the relevant modes are configured", () => {
    const mockHeaders = buildSecurityHeaders({
      appUrl: "https://cofoundry.example",
      backendMode: "mock",
      billingMode: "mock",
      isProduction: true,
    })
    expect(mockHeaders["Content-Security-Policy"]).not.toContain("supabase.co")
    expect(mockHeaders["Content-Security-Policy"]).not.toContain("js.stripe.com")

    const liveHeaders = buildSecurityHeaders({
      appUrl: "https://cofoundry.example",
      backendMode: "supabase",
      billingMode: "stripe",
      isProduction: true,
      stripePublishableKey: "pk_test_123",
      supabaseUrl: "https://project.supabase.co",
    })
    expect(liveHeaders["Content-Security-Policy"]).toContain("https://project.supabase.co")
    expect(liveHeaders["Content-Security-Policy"]).toContain("https://js.stripe.com")
    expect(liveHeaders["Content-Security-Policy"]).toContain("https://checkout.stripe.com")
  })
})
