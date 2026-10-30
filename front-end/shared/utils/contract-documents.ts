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

export interface ContractCertificateParty {
  email: string
  name: string
  signedAt: string | null
  typedName: string | null
  userId: string
}

export interface ContractProviderEvidence {
  completedPdfFileUploadId: string | null
  completedPdfSha256: string | null
  occurredAt: string
  provider: string
  providerEnvelopeId: string
  signedByUserIds: string[]
  status: "created" | "sent" | "viewed" | "completed" | "declined" | "voided" | "failed"
}

export interface ContractExecutionCertificate {
  contractId: string
  contractTitle: string
  documentSha256: string
  generatedAt: string
  legalNotice: string
  parties: ContractCertificateParty[]
  providerEvidence: ContractProviderEvidence[]
  status: "complete" | "pending"
  versionId: string
  versionNumber: number
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

const legalReviewNotice = "This document is an editable startup agreement template generated from CoFoundry proposal terms. It is not legal advice and should be reviewed by qualified counsel before execution."

function normalize(value: string) {
  return value.trim().replaceAll(/\s+/g, " ")
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")
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
    legalReviewNotice,
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

export function renderContractHtmlDocument(contract: Contract, version: ContractVersion, signatures: Signature[], certificate?: ContractExecutionCertificate) {
  const signatureRows = signatures.length
    ? signatures.map(signature => `
        <tr>
          <td>${escapeHtml(signature.typedName)}</td>
          <td>${escapeHtml(signature.userId)}</td>
          <td>${escapeHtml(signature.signedAt)}</td>
        </tr>`).join("")
    : `
        <tr>
          <td colspan="3">No signatures recorded for this version.</td>
        </tr>`

  const providerEvidenceRows = certificate?.providerEvidence.length
    ? certificate.providerEvidence.map(evidence => `
        <tr>
          <td>${escapeHtml(evidence.provider)}</td>
          <td>${escapeHtml(evidence.providerEnvelopeId)}</td>
          <td>${escapeHtml(evidence.status)}</td>
          <td>${escapeHtml(evidence.occurredAt)}</td>
          <td>${escapeHtml(evidence.completedPdfSha256 || "not reported")}</td>
        </tr>`).join("")
    : ""

  const providerEvidenceBlock = providerEvidenceRows
    ? `
      <h3>Provider Evidence</h3>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Envelope</th>
            <th>Status</th>
            <th>Occurred</th>
            <th>Completed PDF SHA-256</th>
          </tr>
        </thead>
        <tbody>${providerEvidenceRows}</tbody>
      </table>`
    : ""

  const certificateBlock = certificate
    ? `
      <section class="certificate">
        <h2>Execution Certificate</h2>
        <dl>
          <div><dt>Status</dt><dd>${escapeHtml(certificate.status)}</dd></div>
          <div><dt>Generated</dt><dd>${escapeHtml(certificate.generatedAt)}</dd></div>
          <div><dt>Document SHA-256</dt><dd class="hash">${escapeHtml(certificate.documentSha256)}</dd></div>
        </dl>
        ${providerEvidenceBlock}
      </section>`
    : ""

  const fields = documentFields.map(field => `
    <section class="clause">
      <h2>${escapeHtml(field.label)}</h2>
      <p>${escapeHtml(version[field.key])}</p>
    </section>`).join("")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(contract.title)} - Version ${version.versionNumber}</title>
  <style>
    :root {
      color: #1b211f;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      line-height: 1.55;
    }
    body {
      margin: 0;
      background: #f8f7f2;
    }
    main {
      box-sizing: border-box;
      margin: 0 auto;
      max-width: 920px;
      min-height: 100vh;
      padding: 48px;
      background: #fffdf8;
    }
    h1, h2, h3 {
      line-height: 1.1;
    }
    h1 {
      margin: 0 0 12px;
      font-size: 32px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 16px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h3 {
      margin: 20px 0 0;
      font-size: 14px;
    }
    p {
      margin: 0;
    }
    .meta,
    .notice,
    .certificate,
    .clause,
    table {
      border: 1px solid #d7d2c6;
      border-radius: 16px;
      margin-top: 18px;
      padding: 18px;
    }
    .notice {
      background: #f3efe3;
    }
    dl {
      display: grid;
      gap: 10px;
      margin: 0;
    }
    dt {
      color: #606860;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    dd {
      margin: 3px 0 0;
      overflow-wrap: anywhere;
    }
    table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
    }
    th,
    td {
      border-bottom: 1px solid #e7e2d7;
      padding: 10px;
      text-align: left;
      vertical-align: top;
    }
    tr:last-child td {
      border-bottom: 0;
    }
    .hash {
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 12px;
    }
    @media print {
      body {
        background: white;
      }
      main {
        max-width: none;
        padding: 0;
      }
      .clause,
      table {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(contract.title)}</h1>
    <p>Version ${version.versionNumber} generated ${escapeHtml(version.createdAt)}</p>
    <section class="notice">
      <h2>Legal Review Notice</h2>
      <p>${escapeHtml(legalReviewNotice)}</p>
    </section>
    ${certificateBlock}
    <section class="meta">
      <h2>Parties</h2>
      <p>${escapeHtml(version.parties.join(" and "))}</p>
    </section>
    ${fields}
    <section>
      <h2>Signatures</h2>
      <table>
        <thead>
          <tr>
            <th>Typed name</th>
            <th>User ID</th>
            <th>Signed at</th>
          </tr>
        </thead>
        <tbody>${signatureRows}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`
}

export function renderContractCertificateText(certificate: ContractExecutionCertificate) {
  const partyLines = certificate.parties.map((party) => {
    const signatureStatus = party.signedAt && party.typedName
      ? `signed as ${party.typedName} at ${party.signedAt}`
      : "signature pending"

    return `- ${party.name} <${party.email}> (${party.userId}): ${signatureStatus}`
  })

  const providerEvidenceLines = certificate.providerEvidence.length
    ? [
        "Provider Evidence",
        ...certificate.providerEvidence.flatMap(evidence => [
          `- ${evidence.provider} envelope ${evidence.providerEnvelopeId}: ${evidence.status} at ${evidence.occurredAt}`,
          evidence.completedPdfSha256
            ? `  Completed PDF SHA-256: ${evidence.completedPdfSha256}`
            : "  Completed PDF SHA-256: not reported",
          evidence.signedByUserIds.length
            ? `  Provider-reported signers: ${evidence.signedByUserIds.join(", ")}`
            : "  Provider-reported signers: none",
        ]),
        "",
      ]
    : []

  return [
    "CoFoundry Agreement Execution Certificate",
    "",
    `Contract: ${certificate.contractTitle}`,
    `Contract ID: ${certificate.contractId}`,
    `Version: ${certificate.versionNumber}`,
    `Version ID: ${certificate.versionId}`,
    `Status: ${certificate.status}`,
    `Generated: ${certificate.generatedAt}`,
    `Document SHA-256: ${certificate.documentSha256}`,
    "",
    "Parties",
    ...partyLines,
    "",
    ...providerEvidenceLines,
    "Legal Review Notice",
    certificate.legalNotice,
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
