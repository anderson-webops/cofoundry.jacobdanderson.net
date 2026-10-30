export type ThemeValue = "dark" | "light"

export const themeModes = ["light", "dark"] as const satisfies readonly ThemeValue[]

export const themeCssVariableNames = [
  "bg",
  "bg-muted",
  "panel",
  "panel-strong",
  "panel-inset",
  "text",
  "muted",
  "line",
  "line-strong",
  "accent",
  "accent-strong",
  "accent-soft",
  "bg-glow-primary",
  "bg-glow-secondary",
  "hero-spotlight-color",
  "cta-orb",
  "cta-surface",
  "cta-surface-border",
  "cta-text",
  "cta-kicker",
  "cta-secondary-bg",
  "cta-secondary-bg-hover",
  "cta-secondary-border",
  "cta-accent-text",
  "auth-hero-surface",
  "auth-hero-border",
  "auth-hero-text",
  "auth-hero-kicker",
  "auth-hero-muted",
  "danger",
  "warning",
  "success",
  "shadow",
] as const

export type ThemeCssVariableName = typeof themeCssVariableNames[number]
export type ThemeCssVariable = `--${ThemeCssVariableName}`
export type ThemeTokenSet = Record<ThemeCssVariable, string>

interface ThemeSchemeDefinition {
  id: string
  label: string
  description: string
  isDefault?: boolean
  modes: Record<ThemeValue, ThemeTokenSet>
}

type ThemeSchemeDefinitionList = readonly [ThemeSchemeDefinition, ...ThemeSchemeDefinition[]]

/*
 * Theme scheme integration contract:
 * - Add or edit palette families in this definition list only.
 * - Keep product UI on semantic CSS variables such as --bg, --text, and --accent.
 * - Picker swatches and injected CSS are generated from these same tokens.
 */
export const themeSchemeDefinitions = [
  {
    id: "ledger",
    label: "Ledger",
    description: "Cool slate surfaces with a cobalt signal accent.",
    isDefault: true,
    modes: {
      light: {
        "--bg": "#f4f5f8",
        "--bg-muted": "#e9edf3",
        "--panel": "rgba(255, 255, 255, 0.84)",
        "--panel-strong": "rgba(255, 255, 255, 0.95)",
        "--panel-inset": "rgba(235, 240, 247, 0.76)",
        "--text": "#121722",
        "--muted": "#657080",
        "--line": "rgba(18, 23, 34, 0.09)",
        "--line-strong": "rgba(18, 23, 34, 0.16)",
        "--accent": "#2557d6",
        "--accent-strong": "#1c45b0",
        "--accent-soft": "rgba(37, 87, 214, 0.12)",
        "--bg-glow-primary": "rgba(37, 87, 214, 0.12)",
        "--bg-glow-secondary": "rgba(12, 22, 43, 0.09)",
        "--hero-spotlight-color": "rgba(37, 87, 214, 0.24)",
        "--cta-orb": "rgba(110, 152, 255, 0.32)",
        "--cta-surface": "linear-gradient(135deg, #0f1729 0%, #18243d 100%)",
        "--cta-surface-border": "rgba(15, 23, 41, 0.16)",
        "--cta-text": "#f7f9fc",
        "--cta-kicker": "rgba(247, 249, 252, 0.74)",
        "--cta-secondary-bg": "rgba(255, 255, 255, 0.08)",
        "--cta-secondary-bg-hover": "rgba(255, 255, 255, 0.12)",
        "--cta-secondary-border": "rgba(255, 255, 255, 0.14)",
        "--cta-accent-text": "#ffffff",
        "--auth-hero-surface": "linear-gradient(140deg, #10213b 0%, #1a3052 52%, #25416d 100%)",
        "--auth-hero-border": "rgba(11, 25, 51, 0.18)",
        "--auth-hero-text": "#f7f9fc",
        "--auth-hero-kicker": "rgba(247, 249, 252, 0.76)",
        "--auth-hero-muted": "rgba(247, 249, 252, 0.82)",
        "--danger": "#a34f3d",
        "--warning": "#b07c28",
        "--success": "#117252",
        "--shadow": "0 20px 60px rgba(15, 23, 41, 0.1)",
      },
      dark: {
        "--bg": "#0d1117",
        "--bg-muted": "#101624",
        "--panel": "rgba(17, 22, 33, 0.84)",
        "--panel-strong": "rgba(17, 22, 33, 0.95)",
        "--panel-inset": "rgba(23, 30, 44, 0.76)",
        "--text": "#f4f7fb",
        "--muted": "#98a5b8",
        "--line": "rgba(244, 247, 251, 0.08)",
        "--line-strong": "rgba(244, 247, 251, 0.14)",
        "--accent": "#7ea2ff",
        "--accent-strong": "#a3bdff",
        "--accent-soft": "rgba(126, 162, 255, 0.16)",
        "--bg-glow-primary": "rgba(64, 110, 225, 0.16)",
        "--bg-glow-secondary": "rgba(6, 10, 19, 0.22)",
        "--hero-spotlight-color": "rgba(126, 162, 255, 0.28)",
        "--cta-orb": "rgba(126, 162, 255, 0.34)",
        "--cta-surface": "linear-gradient(135deg, #121a2c 0%, #1a2640 100%)",
        "--cta-surface-border": "rgba(255, 255, 255, 0.08)",
        "--cta-text": "#f4f7fb",
        "--cta-kicker": "rgba(244, 247, 251, 0.74)",
        "--cta-secondary-bg": "rgba(255, 255, 255, 0.06)",
        "--cta-secondary-bg-hover": "rgba(255, 255, 255, 0.1)",
        "--cta-secondary-border": "rgba(255, 255, 255, 0.14)",
        "--cta-accent-text": "#101a30",
        "--auth-hero-surface": "linear-gradient(140deg, #16203a 0%, #1c2c49 52%, #26395f 100%)",
        "--auth-hero-border": "rgba(255, 255, 255, 0.08)",
        "--auth-hero-text": "#f4f7fb",
        "--auth-hero-kicker": "rgba(244, 247, 251, 0.74)",
        "--auth-hero-muted": "rgba(244, 247, 251, 0.8)",
        "--danger": "#e19b87",
        "--warning": "#d6a853",
        "--success": "#6cd0ad",
        "--shadow": "0 24px 70px rgba(0, 0, 0, 0.34)",
      },
    },
  },
  {
    id: "foundry",
    label: "Foundry",
    description: "The existing mint-and-graphite CoFoundry look.",
    modes: {
      light: {
        "--bg": "#f5f4ef",
        "--bg-muted": "#ece9e1",
        "--panel": "rgba(255, 255, 255, 0.82)",
        "--panel-strong": "rgba(255, 255, 255, 0.94)",
        "--panel-inset": "rgba(239, 236, 229, 0.72)",
        "--text": "#121715",
        "--muted": "#66706c",
        "--line": "rgba(18, 23, 21, 0.09)",
        "--line-strong": "rgba(18, 23, 21, 0.16)",
        "--accent": "#136c59",
        "--accent-strong": "#0e5849",
        "--accent-soft": "rgba(19, 108, 89, 0.12)",
        "--bg-glow-primary": "rgba(19, 108, 89, 0.08)",
        "--bg-glow-secondary": "rgba(15, 23, 21, 0.08)",
        "--hero-spotlight-color": "rgba(19, 108, 89, 0.22)",
        "--cta-orb": "rgba(90, 195, 168, 0.28)",
        "--cta-surface": "linear-gradient(135deg, #101816 0%, #17231f 100%)",
        "--cta-surface-border": "rgba(16, 24, 22, 0.14)",
        "--cta-text": "#f7faf8",
        "--cta-kicker": "rgba(247, 250, 248, 0.72)",
        "--cta-secondary-bg": "rgba(255, 255, 255, 0.08)",
        "--cta-secondary-bg-hover": "rgba(255, 255, 255, 0.12)",
        "--cta-secondary-border": "rgba(255, 255, 255, 0.14)",
        "--cta-accent-text": "#ffffff",
        "--auth-hero-surface": "linear-gradient(140deg, #113029 0%, #193d35 52%, #1f4b41 100%)",
        "--auth-hero-border": "rgba(10, 33, 28, 0.18)",
        "--auth-hero-text": "#f7faf8",
        "--auth-hero-kicker": "rgba(247, 250, 248, 0.76)",
        "--auth-hero-muted": "rgba(247, 250, 248, 0.82)",
        "--danger": "#a34f3d",
        "--warning": "#b07c28",
        "--success": "#117252",
        "--shadow": "0 20px 60px rgba(15, 23, 21, 0.08)",
      },
      dark: {
        "--bg": "#0d1110",
        "--bg-muted": "#111817",
        "--panel": "rgba(19, 25, 24, 0.82)",
        "--panel-strong": "rgba(19, 25, 24, 0.94)",
        "--panel-inset": "rgba(24, 32, 30, 0.72)",
        "--text": "#f4f6f5",
        "--muted": "#9aa39f",
        "--line": "rgba(244, 246, 245, 0.08)",
        "--line-strong": "rgba(244, 246, 245, 0.14)",
        "--accent": "#5ac3a8",
        "--accent-strong": "#74d5bc",
        "--accent-soft": "rgba(90, 195, 168, 0.14)",
        "--bg-glow-primary": "rgba(19, 108, 89, 0.08)",
        "--bg-glow-secondary": "rgba(15, 23, 21, 0.08)",
        "--hero-spotlight-color": "rgba(19, 108, 89, 0.22)",
        "--cta-orb": "rgba(90, 195, 168, 0.28)",
        "--cta-surface": "linear-gradient(135deg, #151e1c 0%, #1d2a27 100%)",
        "--cta-surface-border": "rgba(255, 255, 255, 0.08)",
        "--cta-text": "#f4f6f5",
        "--cta-kicker": "rgba(244, 246, 245, 0.74)",
        "--cta-secondary-bg": "rgba(255, 255, 255, 0.06)",
        "--cta-secondary-bg-hover": "rgba(255, 255, 255, 0.1)",
        "--cta-secondary-border": "rgba(255, 255, 255, 0.14)",
        "--cta-accent-text": "#10211c",
        "--auth-hero-surface": "linear-gradient(140deg, #182321 0%, #1d2d29 52%, #253a35 100%)",
        "--auth-hero-border": "rgba(255, 255, 255, 0.08)",
        "--auth-hero-text": "#f4f6f5",
        "--auth-hero-kicker": "rgba(244, 246, 245, 0.74)",
        "--auth-hero-muted": "rgba(244, 246, 245, 0.8)",
        "--danger": "#e19b87",
        "--warning": "#d6a853",
        "--success": "#6cd0ad",
        "--shadow": "0 24px 70px rgba(0, 0, 0, 0.34)",
      },
    },
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm stone surfaces with a restrained copper accent.",
    modes: {
      light: {
        "--bg": "#f6f2ed",
        "--bg-muted": "#eee5db",
        "--panel": "rgba(255, 250, 246, 0.84)",
        "--panel-strong": "rgba(255, 252, 249, 0.95)",
        "--panel-inset": "rgba(242, 232, 224, 0.8)",
        "--text": "#1c1613",
        "--muted": "#776b63",
        "--line": "rgba(28, 22, 19, 0.09)",
        "--line-strong": "rgba(28, 22, 19, 0.16)",
        "--accent": "#a85a30",
        "--accent-strong": "#8b4725",
        "--accent-soft": "rgba(168, 90, 48, 0.13)",
        "--bg-glow-primary": "rgba(168, 90, 48, 0.11)",
        "--bg-glow-secondary": "rgba(47, 23, 16, 0.07)",
        "--hero-spotlight-color": "rgba(191, 118, 72, 0.26)",
        "--cta-orb": "rgba(224, 154, 100, 0.28)",
        "--cta-surface": "linear-gradient(135deg, #211411 0%, #2d1d18 100%)",
        "--cta-surface-border": "rgba(33, 20, 17, 0.14)",
        "--cta-text": "#fbf7f3",
        "--cta-kicker": "rgba(251, 247, 243, 0.74)",
        "--cta-secondary-bg": "rgba(255, 255, 255, 0.08)",
        "--cta-secondary-bg-hover": "rgba(255, 255, 255, 0.12)",
        "--cta-secondary-border": "rgba(255, 255, 255, 0.12)",
        "--cta-accent-text": "#ffffff",
        "--auth-hero-surface": "linear-gradient(140deg, #351c15 0%, #47261c 52%, #5b3222 100%)",
        "--auth-hero-border": "rgba(44, 24, 17, 0.16)",
        "--auth-hero-text": "#fbf7f3",
        "--auth-hero-kicker": "rgba(251, 247, 243, 0.76)",
        "--auth-hero-muted": "rgba(251, 247, 243, 0.82)",
        "--danger": "#aa4e39",
        "--warning": "#ba7a2b",
        "--success": "#1f7a61",
        "--shadow": "0 20px 60px rgba(31, 19, 16, 0.1)",
      },
      dark: {
        "--bg": "#120f0d",
        "--bg-muted": "#171210",
        "--panel": "rgba(26, 21, 19, 0.84)",
        "--panel-strong": "rgba(26, 21, 19, 0.95)",
        "--panel-inset": "rgba(33, 26, 23, 0.78)",
        "--text": "#f6f1ed",
        "--muted": "#b3a59c",
        "--line": "rgba(246, 241, 237, 0.08)",
        "--line-strong": "rgba(246, 241, 237, 0.14)",
        "--accent": "#e09a64",
        "--accent-strong": "#f0b07c",
        "--accent-soft": "rgba(224, 154, 100, 0.16)",
        "--bg-glow-primary": "rgba(224, 154, 100, 0.12)",
        "--bg-glow-secondary": "rgba(9, 6, 5, 0.2)",
        "--hero-spotlight-color": "rgba(224, 154, 100, 0.24)",
        "--cta-orb": "rgba(224, 154, 100, 0.3)",
        "--cta-surface": "linear-gradient(135deg, #1a120f 0%, #281914 100%)",
        "--cta-surface-border": "rgba(255, 255, 255, 0.08)",
        "--cta-text": "#f6f1ed",
        "--cta-kicker": "rgba(246, 241, 237, 0.74)",
        "--cta-secondary-bg": "rgba(255, 255, 255, 0.06)",
        "--cta-secondary-bg-hover": "rgba(255, 255, 255, 0.1)",
        "--cta-secondary-border": "rgba(255, 255, 255, 0.12)",
        "--cta-accent-text": "#2a1812",
        "--auth-hero-surface": "linear-gradient(140deg, #26150f 0%, #361d15 52%, #45251a 100%)",
        "--auth-hero-border": "rgba(255, 255, 255, 0.08)",
        "--auth-hero-text": "#f6f1ed",
        "--auth-hero-kicker": "rgba(246, 241, 237, 0.74)",
        "--auth-hero-muted": "rgba(246, 241, 237, 0.8)",
        "--danger": "#e69b84",
        "--warning": "#ddb061",
        "--success": "#73d0b1",
        "--shadow": "0 24px 70px rgba(0, 0, 0, 0.34)",
      },
    },
  },
] as const satisfies ThemeSchemeDefinitionList

export type ThemeSchemeId = typeof themeSchemeDefinitions[number]["id"]

export interface ThemeSchemeOption {
  id: ThemeSchemeId
  label: string
  description: string
  isDefault?: boolean
  swatches: Record<ThemeValue, {
    accent: string
    surface: string
    text: string
  }>
}

export const defaultThemeSchemeDefinition = themeSchemeDefinitions.find(isDefaultThemeSchemeDefinition) ?? themeSchemeDefinitions[0]
export const defaultThemeScheme = defaultThemeSchemeDefinition.id

export const themeSchemeOptions: readonly ThemeSchemeOption[] = themeSchemeDefinitions.map(option => ({
  id: option.id,
  label: option.label,
  description: option.description,
  isDefault: isDefaultThemeSchemeDefinition(option)
    ? option.isDefault
    : undefined,
  swatches: {
    light: createThemeSwatch(option.modes.light),
    dark: createThemeSwatch(option.modes.dark),
  },
}))

export const themeSchemeStyleContent = createThemeSchemeStyleContent()

export function isDarkThemeValue(value: string) {
  return value === "dark"
}

export function getThemeTogglePreference(value: string): ThemeValue {
  return isDarkThemeValue(value)
    ? "light"
    : "dark"
}

export function normalizeThemeScheme(value?: string | null): ThemeSchemeId {
  return isThemeSchemeId(value)
    ? value
    : defaultThemeScheme
}

export function isThemeSchemeId(value?: string | null): value is ThemeSchemeId {
  return themeSchemeDefinitions.some(option => option.id === value)
}

function createThemeSwatch(tokens: ThemeTokenSet) {
  return {
    accent: tokens["--accent"],
    surface: tokens["--bg"],
    text: tokens["--text"],
  }
}

function isDefaultThemeSchemeDefinition(
  option: typeof themeSchemeDefinitions[number],
): option is typeof themeSchemeDefinitions[number] & { readonly isDefault: true } {
  return "isDefault" in option && option.isDefault
}

function createThemeSchemeStyleContent() {
  return themeSchemeDefinitions
    .flatMap(option => [
      createThemeBlock(createLightSelector(option), option.modes.light),
      createThemeBlock(createDarkSelector(option), option.modes.dark),
    ])
    .join("\n\n")
}

function createLightSelector(option: typeof themeSchemeDefinitions[number]) {
  return option.id === defaultThemeScheme
    ? `:root,\n[data-theme-scheme="${option.id}"]`
    : `[data-theme-scheme="${option.id}"]`
}

function createDarkSelector(option: typeof themeSchemeDefinitions[number]) {
  return option.id === defaultThemeScheme
    ? `.dark,\n.dark[data-theme-scheme="${option.id}"]`
    : `.dark[data-theme-scheme="${option.id}"]`
}

function createThemeBlock(selector: string, tokens: ThemeTokenSet) {
  const declarations = themeCssVariableNames.map((name) => {
    const variable = `--${name}` as ThemeCssVariable
    return `  ${variable}: ${tokens[variable]};`
  })

  return `${selector} {\n${declarations.join("\n")}\n}`
}
