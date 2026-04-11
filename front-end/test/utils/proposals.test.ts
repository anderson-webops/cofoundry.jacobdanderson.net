import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildProposalSectionSummaries, buildProposalTermsSummary, buildProposalTimeline, buildProposalUnresolvedItems } from "../../shared/utils/proposals"
import { getCurrentProposalVersion, getProposalById, getProposalComments, getProposalVersions } from "../../shared/utils/workspace"

describe("proposal helpers", () => {
  it("builds section summaries from the current version and comments", () => {
    const proposal = getProposalById(workspaceSeed, "proposal_ledgerloop_cto")
    expect(proposal).toBeTruthy()

    const version = getCurrentProposalVersion(workspaceSeed, proposal!)
    const comments = getProposalComments(workspaceSeed, proposal!.id)
    const sections = buildProposalSectionSummaries(version!, comments, proposal!.status)

    expect(sections).toHaveLength(7)
    expect(sections.find(section => section.id === "decision_rights")?.state).toBe("countered")
    expect(sections.find(section => section.id === "trial")?.body).toContain("workflow slice")
  })

  it("surfaces unresolved items until the proposal is accepted", () => {
    const proposal = getProposalById(workspaceSeed, "proposal_trialwire_design")
    const version = getCurrentProposalVersion(workspaceSeed, proposal!)
    const comments = getProposalComments(workspaceSeed, proposal!.id)
    const unresolved = buildProposalUnresolvedItems(buildProposalSectionSummaries(version!, comments, proposal!.status))

    expect(unresolved.length).toBeGreaterThan(0)
    expect(unresolved.some(section => section.id === "economics")).toBe(true)
  })

  it("orders proposal timeline entries newest first", () => {
    const proposal = getProposalById(workspaceSeed, "proposal_ledgerloop_cto")
    const timeline = buildProposalTimeline(proposal!, getProposalVersions(workspaceSeed, proposal!.id))

    expect(timeline[0]?.versionNumber).toBe(2)
    expect(timeline[0]?.current).toBe(true)
    expect(timeline[1]?.versionNumber).toBe(1)
  })

  it("builds a counsel-ready summary snapshot", () => {
    const proposal = getProposalById(workspaceSeed, "proposal_ledgerloop_cto")
    const version = getCurrentProposalVersion(workspaceSeed, proposal!)
    const summary = buildProposalTermsSummary(version!)

    expect(summary.find(item => item.label === "Partnership")?.value).toContain("Technical Co-Founder")
    expect(summary.find(item => item.label === "Trial IP handling")?.value).toContain("confidential")
  })
})
