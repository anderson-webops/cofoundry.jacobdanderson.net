import type { Contract, Match, Message, Profile, Proposal, TrialCollaboration, WorkspaceSeed } from "../types/domain"
import { collaborationContractNeedsUserSignature, collaborationProposalNeedsUserResponse } from "./collaboration"
import { getConversationByMatch, getCurrentContractVersion, getCurrentProposalVersion, getProfileByUserId, getTrialForMatch } from "./workspace"

export interface RelationshipNextAction {
  href: string
  id: string
  label: string
  summary: string
}

export interface RelationshipSnapshot {
  activeContracts: Contract[]
  activeProposals: Proposal[]
  conversationId: string
  counterpartProfile: Profile
  latestMessages: Message[]
  match: Match
  nextActions: RelationshipNextAction[]
  trial: TrialCollaboration | null
  unreadCount: number
}

function sortByDateDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function buildRelationshipActions(seed: WorkspaceSeed, userId: string, proposals: Proposal[], contracts: Contract[], match: Match, trial: TrialCollaboration | null) {
  const actions: RelationshipNextAction[] = []

  proposals.forEach((proposal) => {
    const version = getCurrentProposalVersion(seed, proposal)
    if (!collaborationProposalNeedsUserResponse(proposal, version, userId))
      return

    actions.push({
      href: `/app/proposals/${proposal.id}`,
      id: `proposal:${proposal.id}`,
      label: "Respond to proposal",
      summary: proposal.title,
    })
  })

  contracts.forEach((contract) => {
    const version = getCurrentContractVersion(seed, contract)
    const signatures = seed.signatures.filter(signature => signature.contractId === contract.id)
    if (!collaborationContractNeedsUserSignature(seed, contract, version, signatures, userId))
      return

    actions.push({
      href: `/app/contracts/${contract.id}`,
      id: `contract:${contract.id}`,
      label: "Sign agreement",
      summary: contract.title,
    })
  })

  if (trial && !trial.acknowledgedByUserIds.includes(userId)) {
    actions.push({
      href: "/app/matches",
      id: `trial:${trial.id}`,
      label: "Acknowledge trial",
      summary: trial.title,
    })
  }

  if (!actions.length) {
    actions.push({
      href: `/app/messages/${match.conversationId}`,
      id: `message:${match.conversationId}`,
      label: "Send the next clear update",
      summary: "Keep the relationship moving with one concrete next step.",
    })
  }

  return actions
}

export function buildRelationshipSnapshot(seed: WorkspaceSeed, userId: string, matchId: string): RelationshipSnapshot | null {
  const match = seed.matches.find(item => item.id === matchId)
  if (!match || !match.participantIds.includes(userId))
    return null

  const conversation = getConversationByMatch(seed, match)
  if (!conversation)
    return null

  const counterpartUserId = match.participantIds.find(participantId => participantId !== userId)
  const counterpartProfile = counterpartUserId ? getProfileByUserId(seed, counterpartUserId) : undefined
  if (!counterpartProfile)
    return null

  const activeProposals = sortByDateDesc(seed.proposals.filter(proposal => proposal.conversationId === conversation.id))
  const proposalIds = new Set(activeProposals.map(proposal => proposal.id))
  const activeContracts = sortByDateDesc(seed.contracts.filter(contract => proposalIds.has(contract.proposalId)))
  const latestMessages = sortByDateDesc(seed.messages.filter(message => message.conversationId === conversation.id)).slice(0, 8)
  const trial = getTrialForMatch(seed, match.id) || null

  return {
    activeContracts,
    activeProposals,
    conversationId: conversation.id,
    counterpartProfile,
    latestMessages,
    match,
    nextActions: buildRelationshipActions(seed, userId, activeProposals, activeContracts, match, trial),
    trial,
    unreadCount: conversation.unreadCountByUser[userId] || 0,
  }
}
