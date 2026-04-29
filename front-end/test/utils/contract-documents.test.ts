import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildContractRedline, renderContractTextDocument } from "../../shared/utils/contract-documents"
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
