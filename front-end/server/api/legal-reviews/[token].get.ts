import { loadContractLegalReviewAccess, projectContractLegalReviewForReviewer, projectContractVersionForReviewer } from "../../utils/contract-legal-review-access"
import { contractLegalReviewRateLimitKey } from "../../utils/contract-legal-review-tokens"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token")
  if (!token)
    throw createError({ statusCode: 400, statusMessage: "Legal review token is required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, contractLegalReviewRateLimitKey(token)),
    limit: 30,
    scope: "legal-reviews:access",
    windowMs: 60 * 60 * 1000,
  })

  const context = await loadContractLegalReviewAccess(event, token)
  setHeader(event, "Cache-Control", "private, no-store")
  setHeader(event, "Referrer-Policy", "no-referrer")

  return {
    contract: {
      title: context.contract.title,
    },
    legalNotice: "CoFoundry is transmitting an editable startup agreement template and the reviewer's response at the parties' request. CoFoundry is not a law firm, does not provide legal advice, does not verify reviewer identity or licensure, and is not a party to any attorney-client relationship or engagement.",
    review: projectContractLegalReviewForReviewer(context.review),
    version: projectContractVersionForReviewer(context.version),
  }
})
