import type {
  Proposal,
  ProposalComment,
  ProposalSectionKey,
  ProposalSectionState,
  ProposalStatus,
  ProposalVersion,
} from "../types/domain"

const proposalSectionOrder: ProposalSectionKey[] = [
  "partnership",
  "scope",
  "trial",
  "economics",
  "decision_rights",
  "ip_confidentiality",
  "exit",
]

export interface ProposalSectionSummary {
  id: ProposalSectionKey
  title: string
  state: ProposalSectionState
  body: string
  supporting: string[]
  commentCount: number
}

export interface ProposalTimelineEntry {
  id: string
  versionNumber: number
  summary: string
  createdByUserId: string
  createdAt: string
  current: boolean
}

function buildSectionState(status: ProposalStatus, commentCount: number): ProposalSectionState {
  if (status === "accepted")
    return "agreed"

  if (commentCount > 0 || status === "countered")
    return "countered"

  return "proposed"
}

function sectionComments(comments: ProposalComment[], versionId: string, section: ProposalSectionKey) {
  return comments.filter(comment => comment.proposalVersionId === versionId && comment.section === section)
}

export function buildProposalSectionSummaries(
  version: ProposalVersion,
  comments: ProposalComment[],
  status: ProposalStatus,
): ProposalSectionSummary[] {
  const commentsBySection = new Map(
    proposalSectionOrder.map(section => [
      section,
      sectionComments(comments, version.id, section)
    ]),
  )

  const build = (id: ProposalSectionKey, title: string, body: string, supporting: string[] = []) => ({
    id,
    title,
    body,
    supporting,
    commentCount: commentsBySection.get(id)?.length || 0,
    state: buildSectionState(status, commentsBySection.get(id)?.length || 0),
  })

  return [
    build(
      "partnership",
      "Partnership shape",
      `${version.roleTitle} · ${version.relationshipType.replaceAll("_", " ")}`,
      [
        `CEO / lead operator: ${version.ceoDecision}`,
        `Start date: ${version.startDate}`,
      ],
    ),
    build(
      "scope",
      "Role and scope",
      version.responsibilities.join(" "),
      [
        `${version.weeklyTimeCommitment} hours per week`,
        `Full-time trigger: ${version.fullTimeTrigger}`,
      ],
    ),
    build(
      "trial",
      "Work trial",
      version.trialScope,
      [
        `Trial IP rule: ${version.trialIpHandling}`,
      ],
    ),
    build(
      "economics",
      "Economics",
      `${version.cashCompensation} · ${version.equity}`,
      [
        `Vesting: ${version.vestingSchedule}`,
        `Cliff: ${version.cliff}`,
      ],
    ),
    build(
      "decision_rights",
      "Decision rights",
      version.decisionRights,
      [
        `CEO decision: ${version.ceoDecision}`,
      ],
    ),
    build(
      "ip_confidentiality",
      "IP and confidentiality",
      version.ipAssignmentRequired
        ? "IP assignment is required before long-term collaboration terms take effect."
        : "IP assignment is intentionally omitted from this version.",
      [
        version.confidentiality,
        version.trialIpHandling,
      ],
    ),
    build(
      "exit",
      "Exit and off-ramp",
      version.exitTerms,
      [
        version.notes,
      ],
    ),
  ]
}

export function buildProposalTimeline(proposal: Proposal, versions: ProposalVersion[]): ProposalTimelineEntry[] {
  return versions
    .filter(version => version.proposalId === proposal.id)
    .sort((left, right) => right.versionNumber - left.versionNumber)
    .map(version => ({
      id: version.id,
      versionNumber: version.versionNumber,
      summary: version.summary,
      createdByUserId: version.createdByUserId,
      createdAt: version.createdAt,
      current: version.id === proposal.currentVersionId,
    }))
}

export function buildProposalUnresolvedItems(sections: ProposalSectionSummary[]) {
  return sections.filter(section => section.state !== "agreed")
}

export function buildProposalTermsSummary(version: ProposalVersion) {
  return [
    { label: "Partnership", value: `${version.roleTitle} · ${version.relationshipType.replaceAll("_", " ")}` },
    { label: "Commitment", value: `${version.weeklyTimeCommitment}h/week · ${version.startDate}` },
    { label: "Full-time trigger", value: version.fullTimeTrigger },
    { label: "Trial", value: version.trialScope },
    { label: "Economics", value: `${version.cashCompensation} · ${version.equity}` },
    { label: "Vesting", value: `${version.vestingSchedule} · Cliff ${version.cliff}` },
    { label: "Decision rights", value: version.decisionRights },
    { label: "Trial IP handling", value: version.trialIpHandling },
  ]
}

export function getProposalStatusTone(status: ProposalStatus) {
  return ({
    draft: "neutral",
    sent: "accent",
    viewed: "accent",
    countered: "warning",
    accepted: "success",
    rejected: "danger",
  } as const)[status]
}
