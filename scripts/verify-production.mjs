import { spawn } from "node:child_process"
import { createHmac } from "node:crypto"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, "..")
const serverEntry = resolve(projectRoot, "front-end/.output/server/index.mjs")
const port = Number(process.env.VERIFY_PRODUCTION_PORT || 3399)
const host = "127.0.0.1"
const baseUrl = `http://${host}:${port}`
const release = process.env.COFOUNDRY_RELEASE || "verify-production"
const commitSha = process.env.COFOUNDRY_COMMIT_SHA || "verify-production-commit"
const deployedAt = process.env.COFOUNDRY_DEPLOYED_AT || "2026-06-14T00:00:00.000Z"
const configuredPublicAppUrl = process.env.VERIFY_PRODUCTION_APP_URL ?? ""
const expectedCanonicalOrigin = normalizeBaseUrl(process.env.VERIFY_PRODUCTION_CANONICAL_ORIGIN || "https://cofoundry.jacobdanderson.net")
const sessionSigningSecret = "verify-production-session-secret"
const adminSession = {
  email: "ava@cofoundry.dev",
  id: "user_ava",
  name: "Ava Morgan",
  onboardingCompleted: true,
  role: "admin",
  subscriptionPlan: "team",
}

if (!existsSync(serverEntry)) {
  console.error(`Built Nitro server not found at ${serverEntry}. Run npm run build before npm run verify:production.`)
  process.exit(1)
}

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition)
    fail(message)
}

function header(response, name) {
  return response.headers.get(name) || ""
}

function includesNone(value, needles) {
  return needles.every(needle => !value.includes(needle))
}

function normalizeBaseUrl(value) {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""

  return url.toString().replace(/\/+$/, "")
}

function assertNoLocalUrlLeak(value, label) {
  assert(!value.includes("localhost"), `${label} should not expose localhost URLs in production verification`)
  assert(!value.includes("127.0.0.1"), `${label} should not expose 127.0.0.1 URLs in production verification`)
}

function extractSitemapUrl(robotsText) {
  const match = robotsText.match(/^Sitemap:\s*(\S+)/m)
  return match?.[1] || ""
}

function canonicalBaseFromSitemapUrl(sitemapUrl) {
  return sitemapUrl.replace(/\/sitemap\.xml$/, "")
}

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function createSessionSignature(session) {
  return createHmac("sha256", sessionSigningSecret)
    .update(`${session.id}:${session.email.toLowerCase()}`)
    .digest("base64url")
}

function signedAdminCookieHeader() {
  return [
    `cofoundry_session=${encodeBase64Url(JSON.stringify(adminSession))}`,
    `cofoundry_session_sig=${createSessionSignature(adminSession)}`,
  ].join("; ")
}

async function waitForHttp(url, timeoutMs = 45_000) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok)
        return

      lastError = new Error(`${url} returned ${response.status}`)
    }
    catch (error) {
      lastError = error
    }

    await new Promise(resolveWait => setTimeout(resolveWait, 400))
  }

  throw lastError || new Error(`Timed out waiting for ${url}`)
}

async function fetchText(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const text = await response.text()
  return { response, text }
}

async function fetchJson(path, init = {}) {
  const { response, text } = await fetchText(path, init)
  let body
  try {
    body = JSON.parse(text)
  }
  catch (error) {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 200)}`, { cause: error })
  }

  return { body, response }
}

function startServer() {
  const child = spawn("node", [serverEntry], {
    cwd: resolve(projectRoot, "front-end"),
    env: {
      ...process.env,
      COFOUNDRY_COMMIT_SHA: commitSha,
      COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL: "false",
      COFOUNDRY_DEPLOYED_AT: deployedAt,
      COFOUNDRY_RELEASE: release,
      HOST: host,
      NODE_ENV: "production",
      NUXT_PUBLIC_APP_URL: configuredPublicAppUrl,
      NUXT_PUBLIC_BACKEND_MODE: "mock",
      NUXT_PUBLIC_BILLING_MODE: "mock",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
      PORT: String(port),
      SESSION_SIGNING_SECRET: sessionSigningSecret,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.on("data", data => process.stderr.write(`[verify-server] ${data}`))
  child.stderr.on("data", data => process.stderr.write(`[verify-server] ${data}`))

  return child
}

async function stopServer(child) {
  if (child.exitCode !== null)
    return

  child.kill("SIGTERM")
  await new Promise((resolveStop) => {
    const timeout = setTimeout(resolveStop, 5_000)
    child.once("exit", () => {
      clearTimeout(timeout)
      resolveStop()
    })
  })
}

const server = startServer()

try {
  await waitForHttp(`${baseUrl}/api/health`)

  const { body: health, response: healthResponse } = await fetchJson("/api/health")
  assert(healthResponse.status === 200, "/api/health should return 200")
  assert(health.status === "ok", "/api/health should report ok")
  assert(health.modes.backend === "mock", "/api/health should keep backend mode mock")
  assert(health.modes.billing === "mock", "/api/health should keep billing mode mock")
  assert(health.deployment?.release === release, "/api/health should expose deployment release")
  assert(health.deployment?.commitSha === commitSha, "/api/health should expose deployment commit")
  assert(!JSON.stringify(health).includes("verify-production-session-secret"), "/api/health must not expose session secret")
  assert(header(healthResponse, "cache-control").includes("no-store"), "/api/health should be no-store")

  const home = await fetchText("/")
  assert(home.response.status === 200, "home page should return 200")
  assert(header(home.response, "content-security-policy").includes("default-src 'self'"), "home page should include CSP")
  assert(header(home.response, "x-content-type-options") === "nosniff", "home page should include nosniff")
  assert(header(home.response, "x-frame-options") === "DENY", "home page should deny frames")
  assert(header(home.response, "referrer-policy") === "strict-origin-when-cross-origin", "home page should set referrer policy")
  assert(header(home.response, "permissions-policy").includes("camera=()"), "home page should set permissions policy")
  assert(header(home.response, "strict-transport-security").includes("max-age="), "home page should include HSTS for production canonical origin")
  assert(home.text.includes(expectedCanonicalOrigin), `home page should include canonical production origin ${expectedCanonicalOrigin}`)
  assertNoLocalUrlLeak(home.text, "home page")

  const missing = await fetchText("/definitely-not-a-cofoundry-page")
  assert(missing.response.status === 404, "unknown frontend routes should return 404")
  assert(missing.text.includes("noindex, nofollow"), "unknown frontend route should render noindex fallback")

  const adminPage = await fetchText("/admin/readiness", { redirect: "manual" })
  assert([302, 303, 307, 308].includes(adminPage.response.status), "/admin/readiness should redirect unauthenticated users")

  const adminApi = await fetchJson("/api/admin/readiness")
  assert(adminApi.response.status === 401, "/api/admin/readiness should fail closed without admin session")

  const readiness = await fetchJson("/api/admin/readiness", {
    headers: { cookie: signedAdminCookieHeader() },
  })
  assert(readiness.response.status === 200, "authenticated /api/admin/readiness should return 200")
  assert(readiness.body.deployment?.release === release, "readiness should expose deployment release")
  assert(readiness.body.deployment?.commitSha === commitSha, "readiness should expose deployment commit")
  const readinessChecks = Object.fromEntries(readiness.body.groups.flatMap(group => group.checks.map(check => [check.id, check])))
  assert(readinessChecks["deployment-identity"]?.status === "pass", "deployment identity readiness check should pass")
  assert(readiness.body.cutoverPhases.some(phase => phase.id === "durable-mock-baseline"), "readiness should include cutover phases")

  const robots = await fetchText("/robots.txt")
  assert(robots.response.status === 200, "/robots.txt should return 200")
  assert(robots.text.includes("Disallow: /admin"), "robots.txt should disallow admin routes")
  assert(robots.text.includes("Disallow: /app"), "robots.txt should disallow app routes")
  assertNoLocalUrlLeak(robots.text, "robots.txt")
  const sitemapUrl = extractSitemapUrl(robots.text)
  assert(sitemapUrl.endsWith("/sitemap.xml"), "robots.txt should advertise an absolute sitemap URL")
  const canonicalBaseUrl = canonicalBaseFromSitemapUrl(sitemapUrl)
  assert(canonicalBaseUrl === expectedCanonicalOrigin, `robots sitemap URL should use ${expectedCanonicalOrigin}`)

  const sitemap = await fetchText("/sitemap.xml")
  assert(sitemap.response.status === 200, "/sitemap.xml should return 200")
  assertNoLocalUrlLeak(sitemap.text, "sitemap.xml")
  assert(sitemap.text.includes(`<loc>${canonicalBaseUrl}/</loc>`), "sitemap should include home page")
  assert(sitemap.text.includes(`<loc>${canonicalBaseUrl}/find-cofounder</loc>`), "sitemap should include public discovery page")
  assert(includesNone(sitemap.text, ["/admin", "/app", "/api/admin", "/auth/sign-in"]), "sitemap should not include private/auth/admin routes")

  const securityTxt = await fetchText("/.well-known/security.txt")
  assert(securityTxt.response.status === 200, "/.well-known/security.txt should return 200")
  assertNoLocalUrlLeak(securityTxt.text, "security.txt")
  assert(securityTxt.text.includes(`Canonical: ${expectedCanonicalOrigin}/.well-known/security.txt`), "security.txt should include canonical production URL")
  assert(securityTxt.text.includes(`Policy: ${expectedCanonicalOrigin}/safety`), "security.txt should include production policy URL")

  console.log("Production verification passed.")
}
finally {
  await stopServer(server)
}
