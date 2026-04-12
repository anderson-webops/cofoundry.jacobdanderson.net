import { describe, expect, it } from "vitest"
import { defaultThemeScheme, getThemeTogglePreference, isDarkThemeValue, normalizeThemeScheme, themeSchemeOptions } from "../../shared/utils/theme"

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

  it("keeps three linked palette families available", () => {
    expect(themeSchemeOptions).toHaveLength(3)
    expect(themeSchemeOptions.map(option => option.id)).toEqual(["ledger", "foundry", "ember"])
    expect(defaultThemeScheme).toBe("ledger")
  })

  it("normalizes invalid or missing scheme values to the default palette", () => {
    expect(normalizeThemeScheme("foundry")).toBe("foundry")
    expect(normalizeThemeScheme("ember")).toBe("ember")
    expect(normalizeThemeScheme("")).toBe(defaultThemeScheme)
    expect(normalizeThemeScheme("unknown")).toBe(defaultThemeScheme)
    expect(normalizeThemeScheme(undefined)).toBe(defaultThemeScheme)
  })
})
