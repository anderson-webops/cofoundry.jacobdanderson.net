import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const backendModes = ["mock", "supabase"] as const
const billingModes = ["mock", "stripe"] as const
const localDevelopmentAppUrl = "http://localhost:3000"
const defaultSupportEmail = "support@cofoundry.dev"
const trailingSlashPattern = /\/+$/
const backendPackagePath = resolve(dirname(fileURLToPath(import.meta.url)), "../package.json")
const loopbackBackendHosts = new Set(["127.0.0.1", "::1", "localhost"])

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

export function releaseTagFromPackageVersion(version: string) {
  const normalizedVersion = version.trim()

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9a-z.-]+)?$/i.test(normalizedVersion))
    return ""

  return `v${normalizedVersion}`
}

function readBackendPackageVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(backendPackagePath, "utf8")) as { version?: unknown }
    return typeof packageJson.version === "string" ? packageJson.version : ""
  }
  catch {
    return ""
  }
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

function parseAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && url.host ? url : null
  }
  catch {
    return null
  }
}

function isAbsoluteUrl(value: string) {
  return Boolean(parseAbsoluteHttpUrl(value))
}

function isOriginUrl(value: string) {
  const url = parseAbsoluteHttpUrl(value)
  return Boolean(
    url
    && !url.username
    && !url.password
    && !url.search
    && !url.hash
    && url.pathname === "/",
  )
}

function isHttpsUrl(value: string) {
  return parseAbsoluteHttpUrl(value)?.protocol === "https:"
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

function isExactTrustedProxyEntry(entry: string) {
  const [address = "", prefix, extra] = entry.split("/")
  if (extra || !address)
    return false

  if (address.includes(":"))
    return /^[0-9a-f:.]+$/i.test(address) && (typeof prefix === "undefined" || prefix === "128")

  const octets = address.split(".")
  return octets.length === 4
    && octets.every(octet => /^\d{1,3}$/.test(octet) && Number.parseInt(octet, 10) <= 255)
    && (typeof prefix === "undefined" || prefix === "32")
}

function isExactTrustedProxyList(value: string) {
  const entries = value.split(",").map(entry => entry.trim()).filter(Boolean)
  return entries.length > 0 && entries.every(isExactTrustedProxyEntry)
}

export function isValidSupportEmail(value: string) {
  const email = value.trim()
  const atIndex = email.indexOf("@")
  const localPart = atIndex > 0 ? email.slice(0, atIndex) : ""
  const domain = atIndex > 0 ? email.slice(atIndex + 1) : ""

  return Boolean(
    email.length <= 254
    && localPart
    && localPart.length <= 64
    && domain
    && domain.length <= 253
    && domain.includes(".")
    && !domain.startsWith(".")
    && !domain.endsWith(".")
    && !domain.includes("..")
    && !domain.includes("@")
    && !/[\0-\x20<>]/.test(email),
  )
}

export function isLocalDevelopmentEnvironment(env: EnvironmentSource) {
  if (readValue(env, "NODE_ENV") === "production")
    return false

  const configuredAppUrl = readValue(env, "NUXT_PUBLIC_APP_URL")
  if (!configuredAppUrl)
    return true

  return isLocalAppUrl(configuredAppUrl)
}

export function isLoopbackBackendHost(value: string) {
  return loopbackBackendHosts.has(value.trim().toLowerCase())
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

export function readDeploymentMetadata(env: EnvironmentSource, fallback: Partial<DeploymentMetadata> = {}): DeploymentMetadata {
  return {
    commitSha: readFirstValue(env, ["COFOUNDRY_COMMIT_SHA", "GIT_COMMIT", "COMMIT_SHA", "SOURCE_VERSION", "VERCEL_GIT_COMMIT_SHA"]) || fallback.commitSha?.trim() || "",
    deployedAt: readFirstValue(env, ["COFOUNDRY_DEPLOYED_AT", "DEPLOYED_AT", "BUILD_TIMESTAMP"]) || fallback.deployedAt?.trim() || "",
    release: readFirstValue(env, ["COFOUNDRY_RELEASE", "RELEASE_VERSION", "APP_VERSION"]) || fallback.release?.trim() || "",
  }
}

export function readBackendDeploymentMetadata(env: EnvironmentSource) {
  return readDeploymentMetadata(env, {
    release: releaseTagFromPackageVersion(readBackendPackageVersion()),
  })
}

export function collectEnvironmentValidationErrors(env: EnvironmentSource) {
  const errors: string[] = []
  const publicEnvironment = readPublicEnvironment(env)
  const secretEnvironment = readSecretEnvironment(env)
  const configuredAppUrl = readValue(env, "NUXT_PUBLIC_APP_URL")
  const configuredBackendMode = readValue(env, "NUXT_PUBLIC_BACKEND_MODE")
  const configuredBillingMode = readValue(env, "NUXT_PUBLIC_BILLING_MODE")
  const production = readValue(env, "NODE_ENV") === "production"
  const allowLocalProductionUrl = readValue(env, "COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL") === "true"
  const requiresSignedSessions = !isLocalDevelopmentEnvironment(env)
  const trustProxyHeaders = readValue(env, "COFOUNDRY_TRUST_PROXY_HEADERS")
  const trustedProxyIps = readValue(env, "COFOUNDRY_TRUSTED_PROXY_IPS")
  const expectsMultiInstance = readValue(env, "COFOUNDRY_EXPECT_MULTI_INSTANCE")
  const appInstanceCount = readValue(env, "COFOUNDRY_APP_INSTANCE_COUNT")
  const parsedAppInstanceCount = Number.parseInt(appInstanceCount, 10)
  const realtimeFanoutUrl = readValue(env, "COFOUNDRY_REALTIME_FANOUT_URL")
  const realtimeFanoutToken = readValue(env, "COFOUNDRY_REALTIME_FANOUT_TOKEN")
  const backendHost = readValue(env, "BACKEND_HOST") || "127.0.0.1"
  const configuredSupportEmail = readValue(env, "NUXT_PUBLIC_SUPPORT_EMAIL")

  if (configuredAppUrl && !isAbsoluteUrl(configuredAppUrl))
    errors.push("NUXT_PUBLIC_APP_URL must be an absolute URL when it is set.")
  else if (configuredAppUrl && !isOriginUrl(configuredAppUrl))
    errors.push("NUXT_PUBLIC_APP_URL must be an origin without credentials, a path, query parameters, or a fragment.")

  if (production && !configuredAppUrl)
    errors.push("NUXT_PUBLIC_APP_URL is required in production.")

  if (production && configuredAppUrl && isLocalAppUrl(configuredAppUrl) && !allowLocalProductionUrl)
    errors.push("NUXT_PUBLIC_APP_URL must not use a local origin in production.")

  if (production && configuredAppUrl && !isHttpsUrl(configuredAppUrl) && !allowLocalProductionUrl)
    errors.push("NUXT_PUBLIC_APP_URL must use HTTPS in production.")

  if (configuredSupportEmail && !isValidSupportEmail(configuredSupportEmail))
    errors.push("NUXT_PUBLIC_SUPPORT_EMAIL must be a valid single email address.")

  if (!isLocalDevelopmentEnvironment(env) && publicEnvironment.enableDemoAccess)
    errors.push("NUXT_PUBLIC_ENABLE_DEMO_ACCESS must be false outside local development.")

  if (trustProxyHeaders && !["false", "true"].includes(trustProxyHeaders))
    errors.push("COFOUNDRY_TRUST_PROXY_HEADERS must be true or false when it is set.")

  if (trustProxyHeaders === "true" && !trustedProxyIps)
    errors.push("COFOUNDRY_TRUSTED_PROXY_IPS is required when COFOUNDRY_TRUST_PROXY_HEADERS=true.")
  else if (trustProxyHeaders === "true" && !isExactTrustedProxyList(trustedProxyIps))
    errors.push("COFOUNDRY_TRUSTED_PROXY_IPS must contain only exact proxy host addresses (/32 or /128), not broad or malformed ranges.")

  if (expectsMultiInstance && !["false", "true"].includes(expectsMultiInstance))
    errors.push("COFOUNDRY_EXPECT_MULTI_INSTANCE must be true or false when it is set.")

  if (appInstanceCount && (!/^\d+$/.test(appInstanceCount) || parsedAppInstanceCount < 1))
    errors.push("COFOUNDRY_APP_INSTANCE_COUNT must be a positive integer when it is set.")

  if (requiresSignedSessions && (expectsMultiInstance === "true" || parsedAppInstanceCount > 1))
    errors.push("Multi-instance production is unsupported until CoFoundry has a shared atomic rate limiter; run exactly one app process.")

  if (production && realtimeFanoutUrl)
    errors.push("COFOUNDRY_REALTIME_FANOUT_URL must be unset in production until shared rate limiting is implemented.")

  if (realtimeFanoutUrl) {
    const fanoutUrl = parseAbsoluteHttpUrl(realtimeFanoutUrl)
    const appUrl = parseAbsoluteHttpUrl(publicEnvironment.appUrl)
    if (!fanoutUrl) {
      errors.push("COFOUNDRY_REALTIME_FANOUT_URL must be an absolute HTTP(S) URL.")
    }
    else if (fanoutUrl.username || fanoutUrl.password || fanoutUrl.hash) {
      errors.push("COFOUNDRY_REALTIME_FANOUT_URL must not contain credentials or a fragment.")
    }
    else if (!isHttpsUrl(realtimeFanoutUrl) && !isLocalAppUrl(realtimeFanoutUrl)) {
      errors.push("COFOUNDRY_REALTIME_FANOUT_URL must use HTTPS outside local development.")
    }
    else if (fanoutUrl.origin === appUrl?.origin && secretEnvironment.operationsWorkerToken.length < 32) {
      errors.push("A strong COFOUNDRY_OPERATIONS_TOKEN is required for same-origin realtime fanout.")
    }
    else if (fanoutUrl.origin !== appUrl?.origin && realtimeFanoutToken.length < 32) {
      errors.push("A distinct COFOUNDRY_REALTIME_FANOUT_TOKEN is required for cross-origin realtime fanout.")
    }
  }

  if (realtimeFanoutToken && realtimeFanoutToken.length < 32)
    errors.push("COFOUNDRY_REALTIME_FANOUT_TOKEN must be at least 32 characters when it is configured.")

  if (!isLoopbackBackendHost(backendHost) && secretEnvironment.operationsWorkerToken.length < 32)
    errors.push("A strong COFOUNDRY_OPERATIONS_TOKEN is required whenever BACKEND_HOST uses a non-loopback address.")

  if (configuredBackendMode && !backendModes.includes(configuredBackendMode as BackendMode))
    errors.push(`NUXT_PUBLIC_BACKEND_MODE must be one of: ${backendModes.join(", ")}.`)

  if (configuredBillingMode && !billingModes.includes(configuredBillingMode as BillingMode))
    errors.push(`NUXT_PUBLIC_BILLING_MODE must be one of: ${billingModes.join(", ")}.`)

  if (publicEnvironment.backendMode === "supabase") {
    if (!publicEnvironment.supabaseUrl)
      errors.push("NUXT_PUBLIC_SUPABASE_URL is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")
    else if (!isAbsoluteUrl(publicEnvironment.supabaseUrl))
      errors.push("NUXT_PUBLIC_SUPABASE_URL must be an absolute HTTP(S) URL.")
    else if (!isOriginUrl(publicEnvironment.supabaseUrl))
      errors.push("NUXT_PUBLIC_SUPABASE_URL must be an origin without credentials, a path, query parameters, or a fragment.")
    else if (!isHttpsUrl(publicEnvironment.supabaseUrl) && !isLocalAppUrl(publicEnvironment.supabaseUrl))
      errors.push("NUXT_PUBLIC_SUPABASE_URL must use HTTPS outside local development.")

    if (!publicEnvironment.supabaseAnonKey)
      errors.push("NUXT_PUBLIC_SUPABASE_ANON_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")

    if (!secretEnvironment.supabaseServiceRoleKey)
      errors.push("SUPABASE_SERVICE_ROLE_KEY is required when NUXT_PUBLIC_BACKEND_MODE=\"supabase\".")

    if (
      publicEnvironment.supabaseAnonKey
      && secretEnvironment.supabaseServiceRoleKey
      && publicEnvironment.supabaseAnonKey === secretEnvironment.supabaseServiceRoleKey
    ) {
      errors.push("NUXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be different credentials.")
    }
  }

  if (publicEnvironment.billingMode === "stripe") {
    if (publicEnvironment.backendMode !== "supabase")
      errors.push("NUXT_PUBLIC_BILLING_MODE=\"stripe\" requires NUXT_PUBLIC_BACKEND_MODE=\"supabase\" for durable subscription reconciliation.")

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

    if (
      publicEnvironment.stripePriceProMonthly
      && publicEnvironment.stripePriceTeamMonthly
      && publicEnvironment.stripePriceProMonthly === publicEnvironment.stripePriceTeamMonthly
    ) {
      errors.push("The Stripe Pro and Team price IDs must be different.")
    }

    const stripeCredentials = [
      publicEnvironment.stripePublishableKey,
      secretEnvironment.stripeSecretKey,
      secretEnvironment.stripeWebhookSecret,
    ].filter(Boolean)
    if (new Set(stripeCredentials).size !== stripeCredentials.length)
      errors.push("Stripe publishable, secret, and webhook credentials must be different.")
  }

  if (requiresSignedSessions && !secretEnvironment.sessionSigningSecret)
    errors.push("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment.")
  else if (requiresSignedSessions && secretEnvironment.sessionSigningSecret.length < 32)
    errors.push("SESSION_SIGNING_SECRET must be at least 32 characters in a non-local environment.")

  if (requiresSignedSessions && !secretEnvironment.operationsWorkerToken)
    errors.push("COFOUNDRY_OPERATIONS_TOKEN is required in a non-local environment.")
  else if (secretEnvironment.operationsWorkerToken && secretEnvironment.operationsWorkerToken.length < 32)
    errors.push("COFOUNDRY_OPERATIONS_TOKEN must be at least 32 characters when it is configured.")

  if (
    secretEnvironment.operationsWorkerToken
    && secretEnvironment.sessionSigningSecret
    && secretEnvironment.operationsWorkerToken === secretEnvironment.sessionSigningSecret
  ) {
    errors.push("COFOUNDRY_OPERATIONS_TOKEN and SESSION_SIGNING_SECRET must be different secrets.")
  }

  if (
    realtimeFanoutToken
    && [secretEnvironment.operationsWorkerToken, secretEnvironment.sessionSigningSecret].includes(realtimeFanoutToken)
  ) {
    errors.push("COFOUNDRY_REALTIME_FANOUT_TOKEN must be different from operations and session secrets.")
  }

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
