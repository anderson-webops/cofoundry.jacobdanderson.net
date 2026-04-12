export type ThemeValue = "dark" | "light"
export type ThemeSchemeId = "ledger" | "foundry" | "ember"

export interface ThemeSchemeOption {
  id: ThemeSchemeId
  label: string
  description: string
  isDefault?: boolean
  swatches: {
    light: {
      accent: string
      surface: string
      text: string
    }
    dark: {
      accent: string
      surface: string
      text: string
    }
  }
}

export const defaultThemeScheme: ThemeSchemeId = "ledger"

export const themeSchemeOptions: ThemeSchemeOption[] = [
  {
    id: "ledger",
    label: "Ledger",
    description: "Cool slate surfaces with a cobalt signal accent.",
    isDefault: true,
    swatches: {
      light: {
        accent: "#2557d6",
        surface: "#f4f5f8",
        text: "#121722",
      },
      dark: {
        accent: "#7ea2ff",
        surface: "#0d1117",
        text: "#f4f7fb",
      },
    },
  },
  {
    id: "foundry",
    label: "Foundry",
    description: "The existing mint-and-graphite CoFoundry look.",
    swatches: {
      light: {
        accent: "#136c59",
        surface: "#f5f4ef",
        text: "#121715",
      },
      dark: {
        accent: "#5ac3a8",
        surface: "#0d1110",
        text: "#f4f6f5",
      },
    },
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm stone surfaces with a restrained copper accent.",
    swatches: {
      light: {
        accent: "#a85a30",
        surface: "#f6f2ed",
        text: "#1c1613",
      },
      dark: {
        accent: "#e09a64",
        surface: "#120f0d",
        text: "#f6f1ed",
      },
    },
  },
]

export function isDarkThemeValue(value: string) {
  return value === "dark"
}

export function getThemeTogglePreference(value: string): ThemeValue {
  return isDarkThemeValue(value) ? "light" : "dark"
}

export function normalizeThemeScheme(value?: string | null): ThemeSchemeId {
  return themeSchemeOptions.some(option => option.id === value)
    ? value as ThemeSchemeId
    : defaultThemeScheme
}
