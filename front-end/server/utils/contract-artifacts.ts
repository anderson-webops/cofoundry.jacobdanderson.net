import type { H3Event } from "h3"
import type { Contract, ContractVersion, Signature, WorkspaceSeed } from "../../shared/types/domain"
import { getSubscriptionEntitlements } from "../../shared/utils/billing"
import { isContractParticipant } from "../../shared/utils/collaboration"
import { renderContractTextDocument } from "../../shared/utils/contract-documents"
import { getContractById, getCurrentContractVersion, getSubscriptionByUserId } from "../../shared/utils/workspace"
import { requireAuthenticatedSession } from "./auth"
import { loadMemberWorkspaceState } from "./member-workspace"

export interface ContractArtifactContext {
  contract: Contract
  documentText: string
  seed: WorkspaceSeed
  signatures: Signature[]
  version: ContractVersion
}

export async function loadContractArtifactContext(event: H3Event, contractId: string): Promise<ContractArtifactContext> {
  const session = await requireAuthenticatedSession(event)
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

  const signatures = workspace.seed.signatures.filter(signature =>
    signature.contractId === contract.id && signature.contractVersionId === version.id,
  )
  const documentText = renderContractTextDocument(contract, version, signatures)

  return {
    contract,
    documentText,
    seed: workspace.seed,
    signatures,
    version,
  }
}
