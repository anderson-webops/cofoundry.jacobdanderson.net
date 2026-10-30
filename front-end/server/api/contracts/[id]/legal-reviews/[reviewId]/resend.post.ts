import { isContractParticipant } from "~/shared/utils/collaboration"
import { getEffectiveContractLegalReviewStatus } from "~/shared/utils/legal-reviews"
import { getContractById, getCurrentContractVersion } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../../../utils/auth"
import { deliverContractLegalReviewInvite } from "../../../../../utils/contract-legal-review-delivery"
import { getContractLegalReview } from "../../../../../utils/contract-legal-reviews"
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
    limit: 5,
    scope: "contracts:legal-reviews:resend",
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
  if (review.requestedByUserId !== session.id)
    throw createError({ statusCode: 403, statusMessage: "Only the member who requested this review can resend it." })

  const status = getEffectiveContractLegalReviewStatus(review, version.id)
  if (!["requested", "opened"].includes(status))
    throw createError({ statusCode: 409, statusMessage: "This review invite is no longer active." })

  return deliverContractLegalReviewInvite(event, review, contract, version, workspace.state)
})
