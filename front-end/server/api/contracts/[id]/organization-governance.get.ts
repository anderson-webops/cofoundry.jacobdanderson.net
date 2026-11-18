import { createError, defineEventHandler, getRouterParam, setHeader } from "h3"
import { isContractParticipant } from "~/shared/utils/collaboration"
import { getContractById, getCurrentContractVersion } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { listContractLegalReviews } from "../../../utils/contract-legal-reviews"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { loadContractOrganizationGovernance } from "../../../utils/organization-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const contractId = getRouterParam(event, "id")
  if (!contractId)
    throw createError({ statusCode: 400, statusMessage: "Contract id is required." })
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, contractId),
    limit: 60,
    scope: "contracts:organization-governance",
    windowMs: 60 * 1000,
  })
  const workspace = await loadMemberWorkspaceState(event, session)
  const contract = getContractById(workspace.seed, contractId)
  const version = contract
    ? getCurrentContractVersion(workspace.seed, contract)
    : null
  if (!contract || !version)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })
  if (!isContractParticipant(workspace.seed, contract, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })
  const legalReviews = await listContractLegalReviews(event, contract.id)
  const requirements = await loadContractOrganizationGovernance(event, contract.id, version.id, legalReviews)
  setHeader(event, "Cache-Control", "private, no-store")
  return { requirements }
})
