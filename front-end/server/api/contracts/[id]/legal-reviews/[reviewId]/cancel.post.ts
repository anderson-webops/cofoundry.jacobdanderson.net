import { isContractParticipant } from "~/shared/utils/collaboration"
import { getEffectiveContractLegalReviewStatus } from "~/shared/utils/legal-reviews"
import { getContractById, getCurrentContractVersion } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../../../utils/auth"
import { notifyContractLegalReviewParticipants } from "../../../../../utils/contract-legal-review-notifications"
import { getContractLegalReview, updateContractLegalReview } from "../../../../../utils/contract-legal-reviews"
import { loadMemberWorkspaceState } from "../../../../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const contractId = getRouterParam(event, "id")
  const reviewId = getRouterParam(event, "reviewId")
  if (!contractId || !reviewId)
    throw createError({ statusCode: 400, statusMessage: "Contract and review ids are required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, reviewId),
    limit: 20,
    scope: "contracts:legal-reviews:cancel",
    windowMs: 60 * 60 * 1000,
  })

  const workspace = await loadMemberWorkspaceState(event, session)
  const contract = getContractById(workspace.seed, contractId)
  const version = contract
    ? getCurrentContractVersion(workspace.seed, contract)
    : null
  const review = await getContractLegalReview(event, reviewId)
  if (!contract || !version || !review || review.contractId !== contract.id)
    throw createError({ statusCode: 404, statusMessage: "Legal review not found." })
  if (!isContractParticipant(workspace.seed, contract, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })
  const status = getEffectiveContractLegalReviewStatus(review, version.id)
  if (!["requested", "opened", "changes_requested"].includes(status))
    throw createError({ statusCode: 409, statusMessage: "This review is no longer eligible for cancellation." })

  const canceledAt = new Date().toISOString()
  const updated = await updateContractLegalReview(event, review, {
    canceledAt,
    status: "canceled",
    updatedAt: canceledAt,
  })

  await notifyContractLegalReviewParticipants(event, workspace.seed, contract, {
    body: `${session.name} canceled the active legal review and revoked its link for version ${version.versionNumber}. The parties can proceed without that review or create another request.`,
    excludeUserId: session.id,
    title: "Legal review canceled",
  }).catch(error => console.warn("[contract-legal-review] Participant notification failed.", error))

  return { review: updated }
})
