import { describe, expect, it } from "vitest"
import { buildSecurityTxt } from "../../server/utils/security-txt"

describe("security.txt", () => {
  it("publishes a canonical security contact disclosure", () => {
    const body = buildSecurityTxt({
      appUrl: "https://cofoundry.example/",
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      supportEmail: " Security@CoFoundry.dev ",
    })

    expect(body).toContain("Contact: mailto:security@cofoundry.dev")
    expect(body).toContain("Expires: 2026-12-31T00:00:00.000Z")
    expect(body).toContain("Preferred-Languages: en")
    expect(body).toContain("Canonical: https://cofoundry.example/.well-known/security.txt")
    expect(body).toContain("Policy: https://cofoundry.example/safety")
    expect(body.endsWith("\n")).toBe(true)
  })
})
