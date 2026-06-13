import type {
  Contract,
  FileScanStatus,
  FileUploadStatus,
  Match,
  Message,
  Profile,
  Proposal,
  RelationshipDecision,
  TrialCollaboration,
  WorkspaceSeed,
} from "../types/domain"
import { collaborationContractNeedsUserSignature, collaborationProposalNeedsUserResponse } from "./collaboration"
import { getConversationByMatch, getCurrentContractVersion, getCurrentProposalVersion, getMatchByConversation, getProfileByUserId, getProposalById, getTrialForMatch } from "./workspace"

export type RelationshipTimelineKind = "message" | "proposal" | "comment" | "contract" | "signature" | "trial" | "file" | "decision"
export type RelationshipDecisionStatus = "open" | "proposed" | "documented" | "signed"

export interface RelationshipNextAction {
  href: string
  id: string
  label: string
  summary: string
}

export interface RelationshipTimelineEntry {
  actorUserId: string | null
  createdAt: string
  href: string | null
  id: string
  kind: RelationshipTimelineKind
  summary: string
  title: string
}

export interface RelationshipFileItem {
  createdAt: string
  href: string | null
  id: string
  name: string
  scanStatus: FileScanStatus | "not_applicable"
  sizeLabel: string
  sourceLabel: string
  status: FileUploadStatus | "shared"
}

export interface RelationshipDecisionLogEntry {
  createdAt: string
  href: string | null
  id: string
  ownerUserId: string | null
  status: RelationshipDecisionStatus
  summary: string
  title: string
}

export interface RelationshipSnapshot {
  activeContracts: Contract[]
  activeProposals: Proposal[]
  conversationId: string
  counterpartProfile: Profile
  decisionLog: RelationshipDecisionLogEntry[]
  files: RelationshipFileItem[]
  latestMessages: Message[]
  match: Match
  nextActions: RelationshipNextAction[]
  timeline: RelationshipTimelineEntry[]
  trial: TrialCollaboration | null
  unreadCount: number
}

function visibleRelationshipMatch(match: Match | undefined, userId: string) {
  if (!match || !match.participantIds.includes(userId))
    return null

  return match
}

function sortByDateDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024)
    return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`

  if (sizeBytes >= 1024)
    return `${Math.round(sizeBytes / 1024)} KB`

  return `${sizeBytes} B`
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

function buildRelationshipFiles(seed: WorkspaceSeed, conversationId: string, proposals: Proposal[], contracts: Contract[]) {
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const contractIds = new Set(contracts.map(contract => contract.id))
  const messageIds = new Set(seed.messages.filter(message => message.conversationId === conversationId).map(message => message.id))

  const messageFiles = seed.messages
    .filter(message => message.conversationId === conversationId)
    .flatMap(message => message.attachments.map(attachment => ({
      createdAt: message.createdAt,
      href: `/app/messages/${conversationId}`,
      id: attachment.id,
      name: attachment.name,
      scanStatus: "not_applicable" as const,
      sizeLabel: attachment.sizeLabel,
      sourceLabel: "Message attachment",
      status: "shared" as const,
    })))

  const uploadedFiles = seed.fileUploads
    .filter((upload) => {
      if (!upload.relatedType || !upload.relatedId)
        return false

      if (upload.relatedType === "message")
        return messageIds.has(upload.relatedId)
      if (upload.relatedType === "proposal")
        return proposalIds.has(upload.relatedId)
      if (upload.relatedType === "contract")
        return contractIds.has(upload.relatedId)

      return false
    })
    .map((upload) => {
      const href = upload.relatedType === "message"
        ? `/app/messages/${conversationId}`
        : upload.relatedType === "proposal"
          ? `/app/proposals/${upload.relatedId}`
          : upload.relatedType === "contract"
            ? `/app/contracts/${upload.relatedId}`
            : null
      const sourceLabel = upload.relatedType === "message"
        ? "Message upload"
        : upload.relatedType === "proposal"
          ? "Proposal upload"
          : upload.relatedType === "contract"
            ? "Contract upload"
            : "Workspace upload"

      return {
        createdAt: upload.createdAt,
        href,
        id: upload.id,
        name: upload.originalFilename,
        scanStatus: upload.scanStatus,
        sizeLabel: formatBytes(upload.sizeBytes),
        sourceLabel,
        status: upload.status,
      }
    })

  return sortByDateDesc([...messageFiles, ...uploadedFiles])
}

function buildRelationshipTimeline(
  seed: WorkspaceSeed,
  conversationId: string,
  proposals: Proposal[],
  contracts: Contract[],
  trial: TrialCollaboration | null,
  files: RelationshipFileItem[],
  relationshipDecisions: RelationshipDecision[],
) {
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const entries: RelationshipTimelineEntry[] = []

  seed.messages
    .filter(message => message.conversationId === conversationId)
    .forEach((message) => {
      entries.push({
        actorUserId: message.senderUserId,
        createdAt: message.createdAt,
        href: `/app/messages/${conversationId}`,
        id: `message:${message.id}`,
        kind: "message",
        summary: message.body,
        title: message.senderUserId ? "Message sent" : "System update",
      })
    })

  seed.proposalVersions
    .filter(version => proposalIds.has(version.proposalId))
    .forEach((version) => {
      const proposal = proposals.find(item => item.id === version.proposalId)
      entries.push({
        actorUserId: version.createdByUserId,
        createdAt: version.createdAt,
        href: proposal ? `/app/proposals/${proposal.id}` : null,
        id: `proposal-version:${version.id}`,
        kind: "proposal",
        summary: version.summary,
        title: `Proposal v${version.versionNumber}`,
      })
    })

  seed.proposalComments
    .filter(comment => proposalIds.has(comment.proposalId))
    .forEach((comment) => {
      entries.push({
        actorUserId: comment.authorUserId,
        createdAt: comment.createdAt,
        href: `/app/proposals/${comment.proposalId}`,
        id: `proposal-comment:${comment.id}`,
        kind: "comment",
        summary: comment.body,
        title: "Proposal comment",
      })
    })

  contracts.forEach((contract) => {
    seed.contractVersions
      .filter(version => version.contractId === contract.id)
      .forEach((version) => {
        entries.push({
          actorUserId: null,
          createdAt: version.createdAt,
          href: `/app/contracts/${contract.id}`,
          id: `contract-version:${version.id}`,
          kind: "contract",
          summary: version.scope,
          title: `Agreement draft v${version.versionNumber}`,
        })
      })

    seed.signatures
      .filter(signature => signature.contractId === contract.id)
      .forEach((signature) => {
        entries.push({
          actorUserId: signature.userId,
          createdAt: signature.signedAt,
          href: `/app/contracts/${contract.id}`,
          id: `signature:${signature.id}`,
          kind: "signature",
          summary: `${signature.typedName} signed ${contract.title}.`,
          title: "Signature recorded",
        })
      })
  })

  if (trial) {
    entries.push({
      actorUserId: trial.createdByUserId,
      createdAt: trial.createdAt,
      href: "/app/matches",
      id: `trial:${trial.id}`,
      kind: "trial",
      summary: trial.objective,
      title: "Trial sprint opened",
    })
  }

  files.forEach((file) => {
    entries.push({
      actorUserId: null,
      createdAt: file.createdAt,
      href: file.href,
      id: `file:${file.id}`,
      kind: "file",
      summary: `${file.name} · ${file.sizeLabel}`,
      title: file.sourceLabel,
    })
  })

  relationshipDecisions.forEach((decision) => {
    entries.push({
      actorUserId: decision.authorUserId,
      createdAt: decision.createdAt,
      href: `/app/relationships/${decision.matchId}`,
      id: `relationship-decision:${decision.id}`,
      kind: "decision",
      summary: decision.body,
      title: decision.title,
    })
  })

  return sortByDateDesc(entries)
}

function buildRelationshipDecisionLog(
  seed: WorkspaceSeed,
  matchId: string,
  proposals: Proposal[],
  contracts: Contract[],
  trial: TrialCollaboration | null,
) {
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const entries: RelationshipDecisionLogEntry[] = []

  seed.relationshipDecisions
    .filter(decision => decision.matchId === matchId)
    .forEach((decision) => {
      entries.push({
        createdAt: decision.createdAt,
        href: `/app/relationships/${decision.matchId}`,
        id: `relationship-decision:${decision.id}`,
        ownerUserId: decision.authorUserId,
        status: decision.status,
        summary: decision.body,
        title: decision.title,
      })
    })

  seed.proposalVersions
    .filter(version => proposalIds.has(version.proposalId))
    .forEach((version) => {
      entries.push({
        createdAt: version.createdAt,
        href: `/app/proposals/${version.proposalId}`,
        id: `proposal-decision:${version.id}`,
        ownerUserId: version.createdByUserId,
        status: "proposed",
        summary: version.decisionRights,
        title: `Decision rights proposed in v${version.versionNumber}`,
      })
    })

  seed.proposalComments
    .filter(comment => proposalIds.has(comment.proposalId) && comment.section === "decision_rights")
    .forEach((comment) => {
      entries.push({
        createdAt: comment.createdAt,
        href: `/app/proposals/${comment.proposalId}`,
        id: `decision-comment:${comment.id}`,
        ownerUserId: comment.authorUserId,
        status: "open",
        summary: comment.body,
        title: "Decision-rights question",
      })
    })

  contracts.forEach((contract) => {
    seed.contractVersions
      .filter(version => version.contractId === contract.id)
      .forEach((version) => {
        entries.push({
          createdAt: version.createdAt,
          href: `/app/contracts/${contract.id}`,
          id: `contract-decision:${version.id}`,
          ownerUserId: null,
          status: contract.status === "signed" ? "signed" : "documented",
          summary: version.decisionMaking,
          title: "Agreement decision clause",
        })
      })
  })

  if (trial) {
    entries.push({
      createdAt: trial.updatedAt,
      href: "/app/matches",
      id: `trial-decision-log:${trial.id}`,
      ownerUserId: trial.createdByUserId,
      status: "documented",
      summary: trial.deliverables.find(deliverable => deliverable.toLowerCase().includes("decision")) || trial.scope,
      title: "Trial decision log requirement",
    })
  }

  return sortByDateDesc(entries)
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
  const files = buildRelationshipFiles(seed, conversation.id, activeProposals, activeContracts)
  const relationshipDecisions = seed.relationshipDecisions.filter(decision => decision.matchId === match.id)
  const timeline = buildRelationshipTimeline(seed, conversation.id, activeProposals, activeContracts, trial, files, relationshipDecisions)
  const decisionLog = buildRelationshipDecisionLog(seed, match.id, activeProposals, activeContracts, trial)

  return {
    activeContracts,
    activeProposals,
    conversationId: conversation.id,
    counterpartProfile,
    decisionLog,
    files,
    latestMessages,
    match,
    nextActions: buildRelationshipActions(seed, userId, activeProposals, activeContracts, match, trial),
    timeline,
    trial,
    unreadCount: conversation.unreadCountByUser[userId] || 0,
  }
}

export function getRelationshipMatchByConversation(seed: WorkspaceSeed, userId: string, conversationId: string) {
  return visibleRelationshipMatch(getMatchByConversation(seed, conversationId), userId)
}

export function getRelationshipMatchByProposal(seed: WorkspaceSeed, userId: string, proposalId: string) {
  const proposal = getProposalById(seed, proposalId)
  if (!proposal)
    return null

  return getRelationshipMatchByConversation(seed, userId, proposal.conversationId)
}

export function getRelationshipMatchByContract(seed: WorkspaceSeed, userId: string, contractId: string) {
  const contract = seed.contracts.find(item => item.id === contractId)
  if (!contract)
    return null

  return getRelationshipMatchByProposal(seed, userId, contract.proposalId)
}

export function getRelationshipHrefForConversation(seed: WorkspaceSeed, userId: string, conversationId: string) {
  const match = getRelationshipMatchByConversation(seed, userId, conversationId)
  return match ? `/app/relationships/${match.id}` : null
}

export function getRelationshipHrefForProposal(seed: WorkspaceSeed, userId: string, proposalId: string) {
  const match = getRelationshipMatchByProposal(seed, userId, proposalId)
  return match ? `/app/relationships/${match.id}` : null
}

export function getRelationshipHrefForContract(seed: WorkspaceSeed, userId: string, contractId: string) {
  const match = getRelationshipMatchByContract(seed, userId, contractId)
  return match ? `/app/relationships/${match.id}` : null
}
