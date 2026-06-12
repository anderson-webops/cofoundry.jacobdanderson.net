import { describe, expect, it } from "vitest"
import { buildSecurityHeaders } from "../../server/utils/security-headers"

describe("security headers", () => {
  it("sets production-safe browser security headers", () => {
    const headers = buildSecurityHeaders({
      appUrl: "https://cofoundry.example",
      isProduction: true,
    })

    expect(headers).toMatchObject({
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    })
    expect(headers["Permissions-Policy"]).toContain("camera=()")
    expect(headers["Permissions-Policy"]).toContain("microphone=()")
    expect(headers["Permissions-Policy"]).toContain("geolocation=()")
  })

  it("does not emit hsts for local or non-https origins", () => {
    expect(buildSecurityHeaders({ appUrl: "http://localhost:3000", isProduction: true })).not.toHaveProperty("Strict-Transport-Security")
    expect(buildSecurityHeaders({ appUrl: "https://cofoundry.example", isProduction: false })).not.toHaveProperty("Strict-Transport-Security")
    expect(buildSecurityHeaders({ appUrl: "", isProduction: true })).not.toHaveProperty("Strict-Transport-Security")
  })
})
