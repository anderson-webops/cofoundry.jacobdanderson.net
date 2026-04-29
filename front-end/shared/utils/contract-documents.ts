import type { Contract, ContractVersion, Signature } from "../types/domain"

interface ContractField {
  key: keyof Pick<
    ContractVersion,
    "roleTitle" | "scope" | "timeCommitment" | "compensation" | "equity" | "vesting" | "ipAssignment" | "confidentiality" | "decisionMaking" | "termination" | "disputeResolution" | "notes"
  >
  label: string
}

export interface ContractRedlineChange {
  after: string
  before: string
  field: string
  label: string
}

const documentFields: ContractField[] = [
  { key: "roleTitle", label: "Role and Agreement Type" },
  { key: "scope", label: "Scope" },
  { key: "timeCommitment", label: "Time Commitment" },
  { key: "compensation", label: "Compensation" },
  { key: "equity", label: "Equity" },
  { key: "vesting", label: "Vesting" },
  { key: "ipAssignment", label: "IP Assignment" },
  { key: "confidentiality", label: "Confidentiality" },
  { key: "decisionMaking", label: "Decision-Making" },
  { key: "termination", label: "Termination" },
  { key: "disputeResolution", label: "Dispute Resolution" },
  { key: "notes", label: "Notes" },
]

function normalize(value: string) {
  return value.trim().replaceAll(/\s+/g, " ")
}

export function renderContractTextDocument(contract: Contract, version: ContractVersion, signatures: Signature[]) {
  const signatureLines = signatures.length
    ? signatures.map(signature => `- ${signature.typedName} (${signature.userId}) signed ${signature.signedAt}`)
    : ["- No signatures recorded for this version."]

  return [
    contract.title,
    `Version ${version.versionNumber}`,
    `Generated ${version.createdAt}`,
    "",
    "Legal Review Notice",
    "This document is an editable startup agreement template generated from CoFoundry proposal terms. It is not legal advice and should be reviewed by qualified counsel before execution.",
    "",
    "Parties",
    version.parties.join(" and "),
    "",
    ...documentFields.flatMap(field => [
      field.label,
      version[field.key],
      "",
    ]),
    "Signatures",
    ...signatureLines,
    "",
  ].join("\n")
}

export function buildContractRedline(previousVersion: ContractVersion | undefined, currentVersion: ContractVersion) {
  if (!previousVersion)
    return [] as ContractRedlineChange[]

  return documentFields
    .filter(field => normalize(previousVersion[field.key]) !== normalize(currentVersion[field.key]))
    .map(field => ({
      after: currentVersion[field.key],
      before: previousVersion[field.key],
      field: field.key,
      label: field.label,
    }))
}
