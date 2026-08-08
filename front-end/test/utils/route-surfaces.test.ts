import { existsSync, readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { adminNavigation, appNavigation, marketingNavigation } from "../../shared/constants/app"
import { environmentGatedSurfaces, isPrivateSurfacePath, publicMarketingRoutes } from "../../shared/constants/route-surfaces"
import { contractGuidePages, trustCenterPages } from "../../shared/data/public-content"
import { workspaceSeed } from "../../shared/data/seed"
import { getPublicRoutePaths } from "../../shared/utils/directory"

const pagesRoot = resolve(process.cwd(), "src/pages")
const layoutsRoot = resolve(process.cwd(), "src/layouts")

const publicPageRoutePatterns = new Set<string>([
  ...publicMarketingRoutes,
  "/contracts/[slug]",
  "/industries/[slug]",
  "/people/[slug]",
  "/roles/[slug]",
  "/stage/[slug]",
  "/startups/[slug]",
  "/trust/[slug]",
])

const ignoredPageRoutePatterns = new Set([
  "/[...all]",
])

function listVuePageFiles(dir = pagesRoot): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = resolve(dir, entry.name)

      if (entry.isDirectory())
        return listVuePageFiles(entryPath)

      if (entry.isFile() && entry.name.endsWith(".vue"))
        return [entryPath]

      return []
    })
    .sort()
}

function pageFileToRoutePattern(filePath: string) {
  const relativePath = filePath
    .replace(pagesRoot, "")
    .replace(/\\/g, "/")
    .replace(/\.vue$/, "")

  if (relativePath === "/index")
    return "/"

  if (relativePath.endsWith("/index"))
    return relativePath.slice(0, -"/index".length)

  return relativePath
}

function listPageEntries() {
  return listVuePageFiles().map(filePath => ({
    filePath,
    route: pageFileToRoutePattern(filePath),
    source: () => readFileSync(filePath, "utf8"),
  }))
}

function routeToCandidates(route: string) {
  const normalized = route === "/" ? "/index" : route
  const directPath = `${normalized}.vue`
  const nestedPath = `${normalized}/index.vue`
  const segments = normalized.split("/").filter(Boolean)
  const dynamicPath = segments.length > 1
    ? `/${segments.slice(0, -1).join("/")}/[slug].vue`
    : null

  return [directPath, nestedPath, dynamicPath]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map(candidate => resolve(pagesRoot, `.${candidate}`))
}

function routeFileExists(route: string) {
  return routeToCandidates(route).some(candidate => existsSync(candidate))
}

function countManualH1Elements(source: string) {
  return Array.from(source.matchAll(/<h1(?:\s|>)/g)).length
}

function countPageIntroH1Elements(source: string) {
  return Array.from(source.matchAll(/<PageIntro\b[^>]*>/g))
    .filter(([tag]) => !/:heading-level=["']2["']/.test(tag))
    .length
}

function countSourceLevelH1Elements(source: string) {
  return countManualH1Elements(source) + countPageIntroH1Elements(source)
}

describe("route surfaces", () => {
  it("keeps every page file intentionally classified as public, private, or catch-all", () => {
    for (const entry of listPageEntries()) {
      if (ignoredPageRoutePatterns.has(entry.route))
        continue

      if (isPrivateSurfacePath(entry.route))
        continue

      expect(
        publicPageRoutePatterns.has(entry.route),
        `${entry.route} should be added to public route policy or moved behind a private prefix`,
      ).toBe(true)
    }
  })

  it("keeps private layouts covered by noindex robots policy", () => {
    for (const layout of ["admin", "app", "auth", "investment-review"]) {
      const source = readFileSync(resolve(layoutsRoot, `${layout}.vue`), "utf8")

      expect(source, `${layout} layout should set noindex`).toContain("noindex, nofollow")
    }
  })

  it("keeps private standalone pages covered by noindex robots policy", () => {
    for (const entry of listPageEntries()) {
      if (!isPrivateSurfacePath(entry.route))
        continue

      const source = entry.source()
      const coveredByPrivateLayout = entry.route.startsWith("/admin")
        || entry.route.startsWith("/app")
        || entry.route.startsWith("/auth")
        || entry.route.startsWith("/investment-review")
        || source.includes("layout: \"auth\"")
        || source.includes("layout: 'auth'")

      expect(
        coveredByPrivateLayout || source.includes("noindex, nofollow"),
        `${entry.route} should inherit a private noindex layout or set noindex directly`,
      ).toBe(true)
    }
  })

  it("keeps public marketing routes backed by real page files", () => {
    for (const route of publicMarketingRoutes)
      expect(routeFileExists(route), `${route} should resolve to a page file`).toBe(true)
  })

  it("keeps public page files to one source-level h1 producer", () => {
    const publicPageEntries = listPageEntries()
      .filter(entry => publicPageRoutePatterns.has(entry.route))

    for (const entry of publicPageEntries) {
      const sourceLevelH1Count = countSourceLevelH1Elements(entry.source())

      expect(sourceLevelH1Count, `${entry.route} should have exactly one h1 source`).toBe(1)
    }
  })

  it("keeps standalone public card indexes from skipping h2 headings", () => {
    const cardIndexExpectations = [
      { card: "ProfileCard", route: "/people" },
      { card: "OpportunityCard", route: "/startups" },
    ]

    for (const expectation of cardIndexExpectations) {
      const entry = listPageEntries().find(page => page.route === expectation.route)

      expect(entry, `${expectation.route} should resolve to a page entry`).toBeDefined()
      expect(entry!.source(), `${expectation.route} should render ${expectation.card} cards as h2`).toMatch(
        new RegExp(`<${expectation.card}[\\s\\S]*:heading-level=["']2["']`),
      )
    }
  })

  it("keeps generated public routes sitemap-safe and backed by page patterns", () => {
    const publicRoutes = getPublicRoutePaths(workspaceSeed)

    expect(new Set(publicRoutes).size).toBe(publicRoutes.length)

    for (const route of publicRoutes) {
      expect(isPrivateSurfacePath(route), `${route} should not be classified as private`).toBe(false)
      expect(routeFileExists(route), `${route} should resolve to a page file or dynamic page pattern`).toBe(true)
    }
  })

  it("classifies private surfaces without hiding public health checks", () => {
    for (const route of ["/admin/readiness", "/app/inbox", "/app/investment", "/app/legal", "/auth/sign-in", "/auth/recover", "/investment-review", "/investment-review/case-1", "/legal-review/secret-token", "/onboarding", "/api/admin/readiness", "/api/investment/workspaces", "/api/investment-review/workspaces", "/api/legal-reviews/secret-token", "/api/operations/events", "/api/operations/mail-smoke", "/api/operations/realtime-events", "/api/workspace"])
      expect(isPrivateSurfacePath(route), `${route} should be private`).toBe(true)

    const publicProfileRoute = getPublicRoutePaths(workspaceSeed).find(route => route.startsWith("/people/"))

    expect(publicProfileRoute, "seed should expose at least one generated public profile route").toBeDefined()

    for (const route of ["/", "/find-cofounder", publicProfileRoute!, "/sitemap.xml", "/robots.txt", "/api/health"])
      expect(isPrivateSurfacePath(route), `${route} should remain public`).toBe(false)
  })

  it("keeps public navigation links aligned with real routes", () => {
    for (const item of marketingNavigation)
      expect(routeFileExists(item.to), `${item.to} should resolve to a page file`).toBe(true)
  })

  it("keeps auth support routes backed by real pages", () => {
    for (const route of ["/auth/sign-in", "/auth/sign-up", "/auth/recover"])
      expect(routeFileExists(route), `${route} should resolve to a page file`).toBe(true)
  })

  it("keeps private workspace navigation links aligned with real routes", () => {
    for (const item of appNavigation)
      expect(routeFileExists(item.to), `${item.to} should resolve to a page file`).toBe(true)

    for (const item of adminNavigation)
      expect(routeFileExists(item.to), `${item.to} should resolve to a page file`).toBe(true)
  })

  it("keeps guide-page call-to-action routes coherent", () => {
    const guideRoutes = [...trustCenterPages, ...contractGuidePages]
      .map(page => page.ctaTo)
      .filter(route => !route.startsWith("/auth/"))

    for (const route of guideRoutes)
      expect(routeFileExists(route), `${route} should resolve to a page file`).toBe(true)
  })

  it("keeps environment-gated surfaces backed by route files", () => {
    for (const surface of environmentGatedSurfaces)
      expect(routeFileExists(surface.route), `${surface.route} should resolve to a page file`).toBe(true)
  })

  it("keeps the catch-all unavailable page as a real noindex 404", () => {
    const source = readFileSync(resolve(pagesRoot, "[...all].vue"), "utf8")

    expect(source).toContain("setResponseStatus(404)")
    expect(source).toContain("noindex, nofollow")
  })
})
