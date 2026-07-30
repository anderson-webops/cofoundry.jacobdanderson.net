import { describe, expect, it } from "vitest"
import { getRequestIntegrityFailure } from "../../server/utils/request-integrity"

const baseRequest = {
  canonicalOrigin: "https://cofoundry.example",
  contentLength: "128",
  method: "POST",
  pathname: "/api/workspace/member",
}

describe("request integrity", () => {
  it("accepts same-origin browser writes", () => {
    expect(getRequestIntegrityFailure({
      ...baseRequest,
      hasSessionCookie: true,
      origin: "https://cofoundry.example",
      secFetchSite: "same-origin",
    })).toBeNull()
  })

  it("rejects cross-site or origin-mismatched browser writes", () => {
    expect(getRequestIntegrityFailure({
      ...baseRequest,
      hasSessionCookie: true,
      origin: "https://attacker.example",
      secFetchSite: "cross-site",
    })?.statusCode).toBe(403)
  })

  it("rejects cookie-authenticated writes without browser origin metadata", () => {
    expect(getRequestIntegrityFailure({
      ...baseRequest,
      hasSessionCookie: true,
    })?.statusCode).toBe(403)
  })

  it("allows token-authenticated server calls without a browser session cookie", () => {
    expect(getRequestIntegrityFailure({
      ...baseRequest,
      pathname: "/api/operations/events",
    })).toBeNull()
  })

  it("enforces bounded request bodies", () => {
    expect(getRequestIntegrityFailure({
      ...baseRequest,
      contentLength: String(1024 * 1024 + 1),
    })?.statusCode).toBe(413)
  })

  it("rejects malformed lengths and unbounded transfer encoding", () => {
    expect(getRequestIntegrityFailure({
      ...baseRequest,
      contentLength: "-1",
    })?.statusCode).toBe(400)

    expect(getRequestIntegrityFailure({
      ...baseRequest,
      contentLength: undefined,
    })?.statusCode).toBe(411)

    expect(getRequestIntegrityFailure({
      ...baseRequest,
      transferEncoding: "chunked",
    })?.statusCode).toBe(411)
  })
})
