import type { NotificationType, WorkspaceSeed } from "../types/domain"
import { collaborationContractNeedsUserSignature, isConversationParticipant, isProposalParticipant } from "./collaboration"
import { formatConnectRequestNextStep } from "./format"
import { getContractById, getCurrentContractVersion, getCurrentProposalVersion, getProfileByUserId, getProposalById } from "./workspace"

export const lifecycleNotificationEventTypes = [
  "intro.received",
  "intro.accepted",
  "match.created",
  "message.unread",
  "proposal.received",
  "proposal.updated",
  "contract.signature_required",
  "report.reviewed",
  "billing.state_changed",
  "subscription.changed",
] as const

export type LifecycleNotificationEventType = typeof lifecycleNotificationEventTypes[number]
export type LifecycleNotificationTargetType = "connect_request" | "match" | "message" | "conversation" | "proposal" | "contract" | "report" | "subscription"

export interface LifecycleNotificationRequest {
  eventType: LifecycleNotificationEventType
  metadata?: Record<string, unknown>
  targetId: string
  targetType?: LifecycleNotificationTargetType | null
  userId: string
}

export interface LifecycleNotificationPlan {
  body: string
  eventType: LifecycleNotificationEventType
  href: string
  metadata: Record<string, unknown>
  notificationType: NotificationType
  recipientEmail: string
  recipientName: string
  subject: string
  summary: string
  targetId: string
  targetType: LifecycleNotificationTargetType
  userId: string
}

function userName(seed: WorkspaceSeed, userId: string) {
  return getProfileByUserId(seed, userId)?.displayName || seed.users.find(user => user.id === userId)?.email || "A CoFoundry member"
}

function formatPlanBody(plan: Omit<LifecycleNotificationPlan, "body">) {
  return [
    `Hi ${plan.recipientName},`,
    "",
    plan.summary,
    "",
    "Open CoFoundry to review the next step:",
    plan.href,
    "",
    "CoFoundry",
  ].join("\n")
}

function finalizePlan(plan: Omit<LifecycleNotificationPlan, "body">): LifecycleNotificationPlan {
  return {
    ...plan,
    body: formatPlanBody(plan),
  }
}

function recipient(seed: WorkspaceSeed, userId: string) {
  const user = seed.users.find(item => item.id === userId)
  const profile = getProfileByUserId(seed, userId)

  if (!user)
    return null

  return {
    email: user.email,
    name: profile?.displayName || user.email.split("@")[0] || "there",
  }
}

function findRelationshipForConnectRequest(seed: WorkspaceSeed, fromUserId: string, toUserId: string) {
  return seed.matches.find(match =>
    match.source === "connect_request"
    && match.participantIds.includes(fromUserId)
    && match.participantIds.includes(toUserId),
  )
}

function buildIntroReceivedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const connectRequest = seed.connectRequests.find(item => item.id === request.targetId)
  if (!connectRequest || connectRequest.toUserId !== request.userId || connectRequest.status !== "pending")
    return null

  const senderName = userName(seed, connectRequest.fromUserId)
  const nextStep = formatConnectRequestNextStep(connectRequest.structuredIntro.proposedNextStep)

  return finalizePlan({
    eventType: "intro.received",
    href: "/app/inbox",
    metadata: request.metadata || {},
    notificationType: "match",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: intro request from ${senderName}`,
    summary: `${senderName} sent an intro request for ${connectRequest.structuredIntro.roleContext}. They proposed: ${nextStep}.`,
    targetId: connectRequest.id,
    targetType: "connect_request",
    userId: request.userId,
  })
}

function buildIntroAcceptedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const connectRequest = seed.connectRequests.find(item => item.id === request.targetId)
  if (!connectRequest || connectRequest.fromUserId !== request.userId || connectRequest.status !== "accepted")
    return null

  const counterpartName = userName(seed, connectRequest.toUserId)
  const relationship = findRelationshipForConnectRequest(seed, connectRequest.fromUserId, connectRequest.toUserId)

  return finalizePlan({
    eventType: "intro.accepted",
    href: relationship
      ? `/app/relationships/${relationship.id}`
      : "/app/inbox",
    metadata: request.metadata || {},
    notificationType: "match",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: ${counterpartName} accepted your intro`,
    summary: `${counterpartName} accepted your intro request. Use the relationship workspace to coordinate the first conversation, trial, proposal, and agreement.`,
    targetId: connectRequest.id,
    targetType: "connect_request",
    userId: request.userId,
  })
}

function buildMatchCreatedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const match = seed.matches.find(item => item.id === request.targetId)
  if (!match?.participantIds.includes(request.userId))
    return null

  const counterpartId = match.participantIds.find(userId => userId !== request.userId)
  const counterpartName = counterpartId
    ? userName(seed, counterpartId)
    : "your counterpart"

  return finalizePlan({
    eventType: "match.created",
    href: `/app/relationships/${match.id}`,
    metadata: request.metadata || {},
    notificationType: "match",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: new match with ${counterpartName}`,
    summary: `Your relationship workspace with ${counterpartName} is ready. Use it to keep the intro, trial, proposal, and agreement in one place.`,
    targetId: match.id,
    targetType: "match",
    userId: request.userId,
  })
}

function buildUnreadMessagePlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const message = seed.messages.find(item => item.id === request.targetId)
  const conversation = message
    ? seed.conversations.find(item => item.id === message.conversationId)
    : seed.conversations.find(item => item.id === request.targetId)

  if (!conversation || !isConversationParticipant(conversation, request.userId))
    return null

  const senderName = message?.senderUserId
    ? userName(seed, message.senderUserId)
    : "CoFoundry"

  return finalizePlan({
    eventType: "message.unread",
    href: `/app/messages/${conversation.id}`,
    metadata: request.metadata || {},
    notificationType: "message",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: unread message from ${senderName}`,
    summary: `${senderName} sent a message that is still waiting in your workspace.`,
    targetId: message?.id || conversation.id,
    targetType: message ? "message" : "conversation",
    userId: request.userId,
  })
}

function buildProposalReceivedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const proposal = getProposalById(seed, request.targetId)
  if (!proposal || proposal.recipientUserId !== request.userId)
    return null

  const version = getCurrentProposalVersion(seed, proposal)
  const actorName = version?.createdByUserId
    ? userName(seed, version.createdByUserId)
    : "Your counterpart"
  const roleTitle = version?.roleTitle || proposal.title

  return finalizePlan({
    eventType: "proposal.received",
    href: `/app/proposals/${proposal.id}`,
    metadata: request.metadata || {},
    notificationType: "proposal",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: new proposal for ${roleTitle}`,
    summary: `${actorName} sent a structured proposal for ${roleTitle}. Review the scope, trial plan, economics, decision rights, and agreement terms before responding.`,
    targetId: proposal.id,
    targetType: "proposal",
    userId: request.userId,
  })
}

function buildProposalUpdatedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const proposal = getProposalById(seed, request.targetId)
  if (!proposal || !isProposalParticipant(proposal, request.userId))
    return null

  const version = getCurrentProposalVersion(seed, proposal)
  const actorName = version?.createdByUserId
    ? userName(seed, version.createdByUserId)
    : "Your counterpart"
  const roleTitle = version?.roleTitle || proposal.title

  return finalizePlan({
    eventType: "proposal.updated",
    href: `/app/proposals/${proposal.id}`,
    metadata: request.metadata || {},
    notificationType: "proposal",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: proposal updated for ${roleTitle}`,
    summary: `${actorName} updated the proposal. Review the latest terms before the relationship moves toward agreement drafting.`,
    targetId: proposal.id,
    targetType: "proposal",
    userId: request.userId,
  })
}

function buildSignatureRequiredPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const contract = getContractById(seed, request.targetId)
  const version = contract
    ? getCurrentContractVersion(seed, contract)
    : undefined
  if (!contract || !collaborationContractNeedsUserSignature(seed, contract, version, seed.signatures, request.userId))
    return null

  return finalizePlan({
    eventType: "contract.signature_required",
    href: `/app/contracts/${contract.id}`,
    metadata: request.metadata || {},
    notificationType: "contract",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: signature needed for ${contract.title}`,
    summary: `${contract.title} is waiting on your signature. Review the generated agreement and sign only if the terms match what both sides agreed.`,
    targetId: contract.id,
    targetType: "contract",
    userId: request.userId,
  })
}

function buildReportReviewedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const report = seed.reports.find(item => item.id === request.targetId)
  const status = report?.status || (request.metadata?.status === "reviewed" || request.metadata?.status === "resolved"
    ? request.metadata.status
    : null)

  if (report && report.reporterUserId !== request.userId)
    return null

  if (!status || status === "open")
    return null

  return finalizePlan({
    eventType: "report.reviewed",
    href: "/app/settings",
    metadata: request.metadata || {},
    notificationType: "admin",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: "CoFoundry: your safety report was reviewed",
    summary: status === "resolved"
      ? "The safety team resolved your report and recorded the moderation outcome."
      : "The safety team reviewed your report and recorded the next moderation step.",
    targetId: request.targetId,
    targetType: "report",
    userId: request.userId,
  })
}

function buildSubscriptionChangedPlan(seed: WorkspaceSeed, request: LifecycleNotificationRequest, recipientUser: NonNullable<ReturnType<typeof recipient>>) {
  const subscription = seed.subscriptions.find(item => item.id === request.targetId)
  if (!subscription || subscription.userId !== request.userId)
    return null

  return finalizePlan({
    eventType: request.eventType,
    href: "/app/billing",
    metadata: request.metadata || {},
    notificationType: "billing",
    recipientEmail: recipientUser.email,
    recipientName: recipientUser.name,
    subject: `CoFoundry: ${subscription.plan} billing status is ${subscription.status}`,
    summary: `Your ${subscription.plan} plan is currently ${subscription.status}. Review billing if you need to update access, renewal, or account records.`,
    targetId: subscription.id,
    targetType: "subscription",
    userId: request.userId,
  })
}

export function buildLifecycleNotification(seed: WorkspaceSeed, request: LifecycleNotificationRequest) {
  const recipientUser = recipient(seed, request.userId)
  if (!recipientUser)
    return null

  switch (request.eventType) {
    case "intro.received":
      return buildIntroReceivedPlan(seed, request, recipientUser)
    case "intro.accepted":
      return buildIntroAcceptedPlan(seed, request, recipientUser)
    case "match.created":
      return buildMatchCreatedPlan(seed, request, recipientUser)
    case "message.unread":
      return buildUnreadMessagePlan(seed, request, recipientUser)
    case "proposal.received":
      return buildProposalReceivedPlan(seed, request, recipientUser)
    case "proposal.updated":
      return buildProposalUpdatedPlan(seed, request, recipientUser)
    case "contract.signature_required":
      return buildSignatureRequiredPlan(seed, request, recipientUser)
    case "report.reviewed":
      return buildReportReviewedPlan(seed, request, recipientUser)
    case "billing.state_changed":
    case "subscription.changed":
      return buildSubscriptionChangedPlan(seed, request, recipientUser)
    default:
      return null
  }
}
