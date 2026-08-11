import { describe, expect, it } from "vitest"
import { getPreferenceCookieOptions, getSessionCookieSecurityOptions, getSessionCookieWriteOptions } from "../../shared/utils/cookie-policy"

describe("cookie policy", () => {
  it("uses matching security attributes for session writes and deletion", () => {
    const security = getSessionCookieSecurityOptions(true)
    const write = getSessionCookieWriteOptions(true, 900)

    expect(security).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    })
    expect(write).toMatchObject(security)
    expect(write.maxAge).toBe(900)
    expect(security).not.toHaveProperty("maxAge")
  })

  it("keeps preference cookies script-readable but production-safe", () => {
    expect(getPreferenceCookieOptions(true, 3600)).toEqual({
      httpOnly: false,
      maxAge: 3600,
      path: "/",
      sameSite: "lax",
      secure: true,
    })
  })
})
