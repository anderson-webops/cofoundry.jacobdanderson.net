import { getRouterParam } from "h3"
import { isContractParticipant } from "~/shared/utils/collaboration"
import { buildContractRedline } from "~/shared/utils/contract-documents"
import { getContractById, getCurrentContractVersion } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "contracts:redline",
    windowMs: 60 * 60 * 1000,
  })
  const contractId = getRouterParam(event, "id")

  if (!contractId)
    throw createError({ statusCode: 400, statusMessage: "Contract id is required." })

  const workspace = await loadMemberWorkspaceState(event, {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  })

  const contract = getContractById(workspace.seed, contractId)
  const currentVersion = contract ? getCurrentContractVersion(workspace.seed, contract) : undefined
  if (!contract || !currentVersion)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })

  if (!isContractParticipant(workspace.seed, contract, workspace.session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

  const versions = workspace.seed.contractVersions
    .filter(version => version.contractId === contract.id)
    .sort((left, right) => right.versionNumber - left.versionNumber)
  const previousVersion = versions.find(version => version.versionNumber === currentVersion.versionNumber - 1)

  return {
    changes: buildContractRedline(previousVersion, currentVersion),
    currentVersionNumber: currentVersion.versionNumber,
    previousVersionNumber: previousVersion?.versionNumber || null,
  }
})
