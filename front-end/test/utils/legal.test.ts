import { describe, expect, it } from "vitest"
import {
  privacyDataCategories,
  privacyKeyNotes,
  privacyLastUpdated,
  privacyRetentionRows,
  privacySections,
  privacyVisibilityTiers,
  termsKeyNotes,
  termsLastUpdated,
  termsSections,
} from "../../shared/data/legal"

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

  it("defines a current privacy update date and key privacy notes", () => {
    expect(privacyLastUpdated).toBe("April 11, 2026")
    expect(privacyKeyNotes).toHaveLength(4)
    expect(privacyVisibilityTiers).toHaveLength(4)
    expect(privacyDataCategories).toHaveLength(6)
    expect(privacyRetentionRows).toHaveLength(5)
  })

  it("covers the core privacy surfaces for CoFoundry", () => {
    const sectionIds = privacySections.map(section => section.id)

    expect(sectionIds).toContain("visibility-controls")
    expect(sectionIds).toContain("sharing")
    expect(sectionIds).toContain("tracking-storage")
    expect(sectionIds).toContain("retention-deletion")
    expect(sectionIds).toContain("rights-choices")
    expect(sectionIds).toContain("international-transfers")
    expect(sectionIds).toContain("investment-features")
    expect(privacySections).toHaveLength(16)
  })
})
