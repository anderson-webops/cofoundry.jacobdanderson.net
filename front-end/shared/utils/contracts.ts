import type { ContractVersion, Profile, ProposalVersion } from "../types/domain"

export function buildContractVersionFromProposal(
  proposalVersion: ProposalVersion,
  participants: Profile[],
  contractId: string,
  versionNumber: number,
): ContractVersion {
  const partyNames = participants.map(profile => profile.displayName)

  return {
    id: `${contractId}_version_${versionNumber}`,
    contractId,
    versionNumber,
    parties: partyNames,
    roleTitle: `${proposalVersion.roleTitle} Collaboration Agreement`,
    scope: proposalVersion.responsibilities.join(" "),
    timeCommitment: `Expected weekly commitment: ${proposalVersion.weeklyTimeCommitment} hours beginning ${proposalVersion.startDate}.`,
    compensation: proposalVersion.cashCompensation,
    equity: proposalVersion.equity,
    vesting: `${proposalVersion.vestingSchedule}. Cliff: ${proposalVersion.cliff}.`,
    ipAssignment: proposalVersion.ipAssignmentRequired
      ? "All work product created for the venture is assigned to the company or its successor entity."
      : "IP assignment requirements are intentionally omitted from this version.",
    confidentiality: proposalVersion.confidentiality,
    decisionMaking: proposalVersion.decisionRights,
    termination: proposalVersion.exitTerms,
    disputeResolution: "Parties agree to attempt a good-faith resolution and mediation before formal proceedings.",
    notes: proposalVersion.notes,
    generatedFromProposalVersionId: proposalVersion.id,
    createdAt: new Date().toISOString(),
  }
}
