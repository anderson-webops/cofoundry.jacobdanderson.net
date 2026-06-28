import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function themeToggleSource() {
  return readFileSync(resolve(process.cwd(), "src/components/app/ThemeToggle.vue"), "utf8")
}

describe("themeToggle", () => {
  it("keeps the theme control touch-friendly wherever it is rendered", () => {
    expect(themeToggleSource()).toMatch(/class="[^"]*min-h-11[^"]*"/)
  })
})
