import type { H3Event } from "h3"
import type {
  ConnectDeclineReason,
  ConnectRequestPayload,
  ContractVersionPayload,
  ProposalPayload,
  ProposalSectionKey,
  RelationshipDecisionRecordStatus,
  SessionUser,
  Signature,
} from "../../shared/types/domain"
import type { SubscriptionGateAction } from "../../shared/utils/billing"
import type { LifecycleNotificationRequest } from "../../shared/utils/lifecycle-notifications"
import { createError } from "h3"
import { checkSubscriptionGate, hasPaidContractWorkflowSponsor } from "../../shared/utils/billing"
import {
  acknowledgeTrialCollaborationTransition,
  addProposalCommentTransition,
  addRelationshipDecisionTransition,
  canUserCounterProposal,
  canUserRespondToConnectRequest,
  canUserUpdateProposalStatus,
  createConnectRequestTransition,
  createContractFromProposalTransition,
  createContractVersionTransition,
  createProposalCounterVersionTransition,
  createProposalTransition,
  isContractParticipant,
  isConversationParticipant,
  isNotificationOwnedByUser,
  isProposalParticipant,
  isRelationshipParticipant,
  markConversationReadTransition,
  markNotificationReadTransition,
  respondToConnectRequestTransition,
  sendMessageTransition,
  signContractTransition,
  startTrialCollaborationTransition,
  updateProposalStatusTransition,
} from "../../shared/utils/collaboration"
import { buildProfileReadiness } from "../../shared/utils/formation"
import { hasBlockingContractLegalReview } from "../../shared/utils/legal-reviews"
import { getContractById, getCurrentContractVersion, getCurrentProposalVersion, getProfileByUserId, getProposalById, getSubscriptionByUserId } from "../../shared/utils/workspace"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"
import { listContractLegalReviews, supersedeContractLegalReviews } from "./contract-legal-reviews"
import { buildContractSignatureEvent } from "./contract-signatures"
import { emitLifecycleNotificationEvents } from "./lifecycle-notification-events"
import { persistServerCollaborationState } from "./member-collaboration"
import { loadMemberWorkspaceState } from "./member-workspace"
import { loadContractOrganizationGovernance } from "./organization-workspaces"
import { emitWorkspaceRealtimeChange } from "./workspace-realtime"

export type CollaborationMutationPayload
  = | { action: "send_connect_request", payload: ConnectRequestPayload, toUserId: string }
    | { action: "respond_connect_request", declineReason?: ConnectDeclineReason | null, requestId: string, status: "accepted" | "declined" }
    | { action: "send_message", attachments?: never[], body: string, conversationId: string }
    | { action: "mark_conversation_read", conversationId: string }
    | { action: "create_proposal", conversationId: string, opportunityId: string | null, payload: ProposalPayload, recipientUserId: string, title: string }
    | { action: "update_proposal_status", proposalId: string, status: "accepted" | "rejected" | "viewed" }
    | { action: "create_proposal_counter_version", payload: ProposalPayload, proposalId: string }
    | { action: "add_proposal_comment", body: string, proposalId: string, proposalVersionId: string, section: ProposalSectionKey }
    | { action: "create_contract_from_proposal", proposalId: string }
    | { action: "update_contract_version", contractId: string, payload: ContractVersionPayload }
    | { action: "sign_contract", contractId: string, typedName: string }
    | { action: "start_trial", matchId: string }
    | { action: "acknowledge_trial", trialId: string }
    | { action: "add_relationship_decision", body: string, matchId: string, status: RelationshipDecisionRecordStatus, title: string }

function buildIdentity(session: SessionUser) {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

async function persistForUsers(
  event: H3Event,
  userIds: string[],
  seed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"],
  expectedSeed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"],
  signatureEvents: ReturnType<typeof buildContractSignatureEvent>[] = [],
) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  await persistServerCollaborationState(event, uniqueIds, seed, { expectedSeed, signatureEvents })
}

function assertSubscriptionGate(seed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"], userId: string, action: SubscriptionGateAction) {
  const gate = checkSubscriptionGate(seed, userId, getSubscriptionByUserId(seed, userId), action)

  if (!gate.allowed) {
    throw createError({
      statusCode: 402,
      statusMessage: gate.reason || "Your plan does not allow this action.",
    })
  }
}

interface CollaborationMutationContext {
  event: H3Event
  session: SessionUser
  workspace: Awaited<ReturnType<typeof loadMemberWorkspaceState>>
  actedAt: string
  nextSeed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"]
  result: Record<string, string | null>
  affectedUsers: string[]
  lifecycleNotifications: LifecycleNotificationRequest[]
  signatureEvent: { signature: Signature, typedName: string } | null
}

function applySendConnectRequest(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "send_connect_request" }>) {
  const { session, workspace, actedAt } = context
  if (payload.toUserId === session.id)
    throw createError({ statusCode: 400, statusMessage: "You cannot send a connect request to yourself." })

  const senderProfile = getProfileByUserId(context.nextSeed, session.id)
  if (!senderProfile || !buildProfileReadiness(senderProfile).readyForOutreach)
    throw createError({ statusCode: 403, statusMessage: "Complete the required trust and intent profile fields before sending an intro." })

  const visibleWorkspace = projectWorkspaceForSession(context.nextSeed, workspace.session)
  const targetProfile = getProfileByUserId(visibleWorkspace, payload.toUserId)
  const targetUser = visibleWorkspace.users.find(user => user.id === payload.toUserId)
  if (!targetProfile || !targetUser || targetUser.suspendedAt)
    throw createError({ statusCode: 404, statusMessage: "The requested member is not available for introductions." })

  const duplicateRequest = context.nextSeed.connectRequests.some(request =>
    request.status === "pending"
    && request.fromUserId === session.id
    && request.toUserId === payload.toUserId,
  )
  if (duplicateRequest)
    throw createError({ statusCode: 409, statusMessage: "A pending intro already exists for this member." })

  assertSubscriptionGate(context.nextSeed, session.id, "send_intro")
  const transition = createConnectRequestTransition(context.nextSeed, session.id, payload.toUserId, payload.payload, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [session.id, payload.toUserId]
  context.result = { requestId: transition.request.id }
  context.lifecycleNotifications.push({
    eventType: "intro.received",
    metadata: {
      actorUserId: session.id,
      action: payload.action,
    },
    targetId: transition.request.id,
    targetType: "connect_request",
    userId: payload.toUserId,
  })
}

function applyRespondConnectRequest(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "respond_connect_request" }>) {
  const { session, actedAt } = context
  const request = context.nextSeed.connectRequests.find(item => item.id === payload.requestId)
  if (!request)
    throw createError({ statusCode: 404, statusMessage: "Connect request not found." })
  if (!canUserRespondToConnectRequest(request, session.id))
    throw createError({ statusCode: 403, statusMessage: "Only the targeted recipient can respond to this intro." })

  const transition = respondToConnectRequestTransition(context.nextSeed, payload.requestId, payload.status, actedAt, payload.declineReason || null)
  context.nextSeed = transition.seed
  context.affectedUsers = [session.id, request.fromUserId]
  context.result = { conversationId: transition.conversationId }
  if (payload.status === "accepted" && transition.match) {
    context.lifecycleNotifications.push({
      eventType: "intro.accepted",
      metadata: {
        actorUserId: session.id,
        matchId: transition.match.id,
      },
      targetId: request.id,
      targetType: "connect_request",
      userId: request.fromUserId,
    })
  }
}

function applySendMessage(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "send_message" }>) {
  const { session, actedAt } = context
  const conversation = context.nextSeed.conversations.find(item => item.id === payload.conversationId)
  if (!conversation)
    throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
  if (!isConversationParticipant(conversation, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this conversation." })

  const transition = sendMessageTransition(context.nextSeed, payload.conversationId, session.id, payload.body, [], actedAt, "user")
  context.nextSeed = transition.seed
  context.affectedUsers = [...conversation.participantIds]
  context.result = { messageId: transition.message?.id || null }
  if (transition.message) {
    conversation.participantIds
      .filter(userId => userId !== session.id)
      .forEach((userId) => {
        context.lifecycleNotifications.push({
          eventType: "message.unread",
          metadata: {
            actorUserId: session.id,
            conversationId: payload.conversationId,
          },
          targetId: transition.message!.id,
          targetType: "message",
          userId,
        })
      })
  }
}

function applyMarkConversationRead(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "mark_conversation_read" }>) {
  const { session } = context
  const conversation = context.nextSeed.conversations.find(item => item.id === payload.conversationId)
  if (!conversation)
    throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
  if (!isConversationParticipant(conversation, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this conversation." })

  context.nextSeed = markConversationReadTransition(context.nextSeed, payload.conversationId, session.id)
  context.result = { conversationId: payload.conversationId }
}

function applyCreateProposal(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "create_proposal" }>) {
  const { session, actedAt } = context
  const conversation = context.nextSeed.conversations.find(item => item.id === payload.conversationId)
  if (!conversation)
    throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
  if (!isConversationParticipant(conversation, session.id) || !conversation.participantIds.includes(payload.recipientUserId))
    throw createError({ statusCode: 403, statusMessage: "Proposal participants must match the conversation." })
  if (payload.recipientUserId === session.id)
    throw createError({ statusCode: 400, statusMessage: "A proposal recipient must be the other conversation participant." })
  if (context.nextSeed.proposals.some(proposal =>
    proposal.conversationId === payload.conversationId && !["accepted", "rejected"].includes(proposal.status),
  )) {
    throw createError({ statusCode: 409, statusMessage: "This conversation already has an active proposal." })
  }
  if (payload.opportunityId) {
    const opportunity = context.nextSeed.opportunities.find(item => item.id === payload.opportunityId)
    if (!opportunity || !conversation.participantIds.includes(opportunity.ownerUserId))
      throw createError({ statusCode: 400, statusMessage: "The proposal opportunity must belong to a conversation participant." })
  }

  assertSubscriptionGate(context.nextSeed, session.id, "create_proposal")
  const transition = createProposalTransition(context.nextSeed, session.id, payload.recipientUserId, payload.conversationId, payload.opportunityId, payload.title, payload.payload, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [...conversation.participantIds]
  context.result = { proposalId: transition.proposalId }
  context.lifecycleNotifications.push({
    eventType: "proposal.received",
    metadata: {
      actorUserId: session.id,
      action: payload.action,
      conversationId: payload.conversationId,
    },
    targetId: transition.proposalId,
    targetType: "proposal",
    userId: payload.recipientUserId,
  })
}

function applyUpdateProposalStatus(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "update_proposal_status" }>) {
  const { session, actedAt } = context
  const proposal = getProposalById(context.nextSeed, payload.proposalId)
  if (!proposal)
    throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
  if (!isProposalParticipant(proposal, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })
  if (!canUserUpdateProposalStatus(context.nextSeed, proposal, session.id, payload.status))
    throw createError({ statusCode: 409, statusMessage: "Only the counterparty to the active proposal version can make this status change." })

  context.nextSeed = updateProposalStatusTransition(context.nextSeed, payload.proposalId, payload.status, session.id, actedAt)
  context.affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
  context.result = { proposalId: proposal.id }
  context.lifecycleNotifications.push({
    eventType: "proposal.updated",
    metadata: {
      actorUserId: session.id,
      action: payload.action,
      status: payload.status,
    },
    targetId: proposal.id,
    targetType: "proposal",
    userId: proposal.createdByUserId === session.id
      ? proposal.recipientUserId
      : proposal.createdByUserId,
  })
}

function applyCreateProposalCounterVersion(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "create_proposal_counter_version" }>) {
  const { session, actedAt } = context
  const proposal = getProposalById(context.nextSeed, payload.proposalId)
  if (!proposal)
    throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
  if (!isProposalParticipant(proposal, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })
  if (!canUserCounterProposal(context.nextSeed, proposal, session.id))
    throw createError({ statusCode: 409, statusMessage: "Only the counterparty to the active proposal version can counter it." })

  assertSubscriptionGate(context.nextSeed, session.id, "create_proposal")
  const transition = createProposalCounterVersionTransition(context.nextSeed, payload.proposalId, session.id, payload.payload, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
  context.result = { proposalId: proposal.id, proposalVersionId: transition.version?.id || null }
  context.lifecycleNotifications.push({
    eventType: "proposal.updated",
    metadata: {
      actorUserId: session.id,
      action: payload.action,
      proposalVersionId: transition.version?.id || null,
    },
    targetId: proposal.id,
    targetType: "proposal",
    userId: proposal.createdByUserId === session.id
      ? proposal.recipientUserId
      : proposal.createdByUserId,
  })
}

function applyAddProposalComment(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "add_proposal_comment" }>) {
  const { session, actedAt } = context
  const proposal = getProposalById(context.nextSeed, payload.proposalId)
  if (!proposal)
    throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
  if (!isProposalParticipant(proposal, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })
  if (["accepted", "rejected"].includes(proposal.status))
    throw createError({ statusCode: 409, statusMessage: "Comments cannot be added after a proposal is accepted or rejected." })

  const currentVersion = getCurrentProposalVersion(context.nextSeed, proposal)
  if (!currentVersion || currentVersion.id !== payload.proposalVersionId)
    throw createError({ statusCode: 400, statusMessage: "Comments must target the active proposal version." })

  const transition = addProposalCommentTransition(context.nextSeed, payload.proposalId, payload.proposalVersionId, session.id, payload.section, payload.body, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
  context.result = { commentId: transition.comment?.id || null }
  context.lifecycleNotifications.push({
    eventType: "proposal.updated",
    metadata: {
      actorUserId: session.id,
      action: payload.action,
      proposalCommentId: transition.comment?.id || null,
      proposalSection: payload.section,
    },
    targetId: proposal.id,
    targetType: "proposal",
    userId: proposal.createdByUserId === session.id
      ? proposal.recipientUserId
      : proposal.createdByUserId,
  })
}

function applyCreateContractFromProposal(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "create_contract_from_proposal" }>) {
  const { session, actedAt } = context
  const proposal = getProposalById(context.nextSeed, payload.proposalId)
  if (!proposal)
    throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
  if (!isProposalParticipant(proposal, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })
  if (proposal.status !== "accepted")
    throw createError({ statusCode: 409, statusMessage: "A contract can only be generated from an accepted proposal." })

  assertSubscriptionGate(context.nextSeed, session.id, "create_contract")
  const transition = createContractFromProposalTransition(context.nextSeed, payload.proposalId, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
  context.result = { contractId: transition.contractId }
  if (transition.contractId) {
    context.affectedUsers.forEach((userId) => {
      context.lifecycleNotifications.push({
        eventType: "contract.signature_required",
        metadata: {
          actorUserId: session.id,
          action: payload.action,
          proposalId: proposal.id,
        },
        targetId: transition.contractId!,
        targetType: "contract",
        userId,
      })
    })
  }
}

function applyUpdateContractVersion(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "update_contract_version" }>) {
  const { session, actedAt } = context
  const contract = getContractById(context.nextSeed, payload.contractId)
  if (!contract)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })
  if (!isContractParticipant(context.nextSeed, contract, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

  if (!hasPaidContractWorkflowSponsor(context.nextSeed, contract)) {
    throw createError({
      statusCode: 402,
      statusMessage: "Agreement revisions require an active Pro or Team sponsor among the participants.",
    })
  }
  const transition = createContractVersionTransition(context.nextSeed, contract.id, session.id, payload.payload, actedAt)
  if (!transition.version)
    throw createError({ statusCode: 409, statusMessage: "The current agreement version is unavailable." })

  context.nextSeed = transition.seed
  const proposal = getProposalById(context.nextSeed, contract.proposalId)
  context.affectedUsers = proposal
    ? [proposal.createdByUserId, proposal.recipientUserId]
    : [session.id]
  context.result = { contractId: contract.id, contractVersionId: transition.version.id }
  context.affectedUsers.forEach((userId) => {
    context.lifecycleNotifications.push({
      eventType: "contract.signature_required",
      metadata: {
        actorUserId: session.id,
        action: payload.action,
        contractVersionId: transition.version!.id,
      },
      targetId: contract.id,
      targetType: "contract",
      userId,
    })
  })
}

async function applySignContract(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "sign_contract" }>) {
  const { session, event, actedAt } = context
  const contract = getContractById(context.nextSeed, payload.contractId)
  if (!contract)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })
  if (!isContractParticipant(context.nextSeed, contract, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })
  if (contract.status !== "pending_signature")
    throw createError({ statusCode: 409, statusMessage: "This contract is not awaiting signatures." })
  if (context.nextSeed.signatures.some(signature =>
    signature.contractId === contract.id
    && signature.contractVersionId === contract.currentVersionId
    && signature.userId === session.id,
  )) {
    throw createError({ statusCode: 409, statusMessage: "You have already signed the current contract version." })
  }

  const currentVersion = getCurrentContractVersion(context.nextSeed, contract)
  const legalReviews = await listContractLegalReviews(event, contract.id)
  if (currentVersion && hasBlockingContractLegalReview(legalReviews, currentVersion.id)) {
    throw createError({
      statusCode: 409,
      statusMessage: "Signing is paused while the current agreement version has an active legal review. Complete or cancel that review first.",
    })
  }
  if (currentVersion) {
    const organizationRequirements = await loadContractOrganizationGovernance(event, contract.id, currentVersion.id, legalReviews)
    const blockers = organizationRequirements.flatMap(requirement => requirement.blockers)
    if (blockers.length) {
      throw createError({
        statusCode: 409,
        statusMessage: `Signing is paused by an organization agreement policy. ${blockers[0]}`,
      })
    }
  }

  if (!hasPaidContractWorkflowSponsor(context.nextSeed, contract)) {
    throw createError({
      statusCode: 402,
      statusMessage: "Agreement signing requires an active Pro or Team sponsor among the participants.",
    })
  }
  const existingSignatureIds = new Set(context.nextSeed.signatures.map(signature => signature.id))
  context.nextSeed = signContractTransition(context.nextSeed, payload.contractId, session.id, payload.typedName, actedAt)
  const newSignature = context.nextSeed.signatures.find(signature => !existingSignatureIds.has(signature.id))
  if (newSignature)
    context.signatureEvent = { signature: newSignature, typedName: payload.typedName }
  const proposal = getProposalById(context.nextSeed, contract.proposalId)
  context.affectedUsers = proposal
    ? [proposal.createdByUserId, proposal.recipientUserId]
    : [session.id]
  context.result = { contractId: contract.id }
  context.affectedUsers
    .filter(userId => userId !== session.id)
    .forEach((userId) => {
      context.lifecycleNotifications.push({
        eventType: "contract.signature_required",
        metadata: {
          actorUserId: session.id,
          action: payload.action,
        },
        targetId: contract.id,
        targetType: "contract",
        userId,
      })
    })
}

function applyStartTrial(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "start_trial" }>) {
  const { session, actedAt } = context
  const match = context.nextSeed.matches.find(item => item.id === payload.matchId)
  if (!match)
    throw createError({ statusCode: 404, statusMessage: "Match not found." })
  if (!match.participantIds.includes(session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this match." })

  const transition = startTrialCollaborationTransition(context.nextSeed, payload.matchId, session.id, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [...match.participantIds]
  context.result = { trialId: transition.trialId }
}

function applyAcknowledgeTrial(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "acknowledge_trial" }>) {
  const { session, actedAt } = context
  const trial = context.nextSeed.trialCollaborations.find(item => item.id === payload.trialId)
  if (!trial)
    throw createError({ statusCode: 404, statusMessage: "Trial collaboration not found." })

  const match = context.nextSeed.matches.find(item => item.id === trial.matchId)
  if (!match || !match.participantIds.includes(session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this trial collaboration." })

  context.nextSeed = acknowledgeTrialCollaborationTransition(context.nextSeed, payload.trialId, session.id, actedAt)
  context.affectedUsers = [...match.participantIds]
  context.result = { trialId: trial.id }
}

function applyAddRelationshipDecision(context: CollaborationMutationContext, payload: Extract<CollaborationMutationPayload, { action: "add_relationship_decision" }>) {
  const { session, actedAt } = context
  if (!isRelationshipParticipant(context.nextSeed, payload.matchId, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this relationship." })

  const title = payload.title.trim()
  const body = payload.body.trim()
  if (title.length < 4 || body.length < 12)
    throw createError({ statusCode: 400, statusMessage: "Add a clear title and enough detail for the decision log." })

  const match = context.nextSeed.matches.find(item => item.id === payload.matchId)!
  const transition = addRelationshipDecisionTransition(context.nextSeed, payload.matchId, session.id, title, body, payload.status, actedAt)
  context.nextSeed = transition.seed
  context.affectedUsers = [...match.participantIds]
  context.result = { relationshipDecisionId: transition.decision?.id || null }
}

export async function applyCollaborationMutation(event: H3Event, session: SessionUser, payload: CollaborationMutationPayload) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const actedAt = new Date().toISOString()
  const context: CollaborationMutationContext = {
    event,
    session,
    workspace,
    actedAt,
    nextSeed: workspace.seed,
    result: {},
    affectedUsers: [session.id],
    lifecycleNotifications: [],
    signatureEvent: null,
  }

  switch (payload.action) {
    case "send_connect_request":
      applySendConnectRequest(context, payload)
      break

    case "respond_connect_request":
      applyRespondConnectRequest(context, payload)
      break

    case "send_message":
      applySendMessage(context, payload)
      break

    case "mark_conversation_read":
      applyMarkConversationRead(context, payload)
      break

    case "create_proposal":
      applyCreateProposal(context, payload)
      break

    case "update_proposal_status":
      applyUpdateProposalStatus(context, payload)
      break

    case "create_proposal_counter_version":
      applyCreateProposalCounterVersion(context, payload)
      break

    case "add_proposal_comment":
      applyAddProposalComment(context, payload)
      break

    case "create_contract_from_proposal":
      applyCreateContractFromProposal(context, payload)
      break

    case "update_contract_version":
      applyUpdateContractVersion(context, payload)
      break

    case "sign_contract":
      await applySignContract(context, payload)
      break

    case "start_trial":
      applyStartTrial(context, payload)
      break

    case "acknowledge_trial":
      applyAcknowledgeTrial(context, payload)
      break

    case "add_relationship_decision":
      applyAddRelationshipDecision(context, payload)
      break
  }

  const { nextSeed, result, affectedUsers, lifecycleNotifications, signatureEvent } = context

  const signatureEvents = signatureEvent
    ? [
        buildContractSignatureEvent(event, signatureEvent.signature, signatureEvent.typedName)
      ]
    : []
  await persistForUsers(event, affectedUsers, nextSeed, workspace.seed, signatureEvents)
  if (payload.action === "update_contract_version" && result.contractVersionId) {
    await supersedeContractLegalReviews(event, payload.contractId, result.contractVersionId, actedAt)
      .catch(error => console.warn("[contract-legal-review] Superseding prior reviews failed.", error))
  }
  await emitWorkspaceRealtimeChange(affectedUsers, {
    metadata: {
      action: payload.action,
    },
    source: "workspace.collaboration",
  })
  if (lifecycleNotifications.length) {
    await emitLifecycleNotificationEvents(event, nextSeed, lifecycleNotifications, {
      source: "workspace.collaboration",
    })
  }

  return {
    data: projectWorkspaceForSession(nextSeed, workspace.session),
    result,
    session: workspace.session,
  }
}

export async function markInboxNotificationRead(event: H3Event, session: SessionUser, notificationId: string) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const notification = workspace.seed.notifications.find(item => item.id === notificationId)

  if (!notification)
    throw createError({ statusCode: 404, statusMessage: "Notification not found." })

  if (!isNotificationOwnedByUser(notification, session.id))
    throw createError({ statusCode: 403, statusMessage: "You can only mark your own notifications as read." })

  const transition = markNotificationReadTransition(workspace.seed, notificationId, session.id, new Date().toISOString())
  await persistServerCollaborationState(event, session.id, transition.seed, {
    expectedSeed: workspace.seed,
  })
  await emitWorkspaceRealtimeChange([session.id], {
    metadata: {
      action: "mark_notification_read",
      notificationId,
    },
    source: "workspace.inbox",
  })

  return {
    data: projectWorkspaceForSession(transition.seed, workspace.session),
    session: workspace.session,
  }
}
