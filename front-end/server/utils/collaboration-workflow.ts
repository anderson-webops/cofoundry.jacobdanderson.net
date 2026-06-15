import type { H3Event } from "h3"
import type {
  ConnectDeclineReason,
  ConnectRequestPayload,
  ConnectRequestStatus,
  MessageAttachment,
  ProposalPayload,
  ProposalSectionKey,
  ProposalStatus,
  RelationshipDecisionRecordStatus,
  SessionUser,
  Signature,
} from "../../shared/types/domain"
import type { SubscriptionGateAction } from "../../shared/utils/billing"
import type { LifecycleNotificationRequest } from "../../shared/utils/lifecycle-notifications"
import { checkSubscriptionGate } from "../../shared/utils/billing"
import {
  acknowledgeTrialCollaborationTransition,
  addProposalCommentTransition,
  addRelationshipDecisionTransition,
  canUserRespondToConnectRequest,
  createConnectRequestTransition,
  createContractFromProposalTransition,
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
import { getContractById, getCurrentProposalVersion, getProposalById, getSubscriptionByUserId } from "../../shared/utils/workspace"
import { recordContractSignatureEvent } from "./contract-signatures"
import { emitLifecycleNotificationEvents } from "./lifecycle-notification-events"
import { persistServerCollaborationState } from "./member-collaboration"
import { loadMemberWorkspaceState } from "./member-workspace"
import { emitWorkspaceRealtimeChange } from "./workspace-realtime"

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

async function persistForUsers(event: H3Event, userIds: string[], seed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))

  for (const userId of uniqueIds)
    await persistServerCollaborationState(event, userId, seed)
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

export async function applyCollaborationMutation(event: H3Event, session: SessionUser, payload: CollaborationMutationPayload) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const actedAt = new Date().toISOString()
  let nextSeed = workspace.seed
  let result: Record<string, string | null> = {}
  let affectedUsers = [session.id]
  const lifecycleNotifications: LifecycleNotificationRequest[] = []
  let signatureEvent: { signature: Signature, typedName: string } | null = null

  switch (payload.action) {
    case "send_connect_request": {
      if (payload.toUserId === session.id)
        throw createError({ statusCode: 400, statusMessage: "You cannot send a connect request to yourself." })

      assertSubscriptionGate(nextSeed, session.id, "send_intro")
      const transition = createConnectRequestTransition(nextSeed, session.id, payload.toUserId, payload.payload, actedAt)
      nextSeed = transition.seed
      affectedUsers = [session.id, payload.toUserId]
      result = { requestId: transition.request.id }
      lifecycleNotifications.push({
        eventType: "intro.received",
        metadata: {
          actorUserId: session.id,
          action: payload.action,
        },
        targetId: transition.request.id,
        targetType: "connect_request",
        userId: payload.toUserId,
      })
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
      if (payload.status === "accepted" && transition.match) {
        lifecycleNotifications.push({
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
      if (transition.message && (payload.type || "user") === "user") {
        conversation.participantIds
          .filter(userId => userId !== session.id)
          .forEach((userId) => {
            lifecycleNotifications.push({
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

      assertSubscriptionGate(nextSeed, session.id, "create_proposal")
      const transition = createProposalTransition(nextSeed, session.id, payload.recipientUserId, payload.conversationId, payload.opportunityId, payload.title, payload.payload, actedAt)
      nextSeed = transition.seed
      affectedUsers = [...conversation.participantIds]
      result = { proposalId: transition.proposalId }
      lifecycleNotifications.push({
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
      lifecycleNotifications.push({
        eventType: "proposal.updated",
        metadata: {
          actorUserId: session.id,
          action: payload.action,
          status: payload.status,
        },
        targetId: proposal.id,
        targetType: "proposal",
        userId: proposal.createdByUserId === session.id ? proposal.recipientUserId : proposal.createdByUserId,
      })
      break
    }

    case "create_proposal_counter_version": {
      const proposal = getProposalById(nextSeed, payload.proposalId)
      if (!proposal)
        throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
      if (!isProposalParticipant(proposal, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })

      assertSubscriptionGate(nextSeed, session.id, "create_proposal")
      const transition = createProposalCounterVersionTransition(nextSeed, payload.proposalId, session.id, payload.payload, actedAt)
      nextSeed = transition.seed
      affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
      result = { proposalId: proposal.id, proposalVersionId: transition.version?.id || null }
      lifecycleNotifications.push({
        eventType: "proposal.updated",
        metadata: {
          actorUserId: session.id,
          action: payload.action,
          proposalVersionId: transition.version?.id || null,
        },
        targetId: proposal.id,
        targetType: "proposal",
        userId: proposal.createdByUserId === session.id ? proposal.recipientUserId : proposal.createdByUserId,
      })
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
      lifecycleNotifications.push({
        eventType: "proposal.updated",
        metadata: {
          actorUserId: session.id,
          action: payload.action,
          proposalCommentId: transition.comment?.id || null,
          proposalSection: payload.section,
        },
        targetId: proposal.id,
        targetType: "proposal",
        userId: proposal.createdByUserId === session.id ? proposal.recipientUserId : proposal.createdByUserId,
      })
      break
    }

    case "create_contract_from_proposal": {
      const proposal = getProposalById(nextSeed, payload.proposalId)
      if (!proposal)
        throw createError({ statusCode: 404, statusMessage: "Proposal not found." })
      if (!isProposalParticipant(proposal, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this proposal." })

      assertSubscriptionGate(nextSeed, session.id, "create_contract")
      const transition = createContractFromProposalTransition(nextSeed, payload.proposalId, actedAt)
      nextSeed = transition.seed
      affectedUsers = [proposal.createdByUserId, proposal.recipientUserId]
      result = { contractId: transition.contractId }
      if (transition.contractId) {
        affectedUsers.forEach((userId) => {
          lifecycleNotifications.push({
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
      break
    }

    case "sign_contract": {
      const contract = getContractById(nextSeed, payload.contractId)
      if (!contract)
        throw createError({ statusCode: 404, statusMessage: "Contract not found." })
      if (!isContractParticipant(nextSeed, contract, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

      assertSubscriptionGate(nextSeed, session.id, "sign_contract")
      const existingSignatureIds = new Set(nextSeed.signatures.map(signature => signature.id))
      nextSeed = signContractTransition(nextSeed, payload.contractId, session.id, payload.typedName, actedAt)
      const newSignature = nextSeed.signatures.find(signature => !existingSignatureIds.has(signature.id))
      if (newSignature)
        signatureEvent = { signature: newSignature, typedName: payload.typedName }
      const proposal = getProposalById(nextSeed, contract.proposalId)
      affectedUsers = proposal ? [proposal.createdByUserId, proposal.recipientUserId] : [session.id]
      result = { contractId: contract.id }
      affectedUsers
        .filter(userId => userId !== session.id)
        .forEach((userId) => {
          lifecycleNotifications.push({
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

    case "add_relationship_decision": {
      if (!isRelationshipParticipant(nextSeed, payload.matchId, session.id))
        throw createError({ statusCode: 403, statusMessage: "You are not part of this relationship." })

      const title = payload.title.trim()
      const body = payload.body.trim()
      if (title.length < 4 || body.length < 12)
        throw createError({ statusCode: 400, statusMessage: "Add a clear title and enough detail for the decision log." })

      const match = nextSeed.matches.find(item => item.id === payload.matchId)!
      const transition = addRelationshipDecisionTransition(nextSeed, payload.matchId, session.id, title, body, payload.status, actedAt)
      nextSeed = transition.seed
      affectedUsers = [...match.participantIds]
      result = { relationshipDecisionId: transition.decision?.id || null }
      break
    }
  }

  await persistForUsers(event, affectedUsers, nextSeed)
  await emitWorkspaceRealtimeChange(affectedUsers, {
    metadata: {
      action: payload.action,
    },
    source: "workspace.collaboration",
  })
  if (signatureEvent)
    await recordContractSignatureEvent(event, signatureEvent.signature, signatureEvent.typedName)
  if (lifecycleNotifications.length) {
    await emitLifecycleNotificationEvents(event, nextSeed, lifecycleNotifications, {
      source: "workspace.collaboration",
    })
  }

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
  await emitWorkspaceRealtimeChange([session.id], {
    metadata: {
      action: "mark_notification_read",
      notificationId,
    },
    source: "workspace.inbox",
  })

  return {
    data: transition.seed,
    session: workspace.session,
  }
}
