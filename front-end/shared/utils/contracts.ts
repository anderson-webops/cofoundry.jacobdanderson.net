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
    roleTitle: `${proposalVersion.roleTitle} ${proposalVersion.relationshipType === "advisor" ? "Advisor" : "Collaboration"} Agreement`,
    scope: `${proposalVersion.responsibilities.join(" ")} Trial scope: ${proposalVersion.trialScope}`,
    timeCommitment: `Expected weekly commitment: ${proposalVersion.weeklyTimeCommitment} hours beginning ${proposalVersion.startDate}. Full-time trigger: ${proposalVersion.fullTimeTrigger}`,
    compensation: proposalVersion.cashCompensation,
    equity: proposalVersion.equity,
    vesting: `${proposalVersion.vestingSchedule}. Cliff: ${proposalVersion.cliff}.`,
    ipAssignment: proposalVersion.ipAssignmentRequired
      ? `All work product created for the venture is assigned to the company or its successor entity. Trial-work handling: ${proposalVersion.trialIpHandling}`
      : `IP assignment requirements are intentionally omitted from this version. Trial-work handling: ${proposalVersion.trialIpHandling}`,
    confidentiality: proposalVersion.confidentiality,
    decisionMaking: `${proposalVersion.decisionRights} CEO / lead operator decision: ${proposalVersion.ceoDecision}`,
    termination: proposalVersion.exitTerms,
    disputeResolution: "Parties agree to attempt a good-faith resolution and mediation before formal proceedings.",
    notes: proposalVersion.notes,
    generatedFromProposalVersionId: proposalVersion.id,
    createdAt: new Date().toISOString(),
  }
}
