import type { H3Event } from "h3"
import type {
  ConnectDeclineReason,
  ConnectRequestPayload,
  ConnectRequestStatus,
  MessageAttachment,
  ProposalPayload,
  ProposalSectionKey,
  ProposalStatus,
  SessionUser,
} from "~/shared/types/domain"
import {
  acknowledgeTrialCollaborationTransition,
  addProposalCommentTransition,
  canUserRespondToConnectRequest,
  createConnectRequestTransition,
  createContractFromProposalTransition,
  createProposalCounterVersionTransition,
  createProposalTransition,
  isContractParticipant,
  isConversationParticipant,
  isNotificationOwnedByUser,
  isProposalParticipant,
  markConversationReadTransition,
  markNotificationReadTransition,
  respondToConnectRequestTransition,
  sendMessageTransition,
  signContractTransition,
  startTrialCollaborationTransition,
  updateProposalStatusTransition,
} from "~/shared/utils/collaboration"
import { getContractById, getCurrentProposalVersion, getProposalById } from "~/shared/utils/workspace"
import { persistServerCollaborationState } from "./member-collaboration"
import { loadMemberWorkspaceState } from "./member-workspace"

export type CollaborationMutationPayload
  = | { action: "send_connect_request", payload: ConnectRequestPayload, toUserId: string }
    | { action: "respond_connect_request", declineReason?: ConnectDeclineReason | null, requestId: string, status: ConnectRequestStatus }
    | { action: "send_message", attachments?: MessageAttachment[], body: string, conversationId: string, type?: "system" | "user" }
    | { action: "mark_conversation_read", conversationId: string }
    | { action: "create_proposal", conversationId: string, opportunityId: string | null, payload: ProposalPayload, recipientUserId: string, title: string }
    | { action: "update_proposal_status", proposalId: string, status: ProposalStatus }
    | { action: "create_proposal_counter_version", payload: ProposalPayload, proposalId: string }
    | { action: "add_proposal_comment", body: string, proposalId: string, proposalVersionId: string, section: ProposalSectionKey }
    | { action: "create_contract_from_proposal", proposalId: string }
    | { action: "sign_contract", contractId: string, typedName: string }
    | { action: "start_trial", matchId: string }
    | { action: "acknowledge_trial", trialId: string }

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

async function persistForUsers(event: H3Event, userIds: string[], seed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))

  for (const userId of uniqueIds)
    await persistServerCollaborationState(event, userId, seed)
}

export async function applyCollaborationMutation(event: H3Event, session: SessionUser, payload: CollaborationMutationPayload) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const actedAt = new Date().toISOString()
  let nextSeed = workspace.seed
  let result: Record<string, string | null> = {}
  let affectedUsers = [session.id]

  switch (payload.action) {
    case "send_connect_request": {
      if (payload.toUserId === session.id)
        throw createError({ statusCode: 400, statusMessage: "You cannot send a connect request to yourself." })

      const transition = createConnectRequestTransition(nextSeed, session.id, payload.toUserId, payload.payload, actedAt)
      nextSeed = transition.seed
      affectedUsers = [session.id, payload.toUserId]
      result = { requestId: transition.request.id }
      break
    }

    case "respond_connect_request": {
      const request = nextSeed.connectRequests.find(item => item.id === payload.requestId)
      if (!request)
        throw createError({ statusCode: 404, statusMessage: "Connect request not found." })
      if (!canUserRespondToConnectRequest(request, session.id))
        throw createError({ statusCode: 403, statusMessage: "Only the targeted recipient can respond to this intro." })

      const transition = respondToConnectRequestTransition(nextSeed, payload.requestId, payload.status, actedAt, payload.declineReason || null)
      nextSeed = transition.seed
      affectedUsers = [session.id, request.fromUserId]
      result = { conversationId: transition.conversationId }
      break
    }

    case "send_message": {
      const conversation = nextSeed.conversations.find(item => item.id === payload.conversationId)
      if (!conversation)
        throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
      if (!isConversationParticipant(conversation, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this conversation." })

      const transition = sendMessageTransition(nextSeed, payload.conversationId, session.id, payload.body, payload.attachments || [], actedAt, payload.type || "user")
      nextSeed = transition.seed
      affectedUsers = [...conversation.participantIds]
      result = { messageId: transition.message?.id || null }
      break
    }

    case "mark_conversation_read": {
      const conversation = nextSeed.conversations.find(item => item.id === payload.conversationId)
      if (!conversation)
        throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
      if (!isConversationParticipant(conversation, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this conversation." })

      nextSeed = markConversationReadTransition(nextSeed, payload.conversationId, session.id)
      result = { conversationId: payload.conversationId }
      break
    }

    case "create_proposal": {
      const conversation = nextSeed.conversations.find(item => item.id === payload.conversationId)
      if (!conversation)
        throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
      if (!isConversationParticipant(conversation, session.id) || !conversation.participantIds.includes(payload.recipientUserId))
        throw createError({ statusCode: 403, statusMessage: "Proposal participants must match the conversation." })

      const transition = createProposalTransition(nextSeed, session.id, payload.recipientUserId, payload.conversationId, payload.opportunityId, payload.title, payload.payload, actedAt)
      nextSeed = transition.seed
      affectedUsers = [...conversation.participantIds]
      result = { proposalId: transition.proposalId }
      break
    }

    case "update_proposal_status": {
      const proposal = getProposalById(nextSeed, payload.proposalId)
      if (!proposal)
        throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
      if (!isProposalParticipant(proposal, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })

      nextSeed = updateProposalStatusTransition(nextSeed, payload.proposalId, payload.status, session.id, actedAt)
      affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
      result = { proposalId: proposal.id }
      break
    }

    case "create_proposal_counter_version": {
      const proposal = getProposalById(nextSeed, payload.proposalId)
      if (!proposal)
        throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
      if (!isProposalParticipant(proposal, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })

      const transition = createProposalCounterVersionTransition(nextSeed, payload.proposalId, session.id, payload.payload, actedAt)
      nextSeed = transition.seed
      affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
      result = { proposalId: proposal.id, proposalVersionId: transition.version?.id || null }
      break
    }

    case "add_proposal_comment": {
      const proposal = getProposalById(nextSeed, payload.proposalId)
      if (!proposal)
        throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
      if (!isProposalParticipant(proposal, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })

      const currentVersion = getCurrentProposalVersion(nextSeed, proposal)
      if (!currentVersion || currentVersion.id !== payload.proposalVersionId)
        throw createError({ statusCode: 400, statusMessage: "Comments must target the active proposal version." })

      const transition = addProposalCommentTransition(nextSeed, payload.proposalId, payload.proposalVersionId, session.id, payload.section, payload.body, actedAt)
      nextSeed = transition.seed
      affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
      result = { commentId: transition.comment?.id || null }
      break
    }

    case "create_contract_from_proposal": {
      const proposal = getProposalById(nextSeed, payload.proposalId)
      if (!proposal)
        throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
      if (!isProposalParticipant(proposal, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })

      const transition = createContractFromProposalTransition(nextSeed, payload.proposalId, actedAt)
      nextSeed = transition.seed
      affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
      result = { contractId: transition.contractId }
      break
    }

    case "sign_contract": {
      const contract = getContractById(nextSeed, payload.contractId)
      if (!contract)
        throw createError({ statusCode: 404, statusMessage: "Contract not found." })
      if (!isContractParticipant(nextSeed, contract, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

      nextSeed = signContractTransition(nextSeed, payload.contractId, session.id, payload.typedName, actedAt)
      const proposal = getProposalById(nextSeed, contract.proposalId)
      affectedUsers = proposal ? [proposal.createdByUserId, proposal.recipientUserId] : [session.id]
      result = { contractId: contract.id }
      break
    }

    case "start_trial": {
      const match = nextSeed.matches.find(item => item.id === payload.matchId)
      if (!match)
        throw createError({ statusCode: 404, statusMessage: "Match not found." })
      if (!match.participantIds.includes(session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this match." })

      const transition = startTrialCollaborationTransition(nextSeed, payload.matchId, session.id, actedAt)
      nextSeed = transition.seed
      affectedUsers = [...match.participantIds]
      result = { trialId: transition.trialId }
      break
    }

    case "acknowledge_trial": {
      const trial = nextSeed.trialCollaborations.find(item => item.id === payload.trialId)
      if (!trial)
        throw createError({ statusCode: 404, statusMessage: "Trial collaboration not found." })

      const match = nextSeed.matches.find(item => item.id === trial.matchId)
      if (!match || !match.participantIds.includes(session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this trial collaboration." })

      nextSeed = acknowledgeTrialCollaborationTransition(nextSeed, payload.trialId, session.id, actedAt)
      affectedUsers = [...match.participantIds]
      result = { trialId: trial.id }
      break
    }
  }

  await persistForUsers(event, affectedUsers, nextSeed)

  return {
    data: nextSeed,
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
  await persistServerCollaborationState(event, session.id, transition.seed)

  return {
    data: transition.seed,
    session: workspace.session,
  }
}
