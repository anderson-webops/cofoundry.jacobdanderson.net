import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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

const pagesRoot = resolve(process.cwd(), "src/pages")
const stylesRoot = resolve(process.cwd(), "src/assets/styles")

function readPageSource(page: "privacy" | "terms") {
  return readFileSync(resolve(pagesRoot, `${page}.vue`), "utf8")
}

describe("legal content", () => {
  it("defines a current terms update date and key platform notes", () => {
    expect(termsLastUpdated).toBe("August 8, 2026")
    expect(termsKeyNotes).toHaveLength(6)
    expect(termsKeyNotes.some(note => note.title === "Legal review stays user-directed")).toBe(true)
    expect(termsKeyNotes.some(note => note.title === "Team workspaces are role-controlled")).toBe(true)
    expect(termsKeyNotes.some(note => note.title === "Optional investment workspace is separate")).toBe(true)
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
    expect(privacyLastUpdated).toBe("August 8, 2026")
    expect(privacyKeyNotes).toHaveLength(5)
    expect(privacyVisibilityTiers).toHaveLength(7)
    expect(privacyDataCategories).toHaveLength(8)
    expect(privacyRetentionRows).toHaveLength(7)
    expect(privacyDataCategories.find(row => row.category === "Messages, proposals, and contract data")?.examples).toContain("legal-review contact details")
    expect(privacyDataCategories.find(row => row.category === "Organization, project, and governance data")?.visibility).toContain("assigned role")
    expect(privacyDataCategories.find(row => row.category === "Fundraising, application, and diligence data")?.visibility).toContain("application, readiness, and round snapshot for that revision")
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

  it("keeps legal table-of-contents links at touch-friendly targets", () => {
    const styles = readFileSync(resolve(stylesRoot, "main.css"), "utf8")

    expect(styles).toContain(".legal-toc-link")
    expect(styles).toContain("min-height: 2.75rem")
    expect(readPageSource("terms")).toContain("class=\"legal-toc-link muted text-sm leading-6\"")
    expect(readPageSource("privacy")).toContain("class=\"legal-toc-link muted text-sm leading-6\"")
  })
})
