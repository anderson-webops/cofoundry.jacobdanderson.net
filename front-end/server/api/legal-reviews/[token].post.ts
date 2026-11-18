import { createError, defineEventHandler, getRouterParam, readBody } from "h3"
import { getContractParticipantIds } from "~/shared/utils/collaboration"
import { contractLegalReviewResponseSchema } from "~/shared/utils/validation"
import { loadContractLegalReviewAccess, projectContractLegalReviewForReviewer } from "../../utils/contract-legal-review-access"
import { notifyContractLegalReviewParticipants } from "../../utils/contract-legal-review-notifications"
import { contractLegalReviewRateLimitKey } from "../../utils/contract-legal-review-tokens"
import { updateContractLegalReview } from "../../utils/contract-legal-reviews"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { emitWorkspaceRealtimeChange } from "../../utils/workspace-realtime"

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token")
  if (!token)
    throw createError({ statusCode: 400, statusMessage: "Legal review token is required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, contractLegalReviewRateLimitKey(token)),
    limit: 20,
    scope: "legal-reviews:respond",
    windowMs: 60 * 60 * 1000,
  })

  const payload = contractLegalReviewResponseSchema.parse(await readBody(event))
  const context = await loadContractLegalReviewAccess(event, token)
  const updatedAt = new Date().toISOString()

  if (payload.action === "open") {
    if (context.review.status !== "requested") {
      return {
        review: projectContractLegalReviewForReviewer(context.review)
      }
    }

    const review = await updateContractLegalReview(event, context.review, {
      openedAt: updatedAt,
      status: "opened",
      updatedAt,
    })
    await emitWorkspaceRealtimeChange(getContractParticipantIds(context.workspace.seed, context.contract), {
      metadata: {
        action: "contract_legal_review_opened",
        contractId: context.contract.id,
      },
      source: "contract.legal-review",
    }).catch(error => console.warn("[contract-legal-review] Open-state refresh failed.", error))
    return {
      review: projectContractLegalReviewForReviewer(review)
    }
  }

  if (!["requested", "opened"].includes(context.review.status))
    throw createError({ statusCode: 409, statusMessage: "A final response has already been recorded for this review." })

  const review = await updateContractLegalReview(event, context.review, {
    openedAt: context.review.openedAt || updatedAt,
    respondedAt: updatedAt,
    respondedByName: payload.respondedByName,
    reviewerResponse: payload.response,
    status: payload.status,
    updatedAt,
  })

  await notifyContractLegalReviewParticipants(event, context.workspace.seed, context.contract, {
    body: `${review.reviewerName} ${payload.status === "approved"
      ? "approved the requested review scope"
      : "requested changes"} for version ${context.version.versionNumber}. Open the agreement to review the response.`,
    title: payload.status === "approved"
      ? "Legal review completed"
      : "Legal review changes requested",
  }).catch(error => console.warn("[contract-legal-review] Participant notification failed.", error))

  return {
    review: projectContractLegalReviewForReviewer(review)
  }
})
