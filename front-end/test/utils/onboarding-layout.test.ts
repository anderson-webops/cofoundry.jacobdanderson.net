import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const pagesRoot = resolve(process.cwd(), "src/pages")

describe("onboarding layout", () => {
  it("keeps match preview cards from forcing three columns inside the auth layout", () => {
    const source = readFileSync(resolve(pagesRoot, "onboarding.vue"), "utf8")
    const previewGridClasses = [...source.matchAll(/class="([^"]*grid[^"]*)"/g)]
      .map(match => match[1] || "")
      .filter(className => className.includes("lg:grid-cols-2") && className.includes("2xl:grid-cols-3"))

    expect(previewGridClasses).toHaveLength(2)
    expect(source).not.toContain("gap-4 grid lg:grid-cols-3")
  })
})
