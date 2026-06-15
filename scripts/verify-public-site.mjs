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
const requiredPublicRoutes = [
  "/",
  "/find-cofounder",
  "/how-it-works",
  "/pricing",
  "/faq",
  "/safety",
  "/trust",
  "/contracts",
  "/people",
  "/roles",
  "/industries",
  "/stage",
  "/startups",
  "/terms",
  "/privacy",
  "/contact",
]
const expectedDynamicSitemapPrefixes = [
  "/contracts/",
  "/industries/",
  "/people/",
  "/roles/",
  "/stage/",
  "/startups/",
  "/trust/",
]
const privateSitemapNeedles = ["/admin", "/app", "/api/admin", "/auth/sign-in"]
const ignoredHrefSchemes = ["blob:", "data:", "javascript:", "mailto:", "sms:", "tel:"]
const ignoredLinkedPathPrefixes = [
  "/_nuxt/",
  "/apple-touch-icon",
  "/favicon",
  "/og-default.png",
  "/robots.txt",
  "/site.webmanifest",
  "/sitemap.xml",
  "/.well-known/security.txt",
]
const publicNavigationBlocklistPrefixes = ["/admin", "/app", "/api", "/email", "/onboarding"]
const allowedNoindexLinkedRoutePrefixes = ["/auth"]
const localUrlNeedles = ["localhost", "127.0.0.1", "[::1]"]

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

function firstMatchingLine(value, needles) {
  return value.split(/\r?\n/).find(line => needles.some(needle => line.includes(needle)))?.trim()
}

function decodeXml(value) {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", "\"")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")
}

function extractSitemapUrl(robotsText) {
  const match = robotsText.match(/^Sitemap:\s*(\S+)/m)
  return match?.[1] || ""
}

function extractSitemapLocs(sitemapText) {
  return Array.from(sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g), match => decodeXml(match[1]))
}

function hasNoindex(response, text) {
  return header(response, "x-robots-tag").toLowerCase().includes("noindex")
    || text.toLowerCase().includes("noindex")
}

function normalizeRoutePath(pathname) {
  if (!pathname || pathname === "/")
    return "/"

  return pathname.replace(/\/+$/, "") || "/"
}

function routePathFromSitemapLoc(loc) {
  const url = new URL(loc)

  assert(url.origin === expectedCanonicalOrigin, `sitemap URL ${loc} should use ${expectedCanonicalOrigin}`)
  assert(!url.search, `sitemap URL ${loc} should not include query strings`)
  assert(!url.hash, `sitemap URL ${loc} should not include fragments`)

  return normalizeRoutePath(url.pathname)
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

function assertNoPublicLocalUrlLeak(text, label) {
  if (isLocalVerificationTarget)
    return

  const leakedLine = firstMatchingLine(text, localUrlNeedles)

  assert(!leakedLine, `${label} must not expose local URLs in public verification${leakedLine ? ` (found: ${leakedLine})` : ""}`)
}

function extractAnchorHrefs(html) {
  const matches = html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)

  return Array.from(matches, match => decodeXml(match[1] || match[2] || match[3] || "").trim())
}

function routeMatchesPrefix(route, prefix) {
  return route === prefix || route.startsWith(`${prefix}/`)
}

function routeMatchesAnyPrefix(route, prefixes) {
  return prefixes.some(prefix => routeMatchesPrefix(route, prefix))
}

function formatSources(sources) {
  const sourceList = Array.from(sources)
  const visibleSources = sourceList.slice(0, 4).join(", ")
  const remainingCount = sourceList.length - 4

  return remainingCount > 0 ? `${visibleSources}, and ${remainingCount} more` : visibleSources
}

function addLinkSource(linkSources, linkedRoute, sourceRoute) {
  const sources = linkSources.get(linkedRoute) || new Set()
  sources.add(sourceRoute)
  linkSources.set(linkedRoute, sources)
}

function routePathFromInternalHref(rawHref, sourceRoute) {
  const href = rawHref.trim()
  if (!href || href.startsWith("#"))
    return null

  const hrefLower = href.toLowerCase()
  if (ignoredHrefSchemes.some(scheme => hrefLower.startsWith(scheme)))
    return null

  const url = new URL(href, canonicalUrlForRoute(sourceRoute))
  if (![baseOrigin, expectedCanonicalOrigin].includes(url.origin))
    return null

  const pathname = normalizeRoutePath(url.pathname)
  if (routeMatchesAnyPrefix(pathname, ignoredLinkedPathPrefixes))
    return null

  return `${pathname}${url.search}`
}

function assertPublicPageMetadata(text, route) {
  if (isLocalVerificationTarget)
    return

  assertNoPublicLocalUrlLeak(text, `${route} public page metadata or payload`)
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

function assertSitemapInventory(routes) {
  assert(routes.length > 0, "sitemap should include at least one public route")

  const routeSet = new Set(routes)
  assert(routeSet.size === routes.length, "sitemap should not contain duplicate public route URLs")

  for (const route of requiredPublicRoutes)
    assert(routeSet.has(route), `sitemap should include ${route}`)

  for (const prefix of expectedDynamicSitemapPrefixes)
    assert(routes.some(route => route.startsWith(prefix)), `sitemap should include at least one ${prefix} detail route`)

  for (const route of routes)
    assert(includesNone(route, privateSitemapNeedles), `sitemap should not include private/auth/admin route ${route}`)
}

async function assertPublicInternalLinks(linkSources, publicRouteSet) {
  for (const [linkedRoute, sources] of [...linkSources.entries()].sort(([first], [second]) => first.localeCompare(second))) {
    const linkedUrl = new URL(linkedRoute, `${baseUrl}/`)
    const linkedPath = normalizeRoutePath(linkedUrl.pathname)
    const sourceLabel = formatSources(sources)

    assert(
      !routeMatchesAnyPrefix(linkedPath, publicNavigationBlocklistPrefixes),
      `public pages should not link private route ${linkedRoute}; linked from ${sourceLabel}`,
    )

    const page = await fetchText(linkedRoute, { redirect: "manual" })

    if (routeMatchesAnyPrefix(linkedPath, allowedNoindexLinkedRoutePrefixes)) {
      assert(page.response.status === 200, `allowed noindex link ${linkedRoute} from ${sourceLabel} should return 200`)
      assert(hasNoindex(page.response, page.text), `allowed noindex link ${linkedRoute} from ${sourceLabel} should be noindex`)
      continue
    }

    assert(page.response.status === 200, `public link ${linkedRoute} from ${sourceLabel} should return 200`)
    assertSecurityHeaders(page.response, linkedRoute)
    assert(!hasNoindex(page.response, page.text), `public link ${linkedRoute} from ${sourceLabel} should not be noindex`)
    assert(publicRouteSet.has(linkedPath), `public link ${linkedRoute} from ${sourceLabel} should be listed in sitemap.xml`)
    assertPublicPageMetadata(page.text, linkedPath)
  }
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

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function failureHints(message) {
  const hints = []

  if (message.includes("local URLs") || message.includes("localhost") || message.includes("127.0.0.1"))
    hints.push(`Set NUXT_PUBLIC_APP_URL=${expectedCanonicalOrigin} on the host, rebuild/redeploy, and restart the service. A local URL in robots, sitemap, security.txt, or page metadata usually means the public server is stale or missing the canonical app URL env.`)

  if (message.includes("release") || message.includes("commitSha") || message.includes("deployment identity"))
    hints.push("Verify COFOUNDRY_RELEASE and COFOUNDRY_COMMIT_SHA are exported to the running service, then confirm systemd is running the newly deployed build.")

  if (message.includes("private route") || message.includes("noindex") || message.includes("auth/admin"))
    hints.push("Check public navigation and legal/footer links. Public sitemap routes should not link directly to app, admin, API, onboarding, or email-management surfaces; auth entry pages must stay noindex.")

  if (message.includes("listed in sitemap") || message.includes("should return 200") || message.includes("sitemap should include"))
    hints.push("Regenerate or update the public route inventory so every linked public route resolves with 200 and appears in sitemap.xml.")

  if (message.includes("CSP") || message.includes("HSTS") || message.includes("security") || message.includes("nosniff"))
    hints.push("Confirm the Nuxt security-header middleware is active on the deployed server and that HTTPS requests terminate with HSTS enabled.")

  if (!hints.length)
    hints.push("Run npm run build && npm run verify:public:local first. If that passes, deploy the exact validated commit/tag and rerun this live verifier with VERIFY_PUBLIC_EXPECT_RELEASE and VERIFY_PUBLIC_EXPECT_COMMIT_SHA.")

  return hints
}

function reportFailure(error) {
  const message = errorMessage(error)

  console.error(`Public site verification failed for ${baseUrl}.`)
  console.error(`Reason: ${message}`)
  console.error("")
  console.error("Next checks:")
  for (const hint of failureHints(message))
    console.error(`- ${hint}`)
}

try {
const { body: health, response: healthResponse } = await fetchJson("/api/health")
assert(healthResponse.status === 200, "/api/health should return 200")
assert(health.status === "ok", "/api/health should report ok")
assert(health.modes.backend === expectedBackendMode, `/api/health backend mode should be ${expectedBackendMode}`)
assert(health.modes.billing === expectedBillingMode, `/api/health billing mode should be ${expectedBillingMode}`)
assertDeploymentIdentity(health)
assert(header(healthResponse, "cache-control").includes("no-store"), "/api/health should be no-store")

const robots = await fetchText("/robots.txt")
assert(robots.response.status === 200, "/robots.txt should return 200")
assert(robots.text.includes("Disallow: /admin"), "robots.txt should disallow admin routes")
assert(robots.text.includes("Disallow: /app"), "robots.txt should disallow app routes")
assert(robots.text.includes("Disallow: /auth"), "robots.txt should disallow auth routes")
assertNoPublicLocalUrlLeak(robots.text, "robots.txt")
const sitemapUrl = extractSitemapUrl(robots.text)
assert(sitemapUrl, "robots.txt should advertise sitemap")
assert(new URL(sitemapUrl).origin === expectedCanonicalOrigin, `robots sitemap should use ${expectedCanonicalOrigin}`)

const sitemap = await fetchText("/sitemap.xml")
assert(sitemap.response.status === 200, "/sitemap.xml should return 200")
assertNoPublicLocalUrlLeak(sitemap.text, "sitemap.xml")
assert(includesNone(sitemap.text, privateSitemapNeedles), "sitemap should not include private/auth/admin routes")

const publicRoutes = extractSitemapLocs(sitemap.text).map(routePathFromSitemapLoc)
assertSitemapInventory(publicRoutes)

const publicRouteSet = new Set(publicRoutes)
const internalLinkSources = new Map()

for (const route of publicRoutes) {
  const page = await fetchText(route)
  assert(page.response.status === 200, `${route} should return 200`)
  assertSecurityHeaders(page.response, route)
  assert(!header(page.response, "x-robots-tag").toLowerCase().includes("noindex"), `${route} should not send noindex headers`)
  assertPublicPageMetadata(page.text, route)

  for (const href of extractAnchorHrefs(page.text)) {
    const linkedRoute = routePathFromInternalHref(href, route)
    if (linkedRoute)
      addLinkSource(internalLinkSources, linkedRoute, route)
  }
}

await assertPublicInternalLinks(internalLinkSources, publicRouteSet)

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

const securityTxt = await fetchText("/.well-known/security.txt")
assert(securityTxt.response.status === 200, "/.well-known/security.txt should return 200")
assert(securityTxt.text.includes("Contact:"), "security.txt should include Contact")
assert(securityTxt.text.includes(`Canonical: ${expectedCanonicalOrigin}/.well-known/security.txt`), "security.txt should include canonical production URL")

console.log(`Public site verification passed for ${baseUrl} across ${publicRoutes.length} sitemap routes and ${internalLinkSources.size} internal links.`)
}
catch (error) {
  reportFailure(error)
  process.exitCode = 1
}
