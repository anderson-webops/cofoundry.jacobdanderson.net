import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const pagesRoot = resolve(process.cwd(), "src/pages")
const stylesRoot = resolve(process.cwd(), "src/assets/styles")

function readPageSource(path: string) {
  return readFileSync(resolve(pagesRoot, path), "utf8")
}

describe("public touch targets", () => {
  it("keeps shared public pills touch-friendly", () => {
    const styles = readFileSync(resolve(stylesRoot, "main.css"), "utf8")

    expect(styles).toMatch(/\.pill\s*\{[\s\S]*min-height:\s*2\.75rem/)
  })

  it("keeps public disclosure summaries touch-friendly", () => {
    const styles = readFileSync(resolve(stylesRoot, "main.css"), "utf8")

    expect(styles).toMatch(/\.disclosure-summary\s*\{[\s\S]*min-height:\s*2\.75rem/)
    expect(readPageSource("faq.vue")).toContain("class=\"disclosure-summary text-lg font-semibold list-none cursor-pointer\"")
    expect(readPageSource("people/[slug].vue")).toContain("class=\"disclosure-summary text-lg font-semibold cursor-pointer\"")
  })

  it("keeps startup detail context links touch-friendly", () => {
    const styles = readFileSync(resolve(stylesRoot, "main.css"), "utf8")
    const startupDetailSource = readPageSource("startups/[slug].vue")

    expect(styles).toMatch(/\.public-action-link\s*\{[\s\S]*min-height:\s*2\.75rem/)
    expect(startupDetailSource.match(/class="public-action-link text-sm"/g)?.length).toBe(2)
  })
})
