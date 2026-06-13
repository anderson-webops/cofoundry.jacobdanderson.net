import type { Contract, Match, Proposal, WorkspaceSeed } from "../types/domain"

const hourMs = 60 * 60 * 1000

export interface RelationshipFunnelStage {
  id: string
  label: string
  count: number
  description: string
}

export interface RelationshipTimeMetric {
  id: string
  label: string
  averageHours: number | null
  valueLabel: string
  sampleSize: number
  context: string
}

export interface RelationshipAnalyticsBottleneck {
  id: string
  label: string
  severity: "high" | "medium" | "low"
  count: number
  summary: string
  action: string
}

export interface RelationshipAnalytics {
  funnel: RelationshipFunnelStage[]
  timeMetrics: RelationshipTimeMetric[]
  introAcceptanceRate: number
  trialActivationRate: number
  proposalCoverageRate: number
  contractGenerationRate: number
  signatureCompletionRate: number
  bottlenecks: RelationshipAnalyticsBottleneck[]
}

function toTime(value?: string | null) {
  if (!value)
    return null

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function hoursBetween(start?: string | null, end?: string | null) {
  const startTime = toTime(start)
  const endTime = toTime(end)
  if (startTime === null || endTime === null || endTime < startTime)
    return null

  return (endTime - startTime) / hourMs
}

function average(values: number[]) {
  if (!values.length)
    return null

  return values.reduce((total, value) => total + value, 0) / values.length
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0)
    return 0

  return Math.round((numerator / denominator) * 100)
}

function formatDuration(hours: number | null) {
  if (hours === null)
    return "No completed samples"

  if (hours < 1)
    return `${Math.round(hours * 60)} min`

  if (hours < 36)
    return `${Math.round(hours * 10) / 10}h`

  return `${Math.round((hours / 24) * 10) / 10} days`
}

function proposalsForMatch(seed: WorkspaceSeed, match: Match) {
  return seed.proposals.filter(proposal => proposal.conversationId === match.conversationId)
}

function earliestProposalForMatch(seed: WorkspaceSeed, match: Match) {
  return proposalsForMatch(seed, match)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .at(0)
}

function contractForProposal(seed: WorkspaceSeed, proposal: Proposal) {
  return seed.contracts
    .filter(contract => contract.proposalId === proposal.id)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .at(0)
}

function requiredSignerIdsForContract(seed: WorkspaceSeed, contract: Contract) {
  const proposal = seed.proposals.find(item => item.id === contract.proposalId)
  if (!proposal)
    return []

  return [...new Set([proposal.createdByUserId, proposal.recipientUserId])]
}

function signedUserIdsForContract(seed: WorkspaceSeed, contract: Contract) {
  return new Set(
    seed.signatures
      .filter(signature => signature.contractId === contract.id && signature.contractVersionId === contract.currentVersionId)
      .map(signature => signature.userId),
  )
}

function isContractFullySigned(seed: WorkspaceSeed, contract: Contract) {
  if (contract.status === "signed")
    return true

  const requiredSignerIds = requiredSignerIdsForContract(seed, contract)
  if (!requiredSignerIds.length)
    return false

  const signedUserIds = signedUserIdsForContract(seed, contract)
  return requiredSignerIds.every(userId => signedUserIds.has(userId))
}

function fullySignedAt(seed: WorkspaceSeed, contract: Contract) {
  const requiredSignerIds = requiredSignerIdsForContract(seed, contract)
  if (!requiredSignerIds.length)
    return null

  const signatures = seed.signatures.filter(signature => signature.contractId === contract.id && requiredSignerIds.includes(signature.userId))
  if (signatures.length < requiredSignerIds.length && contract.status !== "signed")
    return null

  const latestSignatureTime = Math.max(...signatures.map(signature => new Date(signature.signedAt).getTime()))
  if (!Number.isFinite(latestSignatureTime))
    return contract.status === "signed" ? contract.updatedAt : null

  return new Date(latestSignatureTime).toISOString()
}

function firstReplyHours(seed: WorkspaceSeed, match: Match) {
  const messages = seed.messages
    .filter(message => message.conversationId === match.conversationId && message.type === "user" && message.senderUserId)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())

  const firstMessage = messages.find(message => hoursBetween(match.createdAt, message.createdAt) !== null)
  if (!firstMessage?.senderUserId)
    return null

  const reply = messages.find(message => message.senderUserId && message.senderUserId !== firstMessage.senderUserId && new Date(message.createdAt).getTime() > new Date(firstMessage.createdAt).getTime())

  return hoursBetween(firstMessage.createdAt, reply?.createdAt)
}

function buildTimeMetric(id: string, label: string, hours: number[], context: string): RelationshipTimeMetric {
  const averageHours = average(hours)

  return {
    id,
    label,
    averageHours,
    valueLabel: formatDuration(averageHours),
    sampleSize: hours.length,
    context,
  }
}

function buildBottlenecks(seed: WorkspaceSeed): RelationshipAnalyticsBottleneck[] {
  const pendingIntros = seed.connectRequests.filter(request => request.status === "pending").length
  const matchesWithoutTrials = seed.matches.filter(match => !seed.trialCollaborations.some(trial => trial.matchId === match.id)).length
  const matchesWithoutProposals = seed.matches.filter(match => !earliestProposalForMatch(seed, match)).length
  const proposalsWithoutContracts = seed.proposals.filter(proposal => !contractForProposal(seed, proposal)).length
  const contractsAwaitingSignatures = seed.contracts.filter(contract => !isContractFullySigned(seed, contract)).length

  return [
    pendingIntros > 0
      ? {
          id: "pending-intros",
          label: "Pending intros",
          severity: "medium" as const,
          count: pendingIntros,
          summary: `${pendingIntros} intro request${pendingIntros === 1 ? "" : "s"} still need a response.`,
          action: "Drive members back to the inbox before adding more discovery volume.",
        }
      : null,
    matchesWithoutTrials > 0
      ? {
          id: "matches-without-trials",
          label: "Matches without trial sprints",
          severity: "low" as const,
          count: matchesWithoutTrials,
          summary: `${matchesWithoutTrials} match${matchesWithoutTrials === 1 ? "" : "es"} have not been pressure-tested with a trial sprint.`,
          action: "Prompt matched members to define a short trial before negotiating long-form terms.",
        }
      : null,
    matchesWithoutProposals > 0
      ? {
          id: "matches-without-proposals",
          label: "Matches without proposals",
          severity: "medium" as const,
          count: matchesWithoutProposals,
          summary: `${matchesWithoutProposals} match${matchesWithoutProposals === 1 ? "" : "es"} have no structured proposal yet.`,
          action: "Use relationship workspace nudges to convert active conversations into proposal drafts.",
        }
      : null,
    proposalsWithoutContracts > 0
      ? {
          id: "proposals-without-contracts",
          label: "Proposals without agreement drafts",
          severity: "medium" as const,
          count: proposalsWithoutContracts,
          summary: `${proposalsWithoutContracts} proposal${proposalsWithoutContracts === 1 ? "" : "s"} have not generated an agreement draft.`,
          action: "Keep proposal status, comments, and next actions visible until terms are ready for agreement review.",
        }
      : null,
    contractsAwaitingSignatures > 0
      ? {
          id: "contracts-awaiting-signatures",
          label: "Contracts awaiting signatures",
          severity: "high" as const,
          count: contractsAwaitingSignatures,
          summary: `${contractsAwaitingSignatures} agreement draft${contractsAwaitingSignatures === 1 ? "" : "s"} still need every required signature.`,
          action: "Prioritize signature reminders and unresolved agreement blockers in the inbox.",
        }
      : null,
  ].filter((item): item is RelationshipAnalyticsBottleneck => Boolean(item))
}

export function buildRelationshipAnalytics(seed: WorkspaceSeed): RelationshipAnalytics {
  const acceptedIntros = seed.connectRequests.filter(request => request.status === "accepted").length
  const declinedIntros = seed.connectRequests.filter(request => request.status === "declined").length
  const pendingIntros = seed.connectRequests.filter(request => request.status === "pending").length
  const activeTrials = seed.trialCollaborations.filter(trial => trial.status === "active" || trial.status === "completed").length
  const fullySignedContracts = seed.contracts.filter(contract => isContractFullySigned(seed, contract)).length
  const requiredSignatureCount = seed.contracts.reduce((total, contract) => total + requiredSignerIdsForContract(seed, contract).length, 0)
  const completedSignatureCount = seed.contracts.reduce((total, contract) => total + signedUserIdsForContract(seed, contract).size, 0)

  const firstReplySamples = seed.matches
    .map(match => firstReplyHours(seed, match))
    .filter((value): value is number => value !== null)

  const matchToProposalSamples = seed.matches
    .map((match) => {
      const proposal = earliestProposalForMatch(seed, match)
      return hoursBetween(match.createdAt, proposal?.createdAt)
    })
    .filter((value): value is number => value !== null)

  const proposalToContractSamples = seed.proposals
    .map((proposal) => {
      const contract = contractForProposal(seed, proposal)
      return hoursBetween(proposal.createdAt, contract?.createdAt)
    })
    .filter((value): value is number => value !== null)

  const proposalToSignedSamples = seed.proposals
    .map((proposal) => {
      const contract = contractForProposal(seed, proposal)
      if (!contract)
        return null

      return hoursBetween(proposal.createdAt, fullySignedAt(seed, contract))
    })
    .filter((value): value is number => value !== null)

  return {
    funnel: [
      {
        id: "intros",
        label: "Intros sent",
        count: seed.connectRequests.length,
        description: `${acceptedIntros} accepted, ${declinedIntros} declined, ${pendingIntros} pending.`,
      },
      {
        id: "matches",
        label: "Matches unlocked",
        count: seed.matches.length,
        description: "Relationships that unlocked direct workspace activity.",
      },
      {
        id: "trials",
        label: "Trial sprints active",
        count: activeTrials,
        description: "Matches that moved into active or completed working trials.",
      },
      {
        id: "proposals",
        label: "Proposals created",
        count: seed.proposals.length,
        description: "Structured terms started from a matched relationship.",
      },
      {
        id: "contracts",
        label: "Agreement drafts",
        count: seed.contracts.length,
        description: "Proposal terms converted into agreement drafts.",
      },
      {
        id: "signed",
        label: "Fully signed",
        count: fullySignedContracts,
        description: "Agreement drafts with every required signature present.",
      },
    ],
    timeMetrics: [
      buildTimeMetric("first-reply", "Average time to first reply", firstReplySamples, "From the first relationship message to the first response from the other participant."),
      buildTimeMetric("match-to-proposal", "Average match to proposal", matchToProposalSamples, "From match creation to the first structured proposal in that relationship."),
      buildTimeMetric("proposal-to-contract", "Average proposal to agreement draft", proposalToContractSamples, "From proposal creation to the first generated agreement draft."),
      buildTimeMetric("proposal-to-signed", "Average proposal to fully signed", proposalToSignedSamples, "From proposal creation to every required signature on the generated agreement."),
    ],
    introAcceptanceRate: percentage(acceptedIntros, acceptedIntros + declinedIntros),
    trialActivationRate: percentage(activeTrials, seed.matches.length),
    proposalCoverageRate: percentage(seed.matches.filter(match => earliestProposalForMatch(seed, match)).length, seed.matches.length),
    contractGenerationRate: percentage(seed.contracts.length, seed.proposals.length),
    signatureCompletionRate: percentage(completedSignatureCount, requiredSignatureCount),
    bottlenecks: buildBottlenecks(seed),
  }
}
