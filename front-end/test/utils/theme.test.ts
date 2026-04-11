import { describe, expect, it } from "vitest"
import { getThemeTogglePreference, isDarkThemeValue } from "../../shared/utils/theme"

describe("theme utilities", () => {
  it("detects the effective dark mode value", () => {
    expect(isDarkThemeValue("dark")).toBe(true)
    expect(isDarkThemeValue("light")).toBe(false)
    expect(isDarkThemeValue("system")).toBe(false)
  })

  it("toggles away from the current effective theme", () => {
    expect(getThemeTogglePreference("dark")).toBe("light")
    expect(getThemeTogglePreference("light")).toBe("dark")
  })
})
