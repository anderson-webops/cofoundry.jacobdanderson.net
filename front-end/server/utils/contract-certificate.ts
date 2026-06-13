import type { Contract, ContractVersion, Signature, WorkspaceSeed } from "../../shared/types/domain"
import type { ContractProviderEvidence } from "../../shared/utils/contract-documents"
import { createHash } from "node:crypto"
import { getContractParticipantIds } from "../../shared/utils/collaboration"
import { getProfileByUserId, getUserById } from "../../shared/utils/workspace"

export function buildContractDocumentHash(documentText: string) {
  return createHash("sha256").update(documentText, "utf8").digest("hex")
}

export function buildContractExecutionCertificate(input: {
  contract: Contract
  documentText: string
  generatedAt?: string
  providerEvidence?: ContractProviderEvidence[]
  seed: WorkspaceSeed
  signatures: Signature[]
  version: ContractVersion
}) {
  const participantIds = getContractParticipantIds(input.seed, input.contract)
  const signatureByUserId = new Map(input.signatures.map(signature => [signature.userId, signature]))

  const parties = participantIds.map((userId) => {
    const user = getUserById(input.seed, userId)
    const profile = getProfileByUserId(input.seed, userId)
    const signature = signatureByUserId.get(userId)

    return {
      email: user?.email || "unknown",
      name: profile?.displayName || userId,
      signedAt: signature?.signedAt || null,
      typedName: signature?.typedName || null,
      userId,
    }
  })

  return {
    contractId: input.contract.id,
    contractTitle: input.contract.title,
    documentSha256: buildContractDocumentHash(input.documentText),
    generatedAt: input.generatedAt || new Date().toISOString(),
    legalNotice: "This certificate records CoFoundry's typed-name signature evidence for the generated agreement template. It is not legal advice and is not a substitute for qualified counsel or a dedicated e-signature provider when one is required.",
    parties,
    providerEvidence: input.providerEvidence || [],
    status: parties.length > 0 && parties.every(party => party.signedAt) ? "complete" as const : "pending" as const,
    versionId: input.version.id,
    versionNumber: input.version.versionNumber,
  }
}
