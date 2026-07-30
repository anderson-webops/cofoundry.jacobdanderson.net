import { describe, expect, it } from "vitest"
import { sanitizeErrorResponseBody } from "../../server/utils/error-response"

describe("server error response sanitization", () => {
  it("removes query strings and fragments from reflected request URLs", () => {
    expect(sanitizeErrorResponseBody({
      error: true,
      message: "Invalid request.",
      url: "https://cofoundry.example/api/example?token=secret#fragment",
    }, "/api/example")).toMatchObject({
      message: "Invalid request.",
      url: "/api/example",
    })
  })
})
