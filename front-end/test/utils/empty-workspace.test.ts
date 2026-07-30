import { describe, expect, it } from "vitest"
import { createEmptyWorkspaceSeed } from "../../shared/utils/empty-workspace"

describe("empty client workspace", () => {
  it("contains no account, collaboration, moderation, billing, or file data", () => {
    const seed = createEmptyWorkspaceSeed()

    expect(seed.version).toBe("empty")
    expect(Object.entries(seed)
      .filter(([key]) => key !== "version")
      .every(([, value]) => Array.isArray(value) && value.length === 0))
      .toBe(true)
  })
})
