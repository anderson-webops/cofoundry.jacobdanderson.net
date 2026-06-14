import type { AuthProvider } from "../types/domain"

export const supportedOAuthProviders = ["google", "github"] as const

export type SupportedOAuthProvider = Extract<AuthProvider, typeof supportedOAuthProviders[number]>

function hasValue(value?: string) {
  return Boolean(value?.trim())
}

function parseProviderList(value?: string) {
  return new Set((value || "")
    .split(/[,\s]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean))
}

export function normalizeOAuthProvider(provider: unknown): SupportedOAuthProvider | null {
  if (typeof provider !== "string")
    return null

  const normalizedProvider = provider.trim().toLowerCase()
  return supportedOAuthProviders.find(item => item === normalizedProvider) || null
}

export function readConfiguredOAuthProviders(env: Record<string, string | undefined>) {
  const providers = new Set<SupportedOAuthProvider>()
  const genericProviders = new Set([
    ...parseProviderList(env.COFOUNDRY_OAUTH_PROVIDER),
    ...parseProviderList(env.COFOUNDRY_EXTERNAL_AUTH_PROVIDER),
  ])

  for (const provider of supportedOAuthProviders) {
    if (genericProviders.has(provider))
      providers.add(provider)
  }

  if (hasValue(env.COFOUNDRY_GOOGLE_OAUTH_PROVIDER))
    providers.add("google")

  if (hasValue(env.COFOUNDRY_GITHUB_OAUTH_PROVIDER))
    providers.add("github")

  return providers
}

export function isOAuthProviderEnabled(provider: SupportedOAuthProvider, env: Record<string, string | undefined>) {
  return readConfiguredOAuthProviders(env).has(provider)
}
