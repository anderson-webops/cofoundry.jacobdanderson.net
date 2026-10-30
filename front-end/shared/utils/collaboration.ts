import type {
  ConnectDeclineReason,
  ConnectRequest,
  ConnectRequestPayload,
  ConnectRequestStatus,
  Contract,
  ContractVersion,
  ContractVersionPayload,
  Conversation,
  Match,
  Message,
  MessageAttachment,
  Notification,
  NotificationType,
  Proposal,
  ProposalComment,
  ProposalPayload,
  ProposalSectionKey,
  ProposalStatus,
  ProposalVersion,
  RelationshipDecision,
  RelationshipDecisionRecordStatus,
  Signature,
  WorkspaceSeed,
} from "../types/domain"
import { cloneValue } from "./clone"
import { buildContractVersionFromProposal } from "./contracts"
import { buildStructuredIntroNote } from "./formation"
import { buildTrialDraft, getContractById, getCurrentContractVersion, getCurrentProposalVersion, getProfileByUserId, getProposalById } from "./workspace"

interface IdOverrides {
  connectRequestId?: string
  connectRequestNotificationId?: string
  matchId?: string
  conversationId?: string
  systemMessageId?: string
  matchNotificationId?: string
  messageId?: string
  proposalId?: string
  proposalVersionId?: string
  proposalNotificationId?: string
  proposalCommentId?: string
  contractId?: string
  contractVersionId?: string
  contractNotificationId?: string
  signatureId?: string
  trialId?: string
  trialNotificationId?: string
  relationshipDecisionId?: string
  relationshipDecisionNotificationId?: string
}

function nextId(fallback?: string) {
  return fallback || crypto.randomUUID()
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function touchProfileActivity(seed: WorkspaceSeed, userId: string, touchedAt: string) {
  const profile = getProfileByUserId(seed, userId)
  if (profile)
    profile.trustSignals.lastActiveAt = touchedAt
}

function syncResponseMetrics(seed: WorkspaceSeed, userId: string) {
  const profile = getProfileByUserId(seed, userId)
  if (!profile)
    return

  const inboundRequests = seed.connectRequests.filter(request => request.toUserId === userId)
  if (!inboundRequests.length) {
    profile.trustSignals.replyRatePercent = 0
    profile.trustSignals.medianReplyHours = 48
    return
  }

  const respondedRequests = inboundRequests.filter(request => request.respondedAt)
  profile.trustSignals.replyRatePercent = Math.round((respondedRequests.length / inboundRequests.length) * 100)

  if (!respondedRequests.length) {
    profile.trustSignals.medianReplyHours = 48
    return
  }

  const replyHours = respondedRequests
    .map((request) => {
      const createdAt = new Date(request.createdAt).getTime()
      const respondedAt = new Date(request.respondedAt!).getTime()
      return Math.max(1, Math.round((respondedAt - createdAt) / 36e5))
    })
    .sort((left, right) => left - right)

  profile.trustSignals.medianReplyHours = replyHours[Math.floor(replyHours.length / 2)] || 48
}

export function deriveCollaborationTrustMetrics(seed: WorkspaceSeed) {
  const nextSeed = cloneValue(seed)

  for (const profile of nextSeed.profiles) {
    const userId = profile.userId
    const activityTimes = [
      profile.trustSignals.lastActiveAt,
      ...nextSeed.connectRequests.flatMap((request) => {
        if (request.fromUserId === userId)
          return [request.createdAt]
        if (request.toUserId === userId && request.respondedAt)
          return [request.respondedAt]
        return []
      }),
      ...nextSeed.messages.flatMap(message => message.senderUserId === userId
        ? [message.createdAt]
        : []),
      ...nextSeed.proposalVersions.flatMap(version => version.createdByUserId === userId
        ? [version.createdAt]
        : []),
      ...nextSeed.proposalComments.flatMap(comment => comment.authorUserId === userId
        ? [comment.createdAt]
        : []),
      ...nextSeed.signatures.flatMap(signature => signature.userId === userId
        ? [signature.signedAt]
        : []),
      ...nextSeed.trialCollaborations.flatMap(trial => trial.createdByUserId === userId
        ? [trial.createdAt]
        : []),
      ...nextSeed.relationshipDecisions.flatMap(decision => decision.authorUserId === userId
        ? [decision.updatedAt]
        : []),
      ...nextSeed.reports.flatMap(report => report.reporterUserId === userId
        ? [report.createdAt]
        : []),
      ...nextSeed.investmentApplications.flatMap(application => application.applicantUserId === userId
        ? [application.createdAt]
        : []),
    ].filter(Boolean)
    const latestActivity = activityTimes
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0]

    if (latestActivity)
      profile.trustSignals.lastActiveAt = latestActivity

    syncResponseMetrics(nextSeed, userId)
  }

  return nextSeed
}

function createNotification(
  seed: WorkspaceSeed,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  href: string,
  createdAt: string,
  notificationId?: string,
) {
  seed.notifications = [
    {
      id: nextId(notificationId),
      userId,
      type,
      title,
      body,
      href,
      readAt: null,
      createdAt,
    },
    ...seed.notifications.filter(notification => notification.id !== notificationId),
  ]
}

export function isConnectRequestParticipant(request: ConnectRequest, userId: string) {
  return request.fromUserId === userId || request.toUserId === userId
}

export function canUserRespondToConnectRequest(request: ConnectRequest, userId: string) {
  return request.toUserId === userId && request.status === "pending"
}

export function isConversationParticipant(conversation: Conversation, userId: string) {
  return conversation.participantIds.includes(userId)
}

export function isProposalParticipant(proposal: Proposal, userId: string) {
  return proposal.createdByUserId === userId || proposal.recipientUserId === userId
}

export function canUserUpdateProposalStatus(
  seed: WorkspaceSeed,
  proposal: Proposal,
  userId: string,
  status: Extract<ProposalStatus, "accepted" | "rejected" | "viewed">,
) {
  if (!isProposalParticipant(proposal, userId) || ["accepted", "rejected"].includes(proposal.status))
    return false

  const currentVersion = getCurrentProposalVersion(seed, proposal)
  if (!currentVersion || currentVersion.createdByUserId === userId)
    return false

  return ["accepted", "rejected", "viewed"].includes(status)
}

export function canUserCounterProposal(seed: WorkspaceSeed, proposal: Proposal, userId: string) {
  if (!isProposalParticipant(proposal, userId) || ["accepted", "rejected"].includes(proposal.status))
    return false

  const currentVersion = getCurrentProposalVersion(seed, proposal)
  return Boolean(currentVersion && currentVersion.createdByUserId !== userId)
}

export function getContractParticipantIds(seed: WorkspaceSeed, contract: Contract) {
  const proposal = getProposalById(seed, contract.proposalId)
  if (!proposal)
    return []

  return [proposal.createdByUserId, proposal.recipientUserId]
}

export function isContractParticipant(seed: WorkspaceSeed, contract: Contract, userId: string) {
  return getContractParticipantIds(seed, contract).includes(userId)
}

export function isRelationshipParticipant(seed: WorkspaceSeed, matchId: string, userId: string) {
  const match = seed.matches.find(item => item.id === matchId)
  return Boolean(match?.participantIds.includes(userId))
}

export function isNotificationOwnedByUser(notification: Notification, userId: string) {
  return notification.userId === userId
}

export function collaborationProposalNeedsUserResponse(proposal: Proposal, currentVersion: ProposalVersion | undefined, userId: string) {
  if (!currentVersion)
    return false

  if (!isProposalParticipant(proposal, userId))
    return false

  if (proposal.status === "accepted" || proposal.status === "rejected")
    return false

  return currentVersion.createdByUserId !== userId
}

export function collaborationContractNeedsUserSignature(
  seed: WorkspaceSeed,
  contract: Contract,
  currentVersion: ContractVersion | undefined,
  signatures: Signature[],
  userId: string,
) {
  if (!currentVersion || contract.status !== "pending_signature" || !isContractParticipant(seed, contract, userId))
    return false

  return !signatures.some(signature =>
    signature.contractId === contract.id
    && signature.contractVersionId === currentVersion.id
    && signature.userId === userId,
  )
}

export function createConnectRequestTransition(
  seed: WorkspaceSeed,
  fromUserId: string,
  toUserId: string,
  payload: ConnectRequestPayload,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const fromProfile = getProfileByUserId(nextSeed, fromUserId)
  const request: ConnectRequest = {
    id: nextId(ids.connectRequestId),
    fromUserId,
    toUserId,
    note: payload.note || buildStructuredIntroNote(payload.structuredIntro),
    structuredIntro: payload.structuredIntro,
    status: "pending",
    declineReason: null,
    createdAt,
    respondedAt: null,
  }

  nextSeed.connectRequests = [request, ...nextSeed.connectRequests]
  touchProfileActivity(nextSeed, fromUserId, createdAt)
  syncResponseMetrics(nextSeed, toUserId)
  createNotification(
    nextSeed,
    toUserId,
    "match",
    "New structured intro",
    `${fromProfile?.displayName || "A member"} proposed ${payload.structuredIntro.roleContext.toLowerCase()} and wants to start with ${payload.structuredIntro.proposedNextStep.replaceAll("_", " ")}.`,
    "/app/inbox",
    createdAt,
    ids.connectRequestNotificationId,
  )

  return {
    request,
    seed: nextSeed,
  }
}

export function respondToConnectRequestTransition(
  seed: WorkspaceSeed,
  requestId: string,
  status: ConnectRequestStatus,
  respondedAt: string,
  declineReason: ConnectDeclineReason | null = null,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const requestIndex = nextSeed.connectRequests.findIndex(request => request.id === requestId)
  if (requestIndex === -1)
    return { conversationId: null, seed: nextSeed }

  const request = nextSeed.connectRequests[requestIndex]!
  const updatedRequest: ConnectRequest = {
    ...request,
    status,
    declineReason: status === "declined"
      ? declineReason
      : null,
    respondedAt,
  }

  nextSeed.connectRequests.splice(requestIndex, 1, updatedRequest)
  touchProfileActivity(nextSeed, updatedRequest.toUserId, respondedAt)
  syncResponseMetrics(nextSeed, updatedRequest.toUserId)

  if (status !== "accepted") {
    createNotification(
      nextSeed,
      updatedRequest.fromUserId,
      "match",
      "Structured intro closed",
      declineReason
        ? `The other side declined with reason: ${declineReason.replaceAll("_", " ")}.`
        : "The other side closed the intro without opening a match.",
      "/app/inbox",
      respondedAt,
      ids.matchNotificationId,
    )
    return {
      conversationId: null,
      seed: nextSeed,
    }
  }

  const conversationId = nextId(ids.conversationId)
  const conversation: Conversation = {
    id: conversationId,
    participantIds: [updatedRequest.fromUserId, updatedRequest.toUserId],
    lastMessageAt: respondedAt,
    unreadCountByUser: {
      [updatedRequest.fromUserId]: 0,
      [updatedRequest.toUserId]: 0,
    },
    typingByUserIds: [],
  }
  const match: Match = {
    id: nextId(ids.matchId),
    participantIds: [updatedRequest.fromUserId, updatedRequest.toUserId],
    source: "connect_request",
    conversationId,
    createdAt: respondedAt,
  }
  const systemMessage: Message = {
    id: nextId(ids.systemMessageId),
    conversationId,
    senderUserId: null,
    type: "system",
    body: `Connection accepted. Messaging is now unlocked. Suggested next step: ${updatedRequest.structuredIntro.proposedNextStep.replaceAll("_", " ")}.`,
    attachments: [],
    createdAt: respondedAt,
  }

  nextSeed.conversations = [conversation, ...nextSeed.conversations]
  nextSeed.matches = [match, ...nextSeed.matches]
  nextSeed.messages = [...nextSeed.messages, systemMessage]

  createNotification(
    nextSeed,
    updatedRequest.fromUserId,
    "match",
    "Structured intro accepted",
    "A mutual match is now open. Move quickly into a first call or trial sprint while intent is still fresh.",
    `/app/messages/${conversationId}`,
    respondedAt,
    ids.matchNotificationId,
  )

  return {
    conversationId,
    match,
    request: updatedRequest,
    seed: nextSeed,
  }
}

export function sendMessageTransition(
  seed: WorkspaceSeed,
  conversationId: string,
  senderUserId: string | null,
  body: string,
  attachments: MessageAttachment[],
  createdAt: string,
  type: Message["type"] = "user",
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const conversation = nextSeed.conversations.find(item => item.id === conversationId)
  if (!conversation)
    return { message: null, seed: nextSeed }

  const message: Message = {
    id: nextId(ids.messageId),
    conversationId,
    senderUserId,
    type,
    body,
    attachments,
    createdAt,
  }

  nextSeed.messages = sortByCreatedAtDesc([message, ...nextSeed.messages]).reverse()
  conversation.lastMessageAt = createdAt

  if (senderUserId)
    touchProfileActivity(nextSeed, senderUserId, createdAt)

  conversation.participantIds.forEach((participantId) => {
    if (participantId !== senderUserId)
      conversation.unreadCountByUser[participantId] = (conversation.unreadCountByUser[participantId] || 0) + 1
  })

  return {
    message,
    seed: nextSeed,
  }
}

export function markConversationReadTransition(seed: WorkspaceSeed, conversationId: string, userId: string) {
  const nextSeed = cloneValue(seed)
  const conversation = nextSeed.conversations.find(item => item.id === conversationId)
  if (!conversation || !isConversationParticipant(conversation, userId))
    return nextSeed

  conversation.unreadCountByUser[userId] = 0
  return nextSeed
}

export function createProposalTransition(
  seed: WorkspaceSeed,
  creatorUserId: string,
  recipientUserId: string,
  conversationId: string,
  opportunityId: string | null,
  title: string,
  payload: ProposalPayload,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const proposalId = nextId(ids.proposalId)
  const versionId = nextId(ids.proposalVersionId)
  const proposal: Proposal = {
    id: proposalId,
    conversationId,
    opportunityId,
    createdByUserId: creatorUserId,
    recipientUserId,
    title,
    currentVersionId: versionId,
    status: "sent",
    createdAt,
    updatedAt: createdAt,
  }
  const version: ProposalVersion = {
    id: versionId,
    proposalId,
    versionNumber: 1,
    createdByUserId: creatorUserId,
    createdAt,
    summary: `${payload.roleTitle} proposal sent`,
    ...payload,
  }

  nextSeed.proposals = [proposal, ...nextSeed.proposals]
  nextSeed.proposalVersions = [version, ...nextSeed.proposalVersions]
  touchProfileActivity(nextSeed, creatorUserId, createdAt)

  const withSystemMessage = sendMessageTransition(nextSeed, conversationId, null, "A collaboration proposal was sent.", [], createdAt, "system", ids)
  createNotification(withSystemMessage.seed, recipientUserId, "proposal", "New proposal received", title, `/app/proposals/${proposalId}`, createdAt, ids.proposalNotificationId)

  return {
    proposalId,
    proposal,
    seed: withSystemMessage.seed,
    version,
  }
}

export function updateProposalStatusTransition(
  seed: WorkspaceSeed,
  proposalId: string,
  status: ProposalStatus,
  actorUserId: string,
  updatedAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const proposal = getProposalById(nextSeed, proposalId)
  if (!proposal)
    return nextSeed

  proposal.status = status
  proposal.updatedAt = updatedAt

  const withSystemMessage = sendMessageTransition(
    nextSeed,
    proposal.conversationId,
    null,
    `Proposal status changed to ${status.replaceAll("_", " ")}.`,
    [],
    updatedAt,
    "system",
    ids,
  )

  const counterpartyId = proposal.createdByUserId === actorUserId
    ? proposal.recipientUserId
    : proposal.createdByUserId
  createNotification(
    withSystemMessage.seed,
    counterpartyId,
    "proposal",
    "Proposal updated",
    `${proposal.title} is now ${status.replaceAll("_", " ")}.`,
    `/app/proposals/${proposalId}`,
    updatedAt,
    ids.proposalNotificationId,
  )

  return withSystemMessage.seed
}

export function createProposalCounterVersionTransition(
  seed: WorkspaceSeed,
  proposalId: string,
  createdByUserId: string,
  payload: ProposalPayload,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const proposal = getProposalById(nextSeed, proposalId)
  const currentVersion = proposal && getCurrentProposalVersion(nextSeed, proposal)
  if (!proposal || !currentVersion)
    return { proposalId: null, seed: nextSeed, version: null }

  const version: ProposalVersion = {
    id: nextId(ids.proposalVersionId),
    proposalId,
    versionNumber: currentVersion.versionNumber + 1,
    createdByUserId,
    createdAt,
    summary: `${payload.roleTitle} counter version`,
    ...payload,
  }

  nextSeed.proposalVersions = [version, ...nextSeed.proposalVersions]
  proposal.currentVersionId = version.id
  proposal.status = "countered"
  proposal.updatedAt = createdAt
  touchProfileActivity(nextSeed, createdByUserId, createdAt)

  return {
    proposalId,
    seed: sendMessageTransition(nextSeed, proposal.conversationId, null, `Proposal updated to version ${version.versionNumber}.`, [], createdAt, "system", ids).seed,
    version,
  }
}

export function addProposalCommentTransition(
  seed: WorkspaceSeed,
  proposalId: string,
  proposalVersionId: string,
  authorUserId: string,
  section: ProposalSectionKey,
  body: string,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const proposal = getProposalById(nextSeed, proposalId)
  if (!proposal)
    return { comment: null, seed: nextSeed }

  const comment: ProposalComment = {
    id: nextId(ids.proposalCommentId),
    proposalId,
    proposalVersionId,
    authorUserId,
    section,
    body,
    createdAt,
  }

  nextSeed.proposalComments = [comment, ...nextSeed.proposalComments]
  const counterpartyId = proposal.createdByUserId === authorUserId
    ? proposal.recipientUserId
    : proposal.createdByUserId
  createNotification(nextSeed, counterpartyId, "proposal", "Proposal comment added", body, `/app/proposals/${proposalId}`, createdAt, ids.proposalNotificationId)

  return {
    comment,
    seed: nextSeed,
  }
}

export function createContractFromProposalTransition(
  seed: WorkspaceSeed,
  proposalId: string,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const proposal = getProposalById(nextSeed, proposalId)
  if (!proposal)
    return { contractId: null, seed: nextSeed }

  const existingContract = nextSeed.contracts.find(contract => contract.proposalId === proposalId)
  if (existingContract)
    return { contractId: existingContract.id, seed: nextSeed }

  const version = getCurrentProposalVersion(nextSeed, proposal)
  const participants = [proposal.createdByUserId, proposal.recipientUserId]
    .map(userId => getProfileByUserId(nextSeed, userId))
    .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))

  if (!version || participants.length !== 2)
    return { contractId: null, seed: nextSeed }

  const contractId = nextId(ids.contractId)
  const contractVersion = buildContractVersionFromProposal(version, participants, contractId, 1)
  const contract: Contract = {
    id: contractId,
    proposalId,
    title: `${proposal.title.replace("Proposal", "Agreement")}`,
    status: "pending_signature",
    currentVersionId: contractVersion.id,
    disclaimerAcknowledged: true,
    createdAt,
    updatedAt: createdAt,
  }

  nextSeed.contracts = [contract, ...nextSeed.contracts]
  nextSeed.contractVersions = [
    { ...contractVersion, createdAt },
    ...nextSeed.contractVersions
  ]
  createNotification(
    nextSeed,
    proposal.recipientUserId,
    "contract",
    "Contract draft ready",
    "A contract draft was generated from your proposal.",
    `/app/contracts/${contractId}`,
    createdAt,
    ids.contractNotificationId,
  )

  return {
    contract,
    contractId,
    seed: nextSeed,
  }
}

export function createContractVersionTransition(
  seed: WorkspaceSeed,
  contractId: string,
  actorUserId: string,
  payload: ContractVersionPayload,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const contract = getContractById(nextSeed, contractId)
  const currentVersion = contract && getCurrentContractVersion(nextSeed, contract)
  if (!contract || !currentVersion)
    return { seed: nextSeed, version: null }

  const version: ContractVersion = {
    ...currentVersion,
    ...payload,
    id: nextId(ids.contractVersionId),
    versionNumber: currentVersion.versionNumber + 1,
    createdAt,
  }

  nextSeed.contractVersions = [version, ...nextSeed.contractVersions]
  contract.currentVersionId = version.id
  contract.status = "pending_signature"
  contract.updatedAt = createdAt
  touchProfileActivity(nextSeed, actorUserId, createdAt)

  const proposal = getProposalById(nextSeed, contract.proposalId)
  if (!proposal)
    return { seed: nextSeed, version }

  const counterpartyId = proposal.createdByUserId === actorUserId
    ? proposal.recipientUserId
    : proposal.createdByUserId
  createNotification(
    nextSeed,
    counterpartyId,
    "contract",
    "Agreement revision ready",
    `${contract.title} is now version ${version.versionNumber}. Review the redline before signing.`,
    `/app/contracts/${contract.id}`,
    createdAt,
    ids.contractNotificationId,
  )

  const withSystemMessage = sendMessageTransition(
    nextSeed,
    proposal.conversationId,
    null,
    `Agreement updated to version ${version.versionNumber}. Existing signatures and legal reviews apply only to their original versions.`,
    [],
    createdAt,
    "system",
    ids,
  )

  return {
    seed: withSystemMessage.seed,
    version,
  }
}

export function signContractTransition(
  seed: WorkspaceSeed,
  contractId: string,
  userId: string,
  typedName: string,
  signedAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const contract = getContractById(nextSeed, contractId)
  const currentVersion = contract && getCurrentContractVersion(nextSeed, contract)
  if (!contract || !currentVersion)
    return nextSeed

  const existingSignature = nextSeed.signatures.find(signature =>
    signature.contractId === contractId
    && signature.userId === userId
    && signature.contractVersionId === currentVersion.id,
  )
  if (existingSignature)
    return nextSeed

  nextSeed.signatures = [
    {
      id: nextId(ids.signatureId),
      contractId,
      contractVersionId: currentVersion.id,
      userId,
      typedName,
      signedAt,
    },
    ...nextSeed.signatures,
  ]
  touchProfileActivity(nextSeed, userId, signedAt)

  const participantIds = getContractParticipantIds(nextSeed, contract)
  const versionSignatures = nextSeed.signatures.filter(signature =>
    signature.contractId === contractId && signature.contractVersionId === currentVersion.id,
  )

  if (participantIds.length && participantIds.every(participantId => versionSignatures.some(signature => signature.userId === participantId)))
    contract.status = "signed"

  return nextSeed
}

export function startTrialCollaborationTransition(
  seed: WorkspaceSeed,
  matchId: string,
  createdByUserId: string,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const existingTrial = nextSeed.trialCollaborations.find(trial => trial.matchId === matchId)
  if (existingTrial)
    return { seed: nextSeed, trialId: existingTrial.id }

  const match = nextSeed.matches.find(item => item.id === matchId)
  if (!match)
    return { seed: nextSeed, trialId: null }

  const profiles = match.participantIds
    .map(participantId => getProfileByUserId(nextSeed, participantId))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
  const trial = buildTrialDraft(match, profiles, createdByUserId)
  trial.id = nextId(ids.trialId)
  trial.status = "active"
  trial.createdAt = createdAt
  trial.updatedAt = createdAt
  nextSeed.trialCollaborations = [trial, ...nextSeed.trialCollaborations]
  touchProfileActivity(nextSeed, createdByUserId, createdAt)

  const counterpartyId = match.participantIds.find(participantId => participantId !== createdByUserId)
  if (counterpartyId) {
    createNotification(nextSeed, counterpartyId, "match", "Trial collaboration started", trial.title, "/app/matches", createdAt, ids.trialNotificationId)
  }

  const withSystemMessage = sendMessageTransition(nextSeed, match.conversationId, null, `A trial collaboration was started: ${trial.title}.`, [], createdAt, "system", ids)

  return {
    seed: withSystemMessage.seed,
    trialId: trial.id,
  }
}

export function acknowledgeTrialCollaborationTransition(seed: WorkspaceSeed, trialId: string, userId: string, updatedAt: string) {
  const nextSeed = cloneValue(seed)
  const trial = nextSeed.trialCollaborations.find(item => item.id === trialId)
  if (!trial)
    return nextSeed

  if (!trial.acknowledgedByUserIds.includes(userId))
    trial.acknowledgedByUserIds.push(userId)

  trial.updatedAt = updatedAt
  touchProfileActivity(nextSeed, userId, updatedAt)
  return nextSeed
}

export function addRelationshipDecisionTransition(
  seed: WorkspaceSeed,
  matchId: string,
  authorUserId: string,
  title: string,
  body: string,
  status: RelationshipDecisionRecordStatus,
  createdAt: string,
  ids: IdOverrides = {},
) {
  const nextSeed = cloneValue(seed)
  const match = nextSeed.matches.find(item => item.id === matchId)
  if (!match || !match.participantIds.includes(authorUserId))
    return { decision: null, seed: nextSeed }

  const decision: RelationshipDecision = {
    id: nextId(ids.relationshipDecisionId),
    matchId,
    authorUserId,
    title,
    body,
    status,
    createdAt,
    updatedAt: createdAt,
  }

  nextSeed.relationshipDecisions = [decision, ...nextSeed.relationshipDecisions]
  touchProfileActivity(nextSeed, authorUserId, createdAt)

  const counterpartyId = match.participantIds.find(participantId => participantId !== authorUserId)
  if (counterpartyId) {
    createNotification(
      nextSeed,
      counterpartyId,
      "match",
      "Relationship decision recorded",
      `${title}: ${body}`,
      `/app/relationships/${matchId}`,
      createdAt,
      ids.relationshipDecisionNotificationId,
    )
  }

  return {
    decision,
    seed: nextSeed,
  }
}

export function markNotificationReadTransition(seed: WorkspaceSeed, notificationId: string, userId: string, readAt: string) {
  const nextSeed = cloneValue(seed)
  const notification = nextSeed.notifications.find(item => item.id === notificationId)
  if (!notification || !isNotificationOwnedByUser(notification, userId))
    return { changed: false, seed: nextSeed }

  if (!notification.readAt)
    notification.readAt = readAt

  nextSeed.notifications = sortByCreatedAtDesc(nextSeed.notifications)
  return {
    changed: true,
    seed: nextSeed,
  }
}
