import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { createEmptySearchFilters, filterOpportunities, filterProfiles, recommendOpportunitiesForProfile } from "../../shared/utils/discovery"

describe("discovery utilities", () => {
  it("filters profiles by role and industry", () => {
    const filters = createEmptySearchFilters()
    filters.roles = ["Technical Co-Founder"]
    filters.industries = ["Fintech"]

    const results = filterProfiles(workspaceSeed, filters)

    expect(results.some(profile => profile.displayName === "Malik Thompson")).toBe(true)
    expect(results.every(profile => profile.industries.includes("Fintech"))).toBe(true)
  })

  it("filters opportunities by stage and commitment", () => {
    const filters = createEmptySearchFilters()
    filters.stage = "prototype"
    filters.timeCommitment = "full_time"

    const results = filterOpportunities(workspaceSeed, filters)

    expect(results).toHaveLength(1)
    expect(results[0]?.startupName).toBe("LedgerLoop")
  })

  it("recommends relevant opportunities for a profile", () => {
    const profile = workspaceSeed.profiles.find(item => item.userId === "user_malik")
    expect(profile).toBeDefined()

    const recommendations = recommendOpportunitiesForProfile(workspaceSeed, profile!)

    expect(recommendations[0]?.opportunity.startupName).toBe("LedgerLoop")
    expect(recommendations[0]?.score).toBeGreaterThan(0)
  })
})
