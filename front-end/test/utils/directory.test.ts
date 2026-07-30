import { describe, expect, it } from "vitest"
import { contractGuidePages, trustCenterPages } from "../../shared/data/public-content"
import { workspaceSeed } from "../../shared/data/seed"
import {
  buildPublicDirectorySnapshot,
  buildPublicProfileSlug,
  formatHubInventoryLabel,
  formatPublicHubInventoryLabel,
  getIndustryHubs,
  getPublicOpportunities,
  getPublicProfiles,
  getPublicRoutePaths,
  getRoleHubs,
  getStageHubs,
  projectOpportunityForPublicDirectory,
  projectProfileForPublicDirectory,
} from "../../shared/utils/directory"

const reservedPublicHostnames = new Set(["example.com", "example.net", "example.org"])

function isReservedPublicUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()

    return reservedPublicHostnames.has(hostname)
      || hostname === "example"
      || hostname.endsWith(".example")
      || hostname.endsWith(".invalid")
      || hostname.endsWith(".localhost")
      || hostname.endsWith(".test")
  }
  catch {
    return false
  }
}

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

  it("removes relationship-gated links and private onboarding fields from public profiles", () => {
    const source = structuredClone(workspaceSeed.profiles.find(profile => profile.userId === "user_olivia")!)
    source.privacy.contactDetailsVisibleToMatchesOnly = true
    source.privacy.portfolioVisibility = "private"
    source.links.website = "https://private.example"
    source.portfolio = [{
      id: "private-project",
      name: "Private project",
      outcome: "Private",
      role: "Founder",
      summary: "Private",
      url: "https://private.example/project",
    }]
    source.ipReadiness.existingAssetsNotes = "Confidential ownership notes"
    source.intent.nonNegotiables = ["Confidential constraint"]

    const projected = projectProfileForPublicDirectory(source)

    expect(projected.links).toEqual({
      github: "",
      linkedin: "",
      portfolio: "",
      website: "",
    })
    expect(projected.portfolio).toEqual([])
    expect(projected.ipReadiness.existingAssetsNotes).toBe("")
    expect(projected.intent.nonNegotiables).toEqual([])
    expect(projected.commitmentProfile.runwayBucket).toBe("undisclosed")
    expect(projected.photoUrl).toBe("")
    expect(projected.id).toBe("")
  })

  it("allowlists public opportunity fields and removes moderation metadata", () => {
    const source = structuredClone(workspaceSeed.opportunities[0]!)
    source.riskFlags = ["internal-review-note"]
    source.verificationMethod = "work_email"

    const projected = projectOpportunityForPublicDirectory(source)

    expect(projected.id).toBe("")
    expect(projected.ownerUserId).toBe("")
    expect(projected.riskFlags).toEqual([])
    expect(projected.verificationMethod).toBe("none")
  })

  it("builds a public snapshot without account, moderation, contract, or billing records", () => {
    const serialized = JSON.stringify(buildPublicDirectorySnapshot(workspaceSeed))

    expect(serialized).not.toContain("olivia@cofoundry.dev")
    expect(serialized).not.toContain("reviewedByUserId")
    expect(serialized).not.toContain("stripeCustomerId")
    expect(serialized).not.toContain("contract_ledgerloop")
    expect(serialized).not.toContain("linkedin-verification-summary.pdf")
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

  it("keeps public seed links off reserved test domains", () => {
    const publicProfileUrls = getPublicProfiles(workspaceSeed).flatMap(({ profile }) => [
      profile.links.linkedin,
      profile.links.github,
      profile.links.portfolio,
      profile.links.website,
      ...profile.trustSignals.builderProofs.map(artifact => artifact.url),
    ])
    const publicOpportunityUrls = getPublicOpportunities(workspaceSeed).map(({ opportunity }) => opportunity.officialWebsite)
    const publicUrls = [...publicProfileUrls, ...publicOpportunityUrls].filter(Boolean)

    expect(publicUrls.filter(isReservedPublicUrl)).toEqual([])
  })
})
