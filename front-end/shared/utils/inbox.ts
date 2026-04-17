import type {
  ConnectRequest,
  Contract,
  Conversation,
  Notification,
  Proposal,
  WorkspaceSeed,
} from "../types/domain"
import { formatConnectRequestNextStep, formatProposalStatus } from "./format"
import {
  buildParticipantProfiles,
  getContractsForUser,
  getCurrentContractVersion,
  getCurrentProposalVersion,
  getIncomingConnectRequestsForUser,
  getMessagesForConversation,
  getOutgoingConnectRequestsForUser,
  getProfileByUserId,
  getProposalsForUser,
} from "./workspace"

export type InboxActionKind = "intro" | "message" | "proposal" | "contract" | "notification"
export type InboxActionPriority = "high" | "medium" | "low"
export type InboxActionTone = "accent" | "warning" | "neutral" | "success" | "danger"

export interface InboxActionItem {
  id: string
  kind: InboxActionKind
  priority: InboxActionPriority
  title: string
  summary: string
  href: string
  createdAt: string
  badgeLabel: string
  badgeTone: InboxActionTone
}

export interface InboxSnapshot {
  counts: {
    pendingIntros: number
    waitingOnReplies: number
    unreadConversations: number
    proposalsNeedingResponse: number
    contractsNeedingSignature: number
    unreadNotifications: number
  }
  actions: InboxActionItem[]
}

const priorityWeight: Record<InboxActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function byNewest<T extends { createdAt: string }>(left: T, right: T) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
}

function getConversationCounterpartLabel(seed: WorkspaceSeed, conversation: Conversation, userId: string) {
  const counterpart = buildParticipantProfiles(seed, conversation.participantIds)
    .find(profile => profile.userId !== userId)

  return counterpart?.displayName || "Conversation"
}

export function getPendingIncomingConnectRequestsForUser(seed: WorkspaceSeed, userId: string) {
  return getIncomingConnectRequestsForUser(seed, userId).filter(request => request.status === "pending")
}

export function getPendingOutgoingConnectRequestsForUser(seed: WorkspaceSeed, userId: string) {
  return getOutgoingConnectRequestsForUser(seed, userId).filter(request => request.status === "pending")
}

export function getUnreadConversationsForUser(seed: WorkspaceSeed, userId: string) {
  return seed.conversations
    .filter(conversation => conversation.participantIds.includes(userId) && (conversation.unreadCountByUser[userId] || 0) > 0)
    .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime())
}

export function proposalNeedsUserResponse(seed: WorkspaceSeed, proposal: Proposal, userId: string) {
  if (proposal.status === "accepted" || proposal.status === "rejected")
    return false

  const version = getCurrentProposalVersion(seed, proposal)
  if (!version)
    return false

  return version.createdByUserId !== userId
}

export function getProposalsNeedingResponse(seed: WorkspaceSeed, userId: string) {
  return getProposalsForUser(seed, userId)
    .filter(proposal => proposalNeedsUserResponse(seed, proposal, userId))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function contractNeedsUserSignature(seed: WorkspaceSeed, contract: Contract, userId: string) {
  if (contract.status !== "pending_signature")
    return false

  const version = getCurrentContractVersion(seed, contract)
  if (!version)
    return false

  return !seed.signatures.some(signature =>
    signature.contractId === contract.id
    && signature.contractVersionId === version.id
    && signature.userId === userId,
  )
}

export function getContractsNeedingSignature(seed: WorkspaceSeed, userId: string) {
  return getContractsForUser(seed, userId)
    .filter(contract => contractNeedsUserSignature(seed, contract, userId))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export function getUnreadNotificationsForUser(seed: WorkspaceSeed, userId: string) {
  return seed.notifications
    .filter(notification => notification.userId === userId && !notification.readAt)
    .sort(byNewest)
}

export function buildInboxSnapshot(seed: WorkspaceSeed, userId: string): InboxSnapshot {
  const pendingIncomingRequests = getPendingIncomingConnectRequestsForUser(seed, userId)
  const pendingOutgoingRequests = getPendingOutgoingConnectRequestsForUser(seed, userId)
  const unreadConversations = getUnreadConversationsForUser(seed, userId)
  const proposalsNeedingResponse = getProposalsNeedingResponse(seed, userId)
  const contractsNeedingSignature = getContractsNeedingSignature(seed, userId)
  const unreadNotifications = getUnreadNotificationsForUser(seed, userId)

  const introItems: InboxActionItem[] = pendingIncomingRequests.map((request: ConnectRequest) => {
    const counterpart = getProfileByUserId(seed, request.fromUserId)

    return {
      id: `intro:${request.id}`,
      kind: "intro",
      priority: "high",
      title: `Review intro from ${counterpart?.displayName || "a member"}`,
      summary: `${request.structuredIntro.roleContext} · ${formatConnectRequestNextStep(request.structuredIntro.proposedNextStep)}`,
      href: `/app/inbox#intro-${request.id}`,
      createdAt: request.createdAt,
      badgeLabel: "Intro",
      badgeTone: "warning",
    }
  })

  const messageItems: InboxActionItem[] = unreadConversations.map((conversation) => {
    const preview = getMessagesForConversation(seed, conversation.id).at(-1)?.body || "Conversation needs a reply."
    const unreadCount = conversation.unreadCountByUser[userId] || 0

    return {
      id: `message:${conversation.id}`,
      kind: "message",
      priority: "high",
      title: `Reply to ${getConversationCounterpartLabel(seed, conversation, userId)}`,
      summary: `${preview.slice(0, 140)}${preview.length > 140 ? "..." : ""}`,
      href: `/app/messages/${conversation.id}`,
      createdAt: conversation.lastMessageAt,
      badgeLabel: `${unreadCount} new`,
      badgeTone: "accent",
    }
  })

  const proposalItems: InboxActionItem[] = proposalsNeedingResponse.map((proposal) => {
    const currentVersion = getCurrentProposalVersion(seed, proposal)
    const author = currentVersion ? getProfileByUserId(seed, currentVersion.createdByUserId) : null

    return {
      id: `proposal:${proposal.id}`,
      kind: "proposal",
      priority: "high",
      title: `Review proposal update${author ? ` from ${author.displayName}` : ""}`,
      summary: `${proposal.title} · ${formatProposalStatus(proposal.status)}`,
      href: `/app/proposals/${proposal.id}`,
      createdAt: proposal.updatedAt,
      badgeLabel: "Proposal",
      badgeTone: "warning",
    }
  })

  const contractItems: InboxActionItem[] = contractsNeedingSignature.map((contract) => {
    const version = getCurrentContractVersion(seed, contract)

    return {
      id: `contract:${contract.id}`,
      kind: "contract",
      priority: "high",
      title: "Signature still required",
      summary: `${contract.title}${version ? ` · Version ${version.versionNumber}` : ""}`,
      href: `/app/contracts/${contract.id}`,
      createdAt: contract.updatedAt,
      badgeLabel: "Signature",
      badgeTone: "warning",
    }
  })

  const representedHrefs = new Set([
    ...messageItems.map(item => item.href),
    ...proposalItems.map(item => item.href),
    ...contractItems.map(item => item.href),
  ])

  const notificationItems: InboxActionItem[] = unreadNotifications
    .filter((notification: Notification) => !representedHrefs.has(notification.href))
    .map(notification => ({
      id: `notification:${notification.id}`,
      kind: "notification",
      priority: notification.type === "admin" || notification.type === "billing" ? "high" : "medium",
      title: notification.title,
      summary: notification.body,
      href: notification.href,
      createdAt: notification.createdAt,
      badgeLabel: "Update",
      badgeTone: notification.type === "admin" || notification.type === "billing" ? "warning" : "neutral",
    }))

  const actions = [...introItems, ...messageItems, ...proposalItems, ...contractItems, ...notificationItems]
    .sort((left, right) => priorityWeight[left.priority] - priorityWeight[right.priority] || byNewest(left, right))

  return {
    counts: {
      pendingIntros: pendingIncomingRequests.length,
      waitingOnReplies: pendingOutgoingRequests.length,
      unreadConversations: unreadConversations.length,
      proposalsNeedingResponse: proposalsNeedingResponse.length,
      contractsNeedingSignature: contractsNeedingSignature.length,
      unreadNotifications: unreadNotifications.length,
    },
    actions,
  }
}
