const backendModes = ["mock", "supabase"] as const
const billingModes = ["mock", "stripe"] as const
const localDevelopmentAppUrl = "http://localhost:3000"
const defaultSupportEmail = "support@cofoundry.dev"
const trailingSlashPattern = /\/+$/

type EnvironmentSource = Record<string, string | undefined>

export type BackendMode = (typeof backendModes)[number]
export type BillingMode = (typeof billingModes)[number]

export interface PublicEnvironment {
  appUrl: string
  backendMode: BackendMode
  billingMode: BillingMode
  enableDemoAccess: boolean
  featureInvestmentModule: boolean
  stripePriceProMonthly: string
  stripePriceTeamMonthly: string
  stripePublishableKey: string
  supabaseAnonKey: string
  supabaseUrl: string
  supportEmail: string
}

export interface SecretEnvironment {
  operationsWorkerToken: string
  sessionSigningSecret: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  supabaseServiceRoleKey: string
}

export interface DeploymentMetadata {
  commitSha: string
  deployedAt: string
  release: string
}

function readValue(env: EnvironmentSource, key: string) {
  return env[key]?.trim() || ""
}

function readFirstValue(env: EnvironmentSource, keys: string[]) {
  for (const key of keys) {
    const value = readValue(env, key)
    if (value)
      return value
  }

  return ""
}

function stripTrailingSlash(value: string) {
  return value.replace(trailingSlashPattern, "")
}

function normalizeBackendMode(value: string): BackendMode {
  return value === "supabase" ? "supabase" : "mock"
}

function normalizeBillingMode(value: string): BillingMode {
  return value === "stripe" ? "stripe" : "mock"
}

function isAbsoluteUrl(value: string) {
  try {
    const url = new URL(value)
    return Boolean(url.protocol && url.host)
  }
  catch {
    return false
  }
}

function isLocalAppUrl(value: string) {
  try {
    const url = new URL(value)
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  }
  catch {
    return false
  }
}

export function isLocalDevelopmentEnvironment(env: EnvironmentSource) {
  if (readValue(env, "NODE_ENV") === "production")
    return false

  const configuredAppUrl = readValue(env, "NUXT_PUBLIC_APP_URL")
  if (!configuredAppUrl)
    return true

  return isLocalAppUrl(configuredAppUrl)
}

export function readPublicEnvironment(env: EnvironmentSource): PublicEnvironment {
  const configuredAppUrl = stripTrailingSlash(readValue(env, "NUXT_PUBLIC_APP_URL"))

  return {
    appUrl: configuredAppUrl || (isLocalDevelopmentEnvironment(env) ? localDevelopmentAppUrl : ""),
    backendMode: normalizeBackendMode(readValue(env, "NUXT_PUBLIC_BACKEND_MODE")),
    billingMode: normalizeBillingMode(readValue(env, "NUXT_PUBLIC_BILLING_MODE")),
    enableDemoAccess: readValue(env, "NUXT_PUBLIC_ENABLE_DEMO_ACCESS") === "true",
    featureInvestmentModule: readValue(env, "NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE") === "true",
    stripePriceProMonthly: readValue(env, "NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY"),
    stripePriceTeamMonthly: readValue(env, "NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY"),
    stripePublishableKey: readValue(env, "NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    supabaseAnonKey: readValue(env, "NUXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseUrl: readValue(env, "NUXT_PUBLIC_SUPABASE_URL"),
    supportEmail: readValue(env, "NUXT_PUBLIC_SUPPORT_EMAIL") || defaultSupportEmail,
  }
}

export function readSecretEnvironment(env: EnvironmentSource): SecretEnvironment {
  return {
    operationsWorkerToken: readValue(env, "COFOUNDRY_OPERATIONS_TOKEN") || readValue(env, "OPERATIONS_WORKER_TOKEN"),
    sessionSigningSecret: readValue(env, "NUXT_SESSION_SIGNING_SECRET") || readValue(env, "SESSION_SIGNING_SECRET"),
    stripeSecretKey: readValue(env, "STRIPE_SECRET_KEY"),
    stripeWebhookSecret: readValue(env, "STRIPE_WEBHOOK_SECRET"),
    supabaseServiceRoleKey: readValue(env, "SUPABASE_SERVICE_ROLE_KEY"),
  }
}

export function readDeploymentMetadata(env: EnvironmentSource): DeploymentMetadata {
  return {
    commitSha: readFirstValue(env, ["COFOUNDRY_COMMIT_SHA", "GIT_COMMIT", "COMMIT_SHA", "SOURCE_VERSION", "VERCEL_GIT_COMMIT_SHA"]),
    deployedAt: readFirstValue(env, ["COFOUNDRY_DEPLOYED_AT", "DEPLOYED_AT", "BUILD_TIMESTAMP"]),
    release: readFirstValue(env, ["COFOUNDRY_RELEASE", "RELEASE_VERSION", "APP_VERSION"]),
  }
}

export function collectEnvironmentValidationErrors(env: EnvironmentSource) {
  const errors: string[] = []
  const publicEnvironment = readPublicEnvironment(env)
  const secretEnvironment = readSecretEnvironment(env)
  const configuredAppUrl = readValue(env, "NUXT_PUBLIC_APP_URL")
  const configuredBackendMode = readValue(env, "NUXT_PUBLIC_BACKEND_MODE")
  const configuredBillingMode = readValue(env, "NUXT_PUBLIC_BILLING_MODE")
  const requiresSignedSessions = !isLocalDevelopmentEnvironment(env) && (publicEnvironment.backendMode === "supabase" || publicEnvironment.enableDemoAccess)

  if (configuredAppUrl && !isAbsoluteUrl(configuredAppUrl))
    errors.push("NUXT_PUBLIC_APP_URL must be an absolute URL when it is set.")

  if (configuredBackendMode && !backendModes.includes(configuredBackendMode as BackendMode))
    errors.push(`NUXT_PUBLIC_BACKEND_MODE must be one of: ${backendModes.join(", ")}.`)

  if (configuredBillingMode && !billingModes.includes(configuredBillingMode as BillingMode))
    errors.push(`NUXT_PUBLIC_BILLING_MODE must be one of: ${billingModes.join(", ")}.`)

  if (publicEnvironment.backendMode === "supabase") {
    if (!publicEnvironment.supabaseUrl)
      errors.push("NUXT_PUBLIC_SUPABASE_URL is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")

    if (!publicEnvironment.supabaseAnonKey)
      errors.push("NUXT_PUBLIC_SUPABASE_ANON_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")

    if (!secretEnvironment.supabaseServiceRoleKey)
      errors.push("SUPABASE_SERVICE_ROLE_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
  }

  if (publicEnvironment.billingMode === "stripe") {
    if (!publicEnvironment.stripePublishableKey)
      errors.push("NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")

    if (!publicEnvironment.stripePriceProMonthly)
      errors.push("NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")

    if (!publicEnvironment.stripePriceTeamMonthly)
      errors.push("NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")

    if (!secretEnvironment.stripeSecretKey)
      errors.push("STRIPE_SECRET_KEY is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")

    if (!secretEnvironment.stripeWebhookSecret)
      errors.push("STRIPE_WEBHOOK_SECRET is required when NUXT_PUBLIC_BILLING_MODE=\"stripe\".")
  }

  if (requiresSignedSessions && !secretEnvironment.sessionSigningSecret)
    errors.push("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")

  return errors
}

export function formatEnvironmentValidationError(env: EnvironmentSource, context: string) {
  const errors = collectEnvironmentValidationErrors(env)
  if (!errors.length)
    return null

  const publicEnvironment = readPublicEnvironment(env)

  return [
    `CoFoundry environment validation failed for ${context}.`,
    `Active backend mode: ${publicEnvironment.backendMode}`,
    `Active billing mode: ${publicEnvironment.billingMode}`,
    "Resolve the missing configuration below or switch the affected mode back to \"mock\":",
    ...errors.map(error => `- ${error}`),
    "Server-only secrets should be injected from Vault-managed env on the host, not committed to the repo.",
  ].join("\n")
}

export function assertEnvironmentIsValid(env: EnvironmentSource, context: string) {
  const message = formatEnvironmentValidationError(env, context)
  if (message)
    throw new Error(message)
}
