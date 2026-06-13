import { describe, expect, it } from "vitest"
import { buildContractDocumentHash, buildContractExecutionCertificate } from "../../server/utils/contract-certificate"
import { workspaceSeed } from "../../shared/data/seed"
import { buildContractRedline, renderContractCertificateText, renderContractHtmlDocument, renderContractTextDocument } from "../../shared/utils/contract-documents"
import { getContractById, getCurrentContractVersion } from "../../shared/utils/workspace"

describe("contract document helpers", () => {
  it("renders a text export with legal notice and signatures", () => {
    const contract = getContractById(workspaceSeed, "contract_ledgerloop")
    const version = contract && getCurrentContractVersion(workspaceSeed, contract)

    expect(contract).toBeDefined()
    expect(version).toBeDefined()

    const document = renderContractTextDocument(
      contract!,
      version!,
      workspaceSeed.signatures.filter(signature => signature.contractId === contract!.id),
    )

    expect(document).toContain("Legal Review Notice")
    expect(document).toContain(contract!.title)
    expect(document).toContain("Signatures")
  })

  it("renders a print-ready html export with certificate metadata", () => {
    const contract = getContractById(workspaceSeed, "contract_ledgerloop")
    const version = contract && getCurrentContractVersion(workspaceSeed, contract)

    expect(contract).toBeDefined()
    expect(version).toBeDefined()

    const signatures = workspaceSeed.signatures.filter(signature => signature.contractId === contract!.id)
    const documentText = renderContractTextDocument(contract!, version!, signatures)
    const certificate = buildContractExecutionCertificate({
      contract: contract!,
      documentText,
      generatedAt: "2026-06-13T12:00:00.000Z",
      providerEvidence: [{
        completedPdfFileUploadId: "upload_completed_pdf",
        completedPdfSha256: "d".repeat(64),
        occurredAt: "2026-06-13T12:05:00.000Z",
        provider: "docusign",
        providerEnvelopeId: "envelope_123",
        signedByUserIds: ["user_olivia"],
        status: "completed",
      }],
      seed: workspaceSeed,
      signatures,
      version: version!,
    })
    const document = renderContractHtmlDocument(contract!, version!, signatures, certificate)

    expect(document).toContain("<!doctype html>")
    expect(document).toContain("Execution Certificate")
    expect(document).toContain("Provider Evidence")
    expect(document).toContain("envelope_123")
    expect(document).toContain(certificate.documentSha256)
    expect(document).toContain("Legal Review Notice")
  })

  it("builds a certificate with hash and pending party evidence", () => {
    const contract = getContractById(workspaceSeed, "contract_ledgerloop")
    const version = contract && getCurrentContractVersion(workspaceSeed, contract)

    expect(contract).toBeDefined()
    expect(version).toBeDefined()

    const signatures = workspaceSeed.signatures.filter(signature => signature.contractId === contract!.id)
    const documentText = renderContractTextDocument(contract!, version!, signatures)
    const certificate = buildContractExecutionCertificate({
      contract: contract!,
      documentText,
      generatedAt: "2026-06-13T12:00:00.000Z",
      seed: workspaceSeed,
      signatures,
      version: version!,
    })
    const certificateText = renderContractCertificateText(certificate)

    expect(buildContractDocumentHash(documentText)).toHaveLength(64)
    expect(certificate.status).toBe("pending")
    expect(certificate.parties).toHaveLength(2)
    expect(certificate.parties.some(party => party.signedAt === null)).toBe(true)
    expect(certificate.providerEvidence).toEqual([])
    expect(certificateText).toContain("Document SHA-256")
    expect(certificateText).toContain("signature pending")
  })

  it("builds field-level redlines between versions", () => {
    const contract = getContractById(workspaceSeed, "contract_ledgerloop")
    const version = contract && getCurrentContractVersion(workspaceSeed, contract)

    expect(version).toBeDefined()

    const previousVersion = {
      ...version!,
      id: "previous",
      notes: "Original notes",
      versionNumber: version!.versionNumber - 1,
    }

    const changes = buildContractRedline(previousVersion, version!)
    expect(changes.some(change => change.field === "notes")).toBe(true)
  })
})
