import { isContractParticipant } from "~/shared/utils/collaboration"
import { getEffectiveContractLegalReviewStatus } from "~/shared/utils/legal-reviews"
import { getContractById, getCurrentContractVersion } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { listContractLegalReviews } from "../../../utils/contract-legal-reviews"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const contractId = getRouterParam(event, "id")
  if (!contractId)
    throw createError({ statusCode: 400, statusMessage: "Contract id is required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, contractId),
    limit: 60,
    scope: "contracts:legal-reviews:list",
    windowMs: 60 * 1000,
  })

  const workspace = await loadMemberWorkspaceState(event, session)
  const contract = getContractById(workspace.seed, contractId)
  const version = contract ? getCurrentContractVersion(workspace.seed, contract) : null
  if (!contract || !version)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })
  if (!isContractParticipant(workspace.seed, contract, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

  const reviews = (await listContractLegalReviews(event, contract.id)).map(review => ({
    ...review,
    status: getEffectiveContractLegalReviewStatus(review, version.id),
  }))

  setHeader(event, "Cache-Control", "private, no-store")
  return { reviews }
})
