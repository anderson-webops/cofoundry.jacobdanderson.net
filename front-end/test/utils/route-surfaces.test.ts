import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { adminNavigation, appNavigation, marketingNavigation } from "../../shared/constants/app"
import { environmentGatedSurfaces, isPrivateSurfacePath, publicMarketingRoutes } from "../../shared/constants/route-surfaces"
import { contractGuidePages, trustCenterPages } from "../../shared/data/public-content"
import { workspaceSeed } from "../../shared/data/seed"
import { getPublicRoutePaths } from "../../shared/utils/directory"

const pagesRoot = resolve(process.cwd(), "src/pages")

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

describe("route surfaces", () => {
  it("keeps public marketing routes backed by real page files", () => {
    for (const route of publicMarketingRoutes)
      expect(routeFileExists(route), `${route} should resolve to a page file`).toBe(true)
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
    for (const route of ["/admin/readiness", "/app/inbox", "/auth/sign-in", "/auth/recover", "/onboarding", "/api/admin/readiness", "/api/operations/events", "/api/operations/mail-smoke", "/api/operations/realtime-events", "/api/workspace"])
      expect(isPrivateSurfacePath(route), `${route} should be private`).toBe(true)

    for (const route of ["/", "/find-cofounder", "/people/ava-morgan", "/sitemap.xml", "/robots.txt", "/api/health"])
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
