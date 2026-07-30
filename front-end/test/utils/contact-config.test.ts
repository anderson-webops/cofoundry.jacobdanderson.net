import process from "node:process"
import { afterEach, describe, expect, it } from "vitest"
import { getContactMailConfig } from "../../server/utils/contact"

const managedKeys = [
  "CONTACT_BCC_EMAIL",
  "CONTACT_FROM_EMAIL",
  "CONTACT_SENDMAIL_PATH",
  "CONTACT_SENDMAIL_TIMEOUT_MS",
  "CONTACT_SMTP_HOST",
  "CONTACT_SMTP_PASS",
  "CONTACT_SMTP_REQUIRE_TLS",
  "CONTACT_SMTP_USER",
] as const
const originalValues = Object.fromEntries(managedKeys.map(key => [key, process.env[key]]))

afterEach(() => {
  for (const key of managedKeys) {
    const value = originalValues[key]
    if (typeof value === "undefined")
      delete process.env[key]
    else
      process.env[key] = value
  }
})

describe("contact mail configuration", () => {
  it("requires STARTTLS by default for authenticated submission", () => {
    process.env.CONTACT_FROM_EMAIL = "sender@example.com"
    process.env.CONTACT_SMTP_HOST = "smtp.example.com"
    process.env.CONTACT_SMTP_USER = "sender"
    process.env.CONTACT_SMTP_PASS = "secret"
    delete process.env.CONTACT_SMTP_REQUIRE_TLS

    expect(getContactMailConfig()).toMatchObject({
      kind: "smtp",
      requireTLS: true,
      secure: false,
    })
  })

  it("rejects authenticated cleartext SMTP and relative sendmail paths", () => {
    process.env.CONTACT_FROM_EMAIL = "sender@example.com"
    process.env.CONTACT_SMTP_HOST = "smtp.example.com"
    process.env.CONTACT_SMTP_USER = "sender"
    process.env.CONTACT_SMTP_PASS = "secret"
    process.env.CONTACT_SMTP_REQUIRE_TLS = "false"

    expect(() => getContactMailConfig()).toThrow(/requires implicit TLS or STARTTLS/)

    delete process.env.CONTACT_SMTP_HOST
    delete process.env.CONTACT_SMTP_USER
    delete process.env.CONTACT_SMTP_PASS
    process.env.CONTACT_SENDMAIL_PATH = "sendmail"

    expect(() => getContactMailConfig()).toThrow(/absolute executable path/)
  })

  it("rejects malformed envelope addresses without complex matching", () => {
    process.env.CONTACT_FROM_EMAIL = "sender@@example.com"
    process.env.CONTACT_SMTP_HOST = "smtp.example.com"

    expect(() => getContactMailConfig()).toThrow(/valid single email address/)

    process.env.CONTACT_FROM_EMAIL = "sender@example.com"
    process.env.CONTACT_BCC_EMAIL = "valid@example.com,invalid address@example.com"

    expect(() => getContactMailConfig()).toThrow(/valid single email address/)
  })

  it("bounds sendmail execution time", () => {
    process.env.CONTACT_FROM_EMAIL = "sender@example.com"
    process.env.CONTACT_SENDMAIL_PATH = "/usr/sbin/sendmail"
    process.env.CONTACT_SENDMAIL_TIMEOUT_MS = "60001"

    expect(() => getContactMailConfig()).toThrow(/CONTACT_SENDMAIL_TIMEOUT_MS/)
  })
})
