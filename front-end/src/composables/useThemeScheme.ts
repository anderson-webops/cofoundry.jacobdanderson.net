import type { ThemeSchemeId } from "~/shared/utils/theme"
import { getPreferenceCookieOptions } from "~/shared/utils/cookie-policy"
import { defaultThemeScheme, normalizeThemeScheme, themeSchemeOptions } from "~/shared/utils/theme"

const themeSchemeCookieName = "cofoundry-theme-scheme"

export function useThemeScheme() {
  const themeSchemeCookie = useCookie<string>(themeSchemeCookieName, {
    default: () => defaultThemeScheme,
    ...getPreferenceCookieOptions(!import.meta.dev, 60 * 60 * 24 * 365),
  })

  const scheme = computed<ThemeSchemeId>({
    get: () => normalizeThemeScheme(themeSchemeCookie.value),
    set: (value) => {
      themeSchemeCookie.value = normalizeThemeScheme(value)
    },
  })

  const activeScheme = computed(() => themeSchemeOptions.find(option => option.id === scheme.value) || themeSchemeOptions[0]!)

  return {
    activeScheme,
    scheme,
    schemes: themeSchemeOptions,
  }
}
