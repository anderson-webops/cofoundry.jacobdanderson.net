import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildContractVersionFromProposal } from "../../shared/utils/contracts"

describe("contract generation", () => {
  it("builds an agreement version from a proposal version", () => {
    const proposalVersion = workspaceSeed.proposalVersions.find(item => item.id === "proposal_version_ledgerloop_2")
    const profiles = workspaceSeed.profiles.filter(profile => ["user_olivia", "user_malik"].includes(profile.userId))

    expect(proposalVersion).toBeDefined()

    const contractVersion = buildContractVersionFromProposal(proposalVersion!, profiles, "contract_test", 1)

    expect(contractVersion.contractId).toBe("contract_test")
    expect(contractVersion.versionNumber).toBe(1)
    expect(contractVersion.parties).toEqual(["Olivia Chen", "Malik Thompson"])
    expect(contractVersion.equity).toContain("24%")
  })
})
