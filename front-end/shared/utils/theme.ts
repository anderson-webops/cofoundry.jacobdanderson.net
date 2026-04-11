export type ThemeValue = "dark" | "light"

export function isDarkThemeValue(value: string) {
  return value === "dark"
}

export function getThemeTogglePreference(value: string): ThemeValue {
  return isDarkThemeValue(value) ? "light" : "dark"
}
