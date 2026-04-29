import { getRouterParam, setHeader } from "h3"
import { getSubscriptionEntitlements } from "~/shared/utils/billing"
import { isContractParticipant } from "~/shared/utils/collaboration"
import { renderContractTextDocument } from "~/shared/utils/contract-documents"
import { getContractById, getCurrentContractVersion, getSubscriptionByUserId } from "~/shared/utils/workspace"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

const unsafeFilenamePattern = /[^\w.-]+/g

function safeFilename(value: string) {
  return value.toLowerCase().replaceAll(unsafeFilenamePattern, "-").replace(/^-|-$/g, "") || "cofoundry-contract"
}

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "contracts:export",
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
  const version = contract ? getCurrentContractVersion(workspace.seed, contract) : undefined
  if (!contract || !version)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })

  if (!isContractParticipant(workspace.seed, contract, workspace.session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

  const subscription = getSubscriptionByUserId(workspace.seed, workspace.session.id)
  const entitlements = getSubscriptionEntitlements(subscription)
  if (!entitlements.canPrintContracts)
    throw createError({ statusCode: 402, statusMessage: "Contract export requires a paid plan." })

  const signatures = workspace.seed.signatures.filter(signature => signature.contractId === contract.id && signature.contractVersionId === version.id)
  const document = renderContractTextDocument(contract, version, signatures)

  setHeader(event, "Content-Type", "text/plain; charset=utf-8")
  setHeader(event, "Content-Disposition", `attachment; filename="${safeFilename(contract.title)}-v${version.versionNumber}.txt"`)

  return document
})
