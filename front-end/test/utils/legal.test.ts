import { describe, expect, it } from "vitest"
import { termsKeyNotes, termsLastUpdated, termsSections } from "../../shared/data/legal"

describe("legal content", () => {
  it("defines a current terms update date and key platform notes", () => {
    expect(termsLastUpdated).toBe("April 11, 2026")
    expect(termsKeyNotes).toHaveLength(4)
  })

  it("covers the core legal surfaces for CoFoundry", () => {
    const sectionIds = termsSections.map(section => section.id)

    expect(sectionIds).toContain("billing")
    expect(sectionIds).toContain("trust-safety")
    expect(sectionIds).toContain("proposals-templates")
    expect(sectionIds).toContain("investment-module")
    expect(sectionIds).toContain("disputes")
    expect(termsSections).toHaveLength(18)
  })
})
