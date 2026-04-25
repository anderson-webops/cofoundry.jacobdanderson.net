import { describe, expect, it } from "vitest"
import {
  defaultThemeScheme,
  getThemeTogglePreference,
  isDarkThemeValue,
  normalizeThemeScheme,
  themeCssVariableNames,
  themeSchemeDefinitions,
  themeSchemeOptions,
  themeSchemeStyleContent,
} from "../../shared/utils/theme"

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

  it("keeps the configured palette families available without duplicate IDs", () => {
    const ids = themeSchemeOptions.map(option => option.id)

    expect(ids).toEqual(expect.arrayContaining(["ledger", "foundry", "ember"]))
    expect(new Set(ids).size).toBe(ids.length)
    expect(defaultThemeScheme).toBe("ledger")
  })

  it("derives picker swatches from the active design tokens", () => {
    for (const option of themeSchemeOptions) {
      const definition = themeSchemeDefinitions.find(scheme => scheme.id === option.id)

      expect(definition).toBeDefined()
      expect(option.swatches.light).toEqual({
        accent: definition?.modes.light["--accent"],
        surface: definition?.modes.light["--bg"],
        text: definition?.modes.light["--text"],
      })
      expect(option.swatches.dark).toEqual({
        accent: definition?.modes.dark["--accent"],
        surface: definition?.modes.dark["--bg"],
        text: definition?.modes.dark["--text"],
      })
    }
  })

  it("generates CSS blocks for every scheme and mode token", () => {
    for (const definition of themeSchemeDefinitions) {
      expect(themeSchemeStyleContent).toContain(`[data-theme-scheme="${definition.id}"]`)
      expect(themeSchemeStyleContent).toContain(`.dark[data-theme-scheme="${definition.id}"]`)

      for (const mode of ["light", "dark"] as const) {
        for (const token of themeCssVariableNames) {
          const variable = `--${token}` as const
          expect(themeSchemeStyleContent).toContain(`${variable}: ${definition.modes[mode][variable]};`)
        }
      }
    }
  })

  it("normalizes invalid or missing scheme values to the default palette", () => {
    expect(normalizeThemeScheme("foundry")).toBe("foundry")
    expect(normalizeThemeScheme("ember")).toBe("ember")
    expect(normalizeThemeScheme("")).toBe(defaultThemeScheme)
    expect(normalizeThemeScheme("unknown")).toBe(defaultThemeScheme)
    expect(normalizeThemeScheme(undefined)).toBe(defaultThemeScheme)
  })
})
