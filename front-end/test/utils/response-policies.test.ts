import { describe, expect, it } from "vitest"
import { buildResponsePolicyHeaders, isPrivateSurfacePath } from "../../server/utils/response-policies"
import { workspaceSeed } from "../../shared/data/seed"
import { getPublicRoutePaths } from "../../shared/utils/directory"

describe("response policies", () => {
  it("marks private app and admin surfaces as no-store and noindex", () => {
    for (const path of ["/app", "/app/inbox", "/admin/users", "/auth/sign-in", "/investment-review", "/investment-review/case-1", "/onboarding"]) {
      expect(isPrivateSurfacePath(path), `${path} should be treated as private`).toBe(true)
      expect(buildResponsePolicyHeaders(path)).toMatchObject({
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      })
    }
  })

  it("marks sensitive API surfaces as no-store and noindex", () => {
    for (const path of ["/api/auth/session", "/api/workspace", "/api/admin/readiness", "/api/investment/workspaces", "/api/investment-review/workspaces", "/api/operations/events", "/api/operations/realtime-events"]) {
      expect(isPrivateSurfacePath(path), `${path} should be treated as private`).toBe(true)
      expect(buildResponsePolicyHeaders(path)).toMatchObject({
        "Cache-Control": "no-store, max-age=0",
        "Pragma": "no-cache",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      })
    }
  })

  it("leaves public marketing, sitemap, and health surfaces cache/index eligible", () => {
    const publicProfilePath = getPublicRoutePaths(workspaceSeed).find(path => path.startsWith("/people/"))

    expect(publicProfilePath, "seed should expose at least one generated public profile route").toBeDefined()

    for (const path of ["/", "/find-cofounder", publicProfilePath!, "/sitemap.xml", "/api/health"]) {
      expect(isPrivateSurfacePath(path), `${path} should not be treated as private`).toBe(false)
      expect(buildResponsePolicyHeaders(path)).toEqual({})
    }
  })
})
