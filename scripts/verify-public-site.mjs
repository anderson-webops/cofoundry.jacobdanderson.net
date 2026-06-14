import process from "node:process"

const defaultBaseUrl = "https://cofoundry.jacobdanderson.net"
const rawBaseUrl = process.env.VERIFY_PUBLIC_BASE_URL || process.env.NUXT_PUBLIC_APP_URL || defaultBaseUrl
const baseUrl = normalizeBaseUrl(rawBaseUrl)
const baseHostname = new URL(baseUrl).hostname
const baseOrigin = new URL(baseUrl).origin
const expectedCanonicalOrigin = normalizeBaseUrl(process.env.VERIFY_PUBLIC_CANONICAL_ORIGIN || baseOrigin)
const expectedBackendMode = process.env.VERIFY_PUBLIC_EXPECT_BACKEND_MODE || "mock"
const expectedBillingMode = process.env.VERIFY_PUBLIC_EXPECT_BILLING_MODE || "mock"
const expectedRelease = blankToUndefined(process.env.VERIFY_PUBLIC_EXPECT_RELEASE)
const expectedCommitSha = blankToUndefined(process.env.VERIFY_PUBLIC_EXPECT_COMMIT_SHA)
const requireDeploymentIdentity = booleanEnv(process.env.VERIFY_PUBLIC_REQUIRE_DEPLOYMENT_IDENTITY) || Boolean(expectedRelease || expectedCommitSha)
const isLocalVerificationTarget = ["localhost", "127.0.0.1", "::1"].includes(baseHostname)
const publicRoutes = [
  "/",
  "/find-cofounder",
  "/how-it-works",
  "/pricing",
  "/trust",
  "/terms",
  "/privacy",
  "/contact",
]

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition)
    fail(message)
}

function normalizeBaseUrl(value) {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""

  return url.toString().replace(/\/+$/, "")
}

function blankToUndefined(value) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function booleanEnv(value) {
  return ["1", "true", "yes"].includes(value?.trim().toLowerCase() || "")
}

function header(response, name) {
  return response.headers.get(name) || ""
}

function includesNone(value, needles) {
  return needles.every(needle => !value.includes(needle))
}

function extractSitemapUrl(robotsText) {
  const match = robotsText.match(/^Sitemap:\s*(\S+)/m)
  return match?.[1] || ""
}

function hasNoindex(response, text) {
  return header(response, "x-robots-tag").toLowerCase().includes("noindex")
    || text.toLowerCase().includes("noindex")
}

function assertSecurityHeaders(response, route) {
  assert(header(response, "content-security-policy").includes("default-src 'self'"), `${route} should include a self-based CSP`)
  assert(header(response, "x-content-type-options") === "nosniff", `${route} should include nosniff`)
  assert(["DENY", "SAMEORIGIN"].includes(header(response, "x-frame-options")), `${route} should include clickjacking protection`)
  assert(header(response, "referrer-policy") === "strict-origin-when-cross-origin", `${route} should set referrer policy`)
  assert(header(response, "permissions-policy").includes("camera=()"), `${route} should set permissions policy`)

  if (new URL(baseUrl).protocol === "https:")
    assert(header(response, "strict-transport-security").includes("max-age="), `${route} should include HSTS on HTTPS`)
}

function canonicalUrlForRoute(route) {
  return new URL(route, `${expectedCanonicalOrigin}/`).toString()
}

function assertPublicPageMetadata(text, route) {
  if (isLocalVerificationTarget)
    return

  assert(!text.includes("localhost"), `${route} should not expose localhost in public page metadata or payload`)
  assert(text.includes(canonicalUrlForRoute(route)), `${route} should include canonical public URL ${canonicalUrlForRoute(route)}`)
}

function assertDeploymentIdentity(health) {
  const deployment = health.deployment || {}

  if (requireDeploymentIdentity)
    assert(Boolean(deployment.release || deployment.commitSha), "/api/health should expose release or commit deployment identity")

  if (expectedRelease)
    assert(deployment.release === expectedRelease, `/api/health release should be ${expectedRelease}`)

  if (expectedCommitSha)
    assert(deployment.commitSha === expectedCommitSha, `/api/health commitSha should be ${expectedCommitSha}`)
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

for (const route of publicRoutes) {
  const page = await fetchText(route)
  assert(page.response.status === 200, `${route} should return 200`)
  assertSecurityHeaders(page.response, route)
  assert(!header(page.response, "x-robots-tag").toLowerCase().includes("noindex"), `${route} should not send noindex headers`)
  assertPublicPageMetadata(page.text, route)
}

const { body: health, response: healthResponse } = await fetchJson("/api/health")
assert(healthResponse.status === 200, "/api/health should return 200")
assert(health.status === "ok", "/api/health should report ok")
assert(health.modes.backend === expectedBackendMode, `/api/health backend mode should be ${expectedBackendMode}`)
assert(health.modes.billing === expectedBillingMode, `/api/health billing mode should be ${expectedBillingMode}`)
assertDeploymentIdentity(health)
assert(header(healthResponse, "cache-control").includes("no-store"), "/api/health should be no-store")

const adminPage = await fetchText("/admin/readiness", { redirect: "manual" })
assert([302, 303, 307, 308].includes(adminPage.response.status), "/admin/readiness should redirect unauthenticated users")
assert(hasNoindex(adminPage.response, adminPage.text), "/admin/readiness redirect should be noindex")

const appPage = await fetchText("/app", { redirect: "manual" })
assert([302, 303, 307, 308].includes(appPage.response.status), "/app should redirect unauthenticated users")
assert(hasNoindex(appPage.response, appPage.text), "/app redirect should be noindex")

const adminApi = await fetchJson("/api/admin/readiness")
assert(adminApi.response.status === 401, "/api/admin/readiness should fail closed without admin session")
assert(header(adminApi.response, "x-robots-tag").toLowerCase().includes("noindex"), "/api/admin/readiness should be noindex")

const signIn = await fetchText("/auth/sign-in")
assert(signIn.response.status === 200, "/auth/sign-in should exist")
assert(hasNoindex(signIn.response, signIn.text), "/auth/sign-in should be noindex")

const missing = await fetchText("/definitely-not-a-cofoundry-page")
assert(missing.response.status === 404, "unknown frontend routes should return 404")
assert(hasNoindex(missing.response, missing.text), "unknown frontend route should be noindex")

const robots = await fetchText("/robots.txt")
assert(robots.response.status === 200, "/robots.txt should return 200")
assert(robots.text.includes("Disallow: /admin"), "robots.txt should disallow admin routes")
assert(robots.text.includes("Disallow: /app"), "robots.txt should disallow app routes")
assert(robots.text.includes("Disallow: /auth"), "robots.txt should disallow auth routes")
assert(!robots.text.includes("localhost"), "robots.txt must not expose localhost URLs in public verification")
const sitemapUrl = extractSitemapUrl(robots.text)
assert(sitemapUrl, "robots.txt should advertise sitemap")
assert(new URL(sitemapUrl).origin === expectedCanonicalOrigin, `robots sitemap should use ${expectedCanonicalOrigin}`)

const sitemap = await fetchText("/sitemap.xml")
assert(sitemap.response.status === 200, "/sitemap.xml should return 200")
assert(sitemap.text.includes(`<loc>${expectedCanonicalOrigin}/</loc>`), "sitemap should include home page with canonical origin")
assert(sitemap.text.includes(`<loc>${expectedCanonicalOrigin}/find-cofounder</loc>`), "sitemap should include discovery page with canonical origin")
assert(!sitemap.text.includes("localhost"), "sitemap must not expose localhost URLs in public verification")
assert(includesNone(sitemap.text, ["/admin", "/app", "/api/admin", "/auth/sign-in"]), "sitemap should not include private/auth/admin routes")

const securityTxt = await fetchText("/.well-known/security.txt")
assert(securityTxt.response.status === 200, "/.well-known/security.txt should return 200")
assert(securityTxt.text.includes("Contact:"), "security.txt should include Contact")
assert(securityTxt.text.includes(`Canonical: ${expectedCanonicalOrigin}/.well-known/security.txt`), "security.txt should include canonical production URL")

console.log(`Public site verification passed for ${baseUrl}.`)
