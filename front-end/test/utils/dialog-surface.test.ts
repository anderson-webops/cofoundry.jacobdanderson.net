import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("shared dialog surface", () => {
  it("keeps long forms reachable within the viewport", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/ui/BaseDialog.vue"), "utf8")

    expect(source).toContain("max-h-[calc(100dvh-2rem)]")
    expect(source).toContain("overflow-y-auto")
    expect(source).toContain("overscroll-contain")
    expect(source).toContain("role=\"dialog\"")
    expect(source).toContain("aria-modal=\"true\"")
    expect(source).toContain("aria-label=\"Close dialog\"")
  })
})
