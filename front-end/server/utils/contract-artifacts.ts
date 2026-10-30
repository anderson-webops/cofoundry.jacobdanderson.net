import type { H3Event } from "h3"
import type { Contract, ContractVersion, Signature, WorkspaceSeed } from "../../shared/types/domain"
import type { ContractProviderEvidence } from "../../shared/utils/contract-documents"
import { hasPaidContractWorkflowSponsor } from "../../shared/utils/billing"
import { isContractParticipant } from "../../shared/utils/collaboration"
import { renderContractTextDocument } from "../../shared/utils/contract-documents"
import { getContractById, getCurrentContractVersion } from "../../shared/utils/workspace"
import { requireAuthenticatedSession } from "./auth"
import { listContractProviderEvidence } from "./contract-envelope-events"
import { loadMemberWorkspaceState } from "./member-workspace"

export interface ContractArtifactContext {
  contract: Contract
  documentText: string
  providerEvidence: ContractProviderEvidence[]
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
  const version = contract
    ? getCurrentContractVersion(workspace.seed, contract)
    : undefined
  if (!contract || !version)
    throw createError({ statusCode: 404, statusMessage: "Contract not found." })

  if (!isContractParticipant(workspace.seed, contract, workspace.session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this contract." })

  if (!hasPaidContractWorkflowSponsor(workspace.seed, contract))
    throw createError({ statusCode: 402, statusMessage: "Agreement export requires an active Pro or Team sponsor among the participants." })

  const signatures = workspace.seed.signatures.filter(signature =>
    signature.contractId === contract.id && signature.contractVersionId === version.id,
  )
  const documentText = renderContractTextDocument(contract, version, signatures)
  const providerEvidence = await listContractProviderEvidence(event, contract.id, version.id)

  return {
    contract,
    documentText,
    providerEvidence,
    seed: workspace.seed,
    signatures,
    version,
  }
}
