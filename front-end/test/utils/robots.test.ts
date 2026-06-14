import { describe, expect, it } from "vitest"
import { privateApiRoutePrefixes, privateWorkspaceRoutePrefixes } from "../../shared/constants/route-surfaces"
import { blockedTrainingRobots, buildRobotsTxt, getRobotsDisallowPaths, publicSearchRobots } from "../../shared/utils/robots"

describe("robots helpers", () => {
  it("keeps robots disallow paths aligned with private route prefixes", () => {
    const disallowPaths = getRobotsDisallowPaths()

    expect(disallowPaths).toEqual(Array.from(new Set(disallowPaths)))

    for (const prefix of privateWorkspaceRoutePrefixes)
      expect(disallowPaths, `${prefix} should be disallowed`).toContain(prefix)

    for (const prefix of privateApiRoutePrefixes)
      expect(disallowPaths, `${prefix} should be disallowed`).toContain(prefix)
  })

  it("builds robots.txt without omitting private workspace surfaces", () => {
    const robotsTxt = buildRobotsTxt("https://cofoundry.example/")

    for (const userAgent of blockedTrainingRobots) {
      expect(robotsTxt).toContain(`User-agent: ${userAgent}\nDisallow: /`)
    }

    for (const userAgent of publicSearchRobots)
      expect(robotsTxt).toContain(`User-agent: ${userAgent}\nAllow: /`)

    expect(robotsTxt).toContain("Disallow: /email")
    expect(robotsTxt).toContain("Disallow: /api/admin")
    expect(robotsTxt).not.toContain("Disallow: /api\n")
    expect(robotsTxt).toContain("Sitemap: https://cofoundry.example/sitemap.xml")
  })
})
