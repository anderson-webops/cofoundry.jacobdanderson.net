import type { ContractLegalReview } from "~/shared/types/domain"
import { randomUUID } from "node:crypto"
import { hasPaidContractWorkflowSponsor } from "~/shared/utils/billing"
import { getContractParticipantIds, isContractParticipant } from "~/shared/utils/collaboration"
import { contractLegalReviewRequestSchema } from "~/shared/utils/validation"
import { getContractById, getCurrentContractVersion } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { deliverContractLegalReviewInvite } from "../../../utils/contract-legal-review-delivery"
import { notifyContractLegalReviewParticipants } from "../../../utils/contract-legal-review-notifications"
import { createContractLegalReviewUrl } from "../../../utils/contract-legal-review-tokens"
import { createContractLegalReview, listContractLegalReviews } from "../../../utils/contract-legal-reviews"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { loadContractOrganizationGovernance } from "../../../utils/organization-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

const reviewInviteLifetimeMs = 14 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const contractId = getRouterParam(event, "id")
  if (!contractId)
    throw createError({ statusCode: 400, statusMessage: "Contract id is required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, contractId),
    limit: 10,
    scope: "contracts:legal-reviews:create",
    windowMs: 60 * 60 * 1000,
  })

  const payload = contractLegalReviewRequestSchema.parse(await readBody(event))
  const workspace = await loadMemberWorkspaceState(event, session)
  const contract = getContractById(workspace.seed, contractId)
  const version = contract
    ? getCurrentContractVersion(workspace.seed, contract)
    : null
  if (!contract || !version)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })
  if (!isContractParticipant(workspace.seed, contract, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

  const reviewerEmail = payload.reviewerEmail.toLowerCase()
  const participantEmails = new Set(getContractParticipantIds(workspace.seed, contract)
    .map(userId => workspace.seed.users.find(user => user.id === userId)?.email.toLowerCase())
    .filter((email): email is string => Boolean(email)))
  if (participantEmails.has(reviewerEmail)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invite a separate legal representative address rather than an agreement participant's account email.",
    })
  }

  if (!hasPaidContractWorkflowSponsor(workspace.seed, contract)) {
    throw createError({
      statusCode: 402,
      statusMessage: "Legal review handoffs require an active Pro or Team sponsor among the agreement participants.",
    })
  }

  const existingReviews = await listContractLegalReviews(event, contract.id)
  const organizationRequirements = await loadContractOrganizationGovernance(event, contract.id, version.id, existingReviews)
  if (payload.reviewerType === "outside_counsel" && organizationRequirements.some(requirement => !requirement.allowOutsideCounsel)) {
    throw createError({
      statusCode: 409,
      statusMessage: "The linked organization agreement policy restricts this version to in-house counsel. Update the policy or choose an in-house reviewer.",
    })
  }
  if (existingReviews.filter(review => review.contractVersionId === version.id).length >= 5) {
    throw createError({
      statusCode: 409,
      statusMessage: "This agreement version already has the maximum number of review records. Create a revision before inviting another reviewer.",
    })
  }

  const createdAt = new Date().toISOString()
  const review: ContractLegalReview = {
    canceledAt: null,
    contractId: contract.id,
    contractVersionId: version.id,
    createdAt,
    expiresAt: new Date(Date.now() + reviewInviteLifetimeMs).toISOString(),
    id: randomUUID(),
    message: payload.message,
    openedAt: null,
    requestedByUserId: session.id,
    respondedAt: null,
    reviewerEmail,
    reviewerName: payload.reviewerName,
    reviewerOrganization: payload.reviewerOrganization,
    reviewerResponse: null,
    respondedByName: null,
    reviewerType: payload.reviewerType,
    scope: payload.scope,
    status: "requested",
    updatedAt: createdAt,
  }
  const inviteUrl = createContractLegalReviewUrl(event, review)
  if (!inviteUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: "Legal review link signing is not configured.",
    })
  }

  const createdReview = await createContractLegalReview(event, review)
  const delivery = await deliverContractLegalReviewInvite(event, createdReview, contract, version, workspace.state, inviteUrl)

  await notifyContractLegalReviewParticipants(event, workspace.seed, contract, {
    body: `${session.name} invited ${createdReview.reviewerName} to review version ${version.versionNumber}. Signing pauses while that review is active.`,
    excludeUserId: session.id,
    title: "Legal review requested",
  }).catch(error => console.warn("[contract-legal-review] Participant notification failed.", error))

  setHeader(event, "Cache-Control", "private, no-store")
  return {
    delivery: delivery.delivery,
    inviteUrl: delivery.inviteUrl,
    review: createdReview,
  }
})
