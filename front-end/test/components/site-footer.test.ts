import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function siteFooterSource() {
  return readFileSync(resolve(process.cwd(), "src/components/marketing/SiteFooter.vue"), "utf8")
}

describe("siteFooter", () => {
  it("keeps footer navigation and support links touch-friendly", () => {
    const source = siteFooterSource()

    expect(source).toContain("const footerLinkClass = \"min-h-[44px]")
    expect(source).toContain("const supportLinkClass = \"muted text-sm underline underline-offset-4 min-h-[44px]")
    expect(source).toContain("<BaseButton size=\"md\"")
    expect(source).toContain("class=\"min-h-[44px]\"")
    expect(source.match(/:class="footerLinkClass"/g)?.length).toBe(9)
  })
})
