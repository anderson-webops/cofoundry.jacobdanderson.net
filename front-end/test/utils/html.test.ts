import { describe, expect, it } from "vitest"
import { serializeJsonForHtml } from "../../shared/utils/html"

describe("html-safe JSON serialization", () => {
  it("prevents structured data from closing its script element", () => {
    const serialized = serializeJsonForHtml({
      name: "</script><script>alert(1)</script>",
      separator: "\u2028\u2029",
    })

    expect(serialized).not.toContain("<")
    expect(serialized).toContain("\\u003c/script>")
    expect(serialized).toContain("\\u2028\\u2029")
  })
})
