import {
  collectEnvironmentValidationErrors,
  isLocalDevelopmentEnvironment,
  readDeploymentMetadata,
  readPublicEnvironment,
  readSecretEnvironment,
} from "./environment.js"

export type HostEnvironmentCheckStatus = "fail" | "pass" | "warn"

export interface HostEnvironmentCheck {
  detail: string
  id: string
  remediation?: string
  status: HostEnvironmentCheckStatus
  title: string
}

export interface HostEnvironmentReport {
  checks: HostEnvironmentCheck[]
  deployment: {
    commitSha: string
    deployedAt: string
    release: string
  }
  failCount: number
  mode: {
    appUrl: string
    backend: string
    billing: string
    demoAccessEnabled: boolean
    localDevelopment: boolean
    nodeEnv: string
    productionExpected: boolean
  }
  ok: boolean
  warningCount: number
}

type EnvironmentSource = Record<string, string | undefined>

export interface HostEnvironmentOptions {
  failOnWarnings?: boolean
  production?: boolean
}

const localHostnames = new Set(["::1", "127.0.0.1", "localhost"])

function readValue(env: EnvironmentSource, key: string) {
  return env[key]?.trim() || ""
}

function hasValue(env: EnvironmentSource, key: string) {
  return Boolean(readValue(env, key))
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value)
    return localHostnames.has(url.hostname)
  }
  catch {
    return false
  }
}

function addCheck(
  checks: HostEnvironmentCheck[],
  status: HostEnvironmentCheckStatus,
  id: string,
  title: string,
  detail: string,
  remediation?: string,
) {
  checks.push({
    detail,
    id,
    remediation,
    status,
    title
  })
}

function summarizeSecretPresence(isPresent: boolean, label: string) {
  return isPresent
    ? `${label} is present.`
    : `${label} is missing.`
}

interface HostEnvironmentContext {
  env: EnvironmentSource
  publicEnvironment: ReturnType<typeof readPublicEnvironment>
  secretEnvironment: ReturnType<typeof readSecretEnvironment>
  deployment: ReturnType<typeof readDeploymentMetadata>
  validationErrors: string[]
  localDevelopment: boolean
  productionExpected: boolean
}

function addEnvironmentContractCheck({ validationErrors }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (validationErrors.length > 0) {
    addCheck(
      checks,
      "fail",
      "env-contract",
      "Mode-specific environment contract",
      validationErrors.join(" "),
      "Resolve the listed configuration errors or switch the affected mode back to mock.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "env-contract",
      "Mode-specific environment contract",
      "Public and server-only environment values satisfy the active backend and billing modes.",
    )
  }
}

function addNodeEnvironmentCheck({ env, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (productionExpected) {
    if (readValue(env, "NODE_ENV") === "production") {
      addCheck(checks, "pass", "node-env", "Production Node environment", "NODE_ENV is production.")
    }
    else {
      addCheck(
        checks,
        "fail",
        "node-env",
        "Production Node environment",
        "NODE_ENV is not production.",
        "Set NODE_ENV=production in the host-managed app service environment.",
      )
    }
  }
  else {
    addCheck(checks, "pass", "node-env", "Local Node environment", "This environment is being treated as local development.")
  }
}

function addPublicOriginCheck({ env, publicEnvironment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (productionExpected) {
    if (!publicEnvironment.appUrl) {
      addCheck(
        checks,
        "fail",
        "app-url",
        "Canonical public app URL",
        "NUXT_PUBLIC_APP_URL is missing.",
        "Set NUXT_PUBLIC_APP_URL to the deployed HTTPS origin.",
      )
    }
    else if (isLocalUrl(publicEnvironment.appUrl) && readValue(env, "COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL") !== "true") {
      addCheck(
        checks,
        "fail",
        "app-url",
        "Canonical public app URL",
        `NUXT_PUBLIC_APP_URL points at a local origin: ${publicEnvironment.appUrl}.`,
        "Set NUXT_PUBLIC_APP_URL to the deployed HTTPS origin. Use COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL=true only for local smoke tests.",
      )
    }
    else if (!publicEnvironment.appUrl.startsWith("https://")) {
      addCheck(
        checks,
        "fail",
        "app-url",
        "Canonical public app URL",
        `NUXT_PUBLIC_APP_URL is not HTTPS: ${publicEnvironment.appUrl}.`,
        "Use the public HTTPS origin for hosted production.",
      )
    }
    else {
      addCheck(checks, "pass", "app-url", "Canonical public app URL", `Using ${publicEnvironment.appUrl}.`)
    }
  }
  else {
    addCheck(checks, "pass", "app-url", "Local app URL", `Using ${publicEnvironment.appUrl || "local default"}.`)
  }
}

function addDemoAccessCheck({ publicEnvironment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (productionExpected && publicEnvironment.enableDemoAccess) {
    addCheck(
      checks,
      "fail",
      "demo-access",
      "Demo access flag",
      "NUXT_PUBLIC_ENABLE_DEMO_ACCESS is enabled in a production-expected environment.",
      "Set NUXT_PUBLIC_ENABLE_DEMO_ACCESS=false for production-facing hosts.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "demo-access",
      "Demo access flag",
      publicEnvironment.enableDemoAccess ? "Demo access is enabled for local/staging use." : "Demo access is disabled.",
    )
  }
}

function addBackendBindCheck({ env }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  const backendHost = readValue(env, "BACKEND_HOST") || "127.0.0.1"
  const publicBackendBind = !localHostnames.has(backendHost.toLowerCase())
  if (publicBackendBind && readValue(env, "COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND") !== "true") {
    addCheck(
      checks,
      "fail",
      "backend-bind",
      "Backend network bind",
      `BACKEND_HOST=${backendHost} exposes the operations backend without explicit authorization.`,
      "Bind the backend to 127.0.0.1 or explicitly authorize and firewall a public bind.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "backend-bind",
      "Backend network bind",
      publicBackendBind
        ? `Explicit public bind authorized for ${backendHost}.`
        : `Backend binds to ${backendHost}.`,
    )
  }
}

function addProxyTrustCheck({ env }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  const trustsProxyHeaders = readValue(env, "COFOUNDRY_TRUST_PROXY_HEADERS") === "true"
  const trustedProxyIps = readValue(env, "COFOUNDRY_TRUSTED_PROXY_IPS")
  if (trustsProxyHeaders && !trustedProxyIps) {
    addCheck(
      checks,
      "fail",
      "trusted-proxy",
      "Trusted proxy boundary",
      "Forwarded headers are enabled without a direct-proxy IP allowlist.",
      "Set COFOUNDRY_TRUSTED_PROXY_IPS to the exact reverse-proxy addresses or disable forwarded-header trust.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "trusted-proxy",
      "Trusted proxy boundary",
      trustsProxyHeaders
        ? `Forwarded headers are limited to configured direct proxies: ${trustedProxyIps}.`
        : "Forwarded headers are not trusted.",
    )
  }
}

function addSessionSecretCheck({ secretEnvironment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (productionExpected && !secretEnvironment.sessionSigningSecret) {
    addCheck(
      checks,
      "fail",
      "session-secret",
      "Session signing secret",
      "SESSION_SIGNING_SECRET is missing.",
      "Inject SESSION_SIGNING_SECRET from the host secret store so invited-account sessions survive deploys.",
    )
  }
  else if (secretEnvironment.sessionSigningSecret && secretEnvironment.sessionSigningSecret.length < 32) {
    addCheck(
      checks,
      productionExpected ? "fail" : "warn",
      "session-secret",
      "Session signing secret",
      "SESSION_SIGNING_SECRET is present but shorter than 32 characters.",
      "Use a long random secret from the host secret store.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "session-secret",
      "Session signing secret",
      summarizeSecretPresence(Boolean(secretEnvironment.sessionSigningSecret), "SESSION_SIGNING_SECRET"),
    )
  }
}

function addDeploymentIdentityCheck({ deployment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (productionExpected && !deployment.release && !deployment.commitSha) {
    addCheck(
      checks,
      "fail",
      "deployment-identity",
      "Deployment identity",
      "Neither COFOUNDRY_RELEASE nor COFOUNDRY_COMMIT_SHA is set in host env.",
      "Set at least one non-secret deployment identity value before restarting the production service.",
    )
  }
  else {
    const identity = [
      deployment.release
        ? `release=${deployment.release}`
        : null,
      deployment.commitSha
        ? `commit=${deployment.commitSha.slice(0, 12)}`
        : null,
      deployment.deployedAt
        ? `deployedAt=${deployment.deployedAt}`
        : null,
    ].filter(Boolean).join(", ")

    addCheck(
      checks,
      deployment.release || deployment.commitSha
        ? "pass"
        : "warn",
      "deployment-identity",
      "Deployment identity",
      identity || "No release or commit identity is set. This is acceptable only for local development.",
    )
  }
}

function addLocalDataCheck({ env, publicEnvironment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  if (productionExpected && publicEnvironment.backendMode === "mock" && !hasValue(env, "COFOUNDRY_LOCAL_DATA_DIR")) {
    addCheck(
      checks,
      "warn",
      "local-data-dir",
      "Durable local data directory",
      "COFOUNDRY_LOCAL_DATA_DIR is not set while mock/access-request mode is active.",
      "Set COFOUNDRY_LOCAL_DATA_DIR to a durable, backed-up host path before relying on invited local accounts or access-request persistence.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "local-data-dir",
      "Durable local data directory",
      hasValue(env, "COFOUNDRY_LOCAL_DATA_DIR")
        ? `Using COFOUNDRY_LOCAL_DATA_DIR=${readValue(env, "COFOUNDRY_LOCAL_DATA_DIR")}.`
        : "No durable local data directory is required for this mode.",
    )
  }
}

function addOperationsTokenCheck({ secretEnvironment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  const operationsTokenLength = secretEnvironment.operationsWorkerToken.length
  addCheck(
    checks,
    operationsTokenLength >= 32
      ? "pass"
      : operationsTokenLength || productionExpected
        ? "fail"
        : "warn",
    "operations-token",
    "Operations worker token",
    operationsTokenLength >= 32
      ? "COFOUNDRY_OPERATIONS_TOKEN is present and meets the minimum length."
      : operationsTokenLength
        ? "COFOUNDRY_OPERATIONS_TOKEN is shorter than 32 characters."
        : "COFOUNDRY_OPERATIONS_TOKEN is missing.",
    operationsTokenLength >= 32
      ? undefined
      : "Set COFOUNDRY_OPERATIONS_TOKEN to a distinct random value of at least 32 characters before starting a hosted app or operations timers.",
  )
}

function addOAuthProviderCheck({ env, publicEnvironment, productionExpected }: HostEnvironmentContext, checks: HostEnvironmentCheck[]) {
  const oauthMarkers = [
    "COFOUNDRY_OAUTH_PROVIDER",
    "COFOUNDRY_GOOGLE_OAUTH_PROVIDER",
    "COFOUNDRY_GITHUB_OAUTH_PROVIDER",
  ].filter(key => hasValue(env, key))

  if (productionExpected && publicEnvironment.backendMode !== "supabase" && oauthMarkers.length > 0) {
    addCheck(
      checks,
      "warn",
      "oauth-markers",
      "OAuth provider markers",
      `OAuth provider marker(s) are set while backend mode is ${publicEnvironment.backendMode}: ${oauthMarkers.join(", ")}.`,
      "Unset OAuth provider markers until Supabase mode and provider callback smoke tests are complete.",
    )
  }
  else {
    addCheck(
      checks,
      "pass",
      "oauth-markers",
      "OAuth provider markers",
      oauthMarkers.length > 0
        ? `Configured marker(s): ${oauthMarkers.join(", ")}.`
        : "No OAuth provider markers are set.",
    )
  }
}

export function buildHostEnvironmentReport(
  env: EnvironmentSource,
  options: HostEnvironmentOptions = {},
): HostEnvironmentReport {
  const publicEnvironment = readPublicEnvironment(env)
  const secretEnvironment = readSecretEnvironment(env)
  const deployment = readDeploymentMetadata(env)
  const validationErrors = collectEnvironmentValidationErrors(env)
  const localDevelopment = isLocalDevelopmentEnvironment(env)
  const productionExpected = options.production || readValue(env, "NODE_ENV") === "production" || !localDevelopment
  const checks: HostEnvironmentCheck[] = []
  const context = {
    env,
    publicEnvironment,
    secretEnvironment,
    deployment,
    validationErrors,
    localDevelopment,
    productionExpected
  }

  addEnvironmentContractCheck(context, checks)
  addNodeEnvironmentCheck(context, checks)
  addPublicOriginCheck(context, checks)
  addDemoAccessCheck(context, checks)
  addBackendBindCheck(context, checks)
  addProxyTrustCheck(context, checks)
  addSessionSecretCheck(context, checks)
  addDeploymentIdentityCheck(context, checks)
  addLocalDataCheck(context, checks)
  addOperationsTokenCheck(context, checks)
  addOAuthProviderCheck(context, checks)

  const failCount = checks.filter(check => check.status === "fail").length
  const warningCount = checks.filter(check => check.status === "warn").length
  const ok = failCount === 0 && (!options.failOnWarnings || warningCount === 0)

  return {
    checks,
    deployment,
    failCount,
    mode: {
      appUrl: publicEnvironment.appUrl,
      backend: publicEnvironment.backendMode,
      billing: publicEnvironment.billingMode,
      demoAccessEnabled: publicEnvironment.enableDemoAccess,
      localDevelopment,
      nodeEnv: readValue(env, "NODE_ENV") || "(unset)",
      productionExpected,
    },
    ok,
    warningCount,
  }
}
