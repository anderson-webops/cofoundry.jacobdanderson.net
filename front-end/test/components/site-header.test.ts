import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function siteHeaderSource() {
  return readFileSync(resolve(process.cwd(), "src/components/marketing/SiteHeader.vue"), "utf8")
}

describe("siteHeader", () => {
  it("keeps the mobile navigation control accessible and visible", () => {
    const source = siteHeaderSource()

    expect(source).toContain("aria-label=\"Toggle site navigation\"")
    expect(source).toContain("aria-controls=\"marketing-mobile-navigation\"")
    expect(source).toContain(":aria-expanded=\"menuOpen\"")
    expect(source).toContain("id=\"marketing-mobile-navigation\"")
    expect(source).toContain("menuOpen ? 'i-carbon-close' : 'i-carbon-menu'")
    expect(source).toContain("aria-hidden=\"true\"")
    expect(source).toMatch(/class="[^"]*min-h-11[^"]*hover:text-\[var\(--text\)\][^"]*"/)
    expect(source).toContain("h-11 w-11")
    expect(source).toMatch(/class="[^"]*min-h-11[^"]*hover:bg-\[var\(--accent-soft\)\][^"]*"/)
  })

  it("keeps theme switching available in the mobile menu", () => {
    const source = siteHeaderSource()

    expect(source.match(/<ThemeToggle \/>/g)?.length).toBeGreaterThanOrEqual(2)
  })
})
