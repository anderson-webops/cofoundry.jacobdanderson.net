import { describe, expect, it } from "vitest"
import { contractGuidePages, trustCenterPages } from "../../shared/data/public-content"
import { workspaceSeed } from "../../shared/data/seed"
import {
  buildPublicProfileSlug,
  formatHubInventoryLabel,
  formatPublicHubInventoryLabel,
  getIndustryHubs,
  getPublicOpportunities,
  getPublicProfiles,
  getPublicRoutePaths,
  getRoleHubs,
  getStageHubs,
} from "../../shared/utils/directory"

describe("public directory utilities", () => {
  it("only exposes opt-in public profiles and searchable public startup searches", () => {
    const profiles = getPublicProfiles(workspaceSeed)
    const opportunities = getPublicOpportunities(workspaceSeed)

    expect(profiles.length).toBeGreaterThan(0)
    expect(profiles.every(entry => entry.profile.privacy.profileVisibility === "public")).toBe(true)
    expect(opportunities.length).toBeGreaterThan(0)
    expect(opportunities.every(entry => entry.ownerProfile.privacy.opportunityVisibility === "public")).toBe(true)
  })

  it("builds stable public slugs for public profiles", () => {
    const olivia = workspaceSeed.profiles.find(profile => profile.userId === "user_olivia")
    expect(olivia).toBeDefined()
    expect(buildPublicProfileSlug(olivia!)).toBe("olivia-chen-olivia")
  })

  it("creates role, industry, and stage hubs from live seed inventory", () => {
    const roleHubs = getRoleHubs(workspaceSeed)
    const industryHubs = getIndustryHubs(workspaceSeed)
    const stageHubs = getStageHubs(workspaceSeed)

    expect(roleHubs.some(entry => entry.slug === "technical-co-founder")).toBe(true)
    expect(industryHubs.some(entry => entry.slug === "fintech")).toBe(true)
    expect(stageHubs.some(entry => entry.slug === "idea")).toBe(true)
  })

  it("formats public hub inventory labels with singular and plural nouns", () => {
    expect(formatHubInventoryLabel({ profileCount: 1, opportunityCount: 1 })).toBe("1 profile · 1 search")
    expect(formatHubInventoryLabel({ profileCount: 2, opportunityCount: 3 })).toBe("2 profiles · 3 searches")

    expect(formatPublicHubInventoryLabel({ profileCount: 1, opportunityCount: 1 })).toBe("1 public profile · 1 public startup search")
    expect(formatPublicHubInventoryLabel({ profileCount: 2, opportunityCount: 3 })).toBe("2 public profiles · 3 public startup searches")
  })

  it("includes new public pages in the sitemap route list", () => {
    const paths = getPublicRoutePaths(workspaceSeed)

    expect(paths).toContain("/find-cofounder")
    expect(paths).toContain(`/trust/${trustCenterPages[0]!.slug}`)
    expect(paths).toContain(`/contracts/${contractGuidePages[0]!.slug}`)
    expect(paths.some(path => path.startsWith("/people/"))).toBe(true)
    expect(paths.some(path => path.startsWith("/startups/"))).toBe(true)
  })
})
