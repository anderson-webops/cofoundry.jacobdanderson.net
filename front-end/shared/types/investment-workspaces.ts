import type { FileUpload } from "./domain"

export type InvestmentWorkspaceStatus = "planning" | "fundraising" | "paused" | "closed"
export type InvestmentProgramApplicationStatus = "draft" | "submitted" | "under_review" | "information_requested" | "diligence" | "committee_review" | "accepted" | "declined" | "withdrawn" | "closed"
export type InvestmentRoundStatus = "planning" | "open" | "soft_circled" | "closed" | "canceled"
export type InvestmentInstrument = "safe" | "convertible_note" | "preferred_equity" | "other"
export type InvestmentProspectKind = "angel" | "fund" | "strategic" | "accelerator" | "other"
export type InvestmentProspectStatus = "researching" | "contact_planned" | "contacted" | "meeting" | "diligence" | "passed" | "committed" | "closed"
export type InvestmentInteractionType = "note" | "email" | "call" | "meeting" | "data_room" | "term_sheet"
export type InvestmentDataRoomCategory = "pitch" | "corporate" | "financial" | "traction" | "team" | "product" | "legal" | "other"
export type InvestmentInformationRequestStatus = "open" | "answered" | "accepted" | "closed"
export type InvestmentDiligenceStatus = "open" | "in_progress" | "submitted" | "accepted" | "waived"
export type InvestmentReviewPriority = "standard" | "high" | "urgent"
export type InvestmentReviewNoteCategory = "screening" | "diligence" | "committee" | "compliance" | "partner"
export type InvestmentDecisionOutcome = "advance" | "hold" | "decline" | "refer_to_partner"
export type InvestmentPartnerType = "broker_dealer" | "funding_portal" | "counsel" | "investment_adviser" | "other"
export type InvestmentPartnerHandoffStatus = "planned" | "consent_pending" | "ready" | "sent" | "acknowledged" | "closed" | "canceled"
export type InvestmentAuditAudience = "applicant" | "staff" | "all"

export type InvestmentFileUploadSummary = Pick<FileUpload, "createdAt" | "deletedAt" | "id" | "mimeType" | "originalFilename" | "purpose" | "relatedId" | "relatedType" | "scanStatus" | "sizeBytes" | "status" | "updatedAt">

export interface InvestmentReadinessProfile {
  legalName: string
  formationJurisdiction: string
  formationComplete: boolean
  capTableCurrent: boolean
  financialsCurrent: boolean
  dataRoomReady: boolean
  counselEngaged: boolean
  fundraisingOwner: string
  targetCloseAt: string | null
  notes: string
  updatedAt: string
}

export interface InvestmentRound {
  id: string
  title: string
  instrument: InvestmentInstrument
  status: InvestmentRoundStatus
  currency: "USD"
  targetAmount: string
  minimumInvestment: string
  valuationCap: string
  discount: string
  useOfFunds: string
  openedAt: string | null
  targetCloseAt: string | null
  createdAt: string
  updatedAt: string
}

export interface InvestmentProspect {
  id: string
  kind: InvestmentProspectKind
  name: string
  firm: string
  email: string
  website: string
  status: InvestmentProspectStatus
  expectedCheckSize: string
  source: string
  notes: string
  nextStep: string
  nextStepAt: string | null
  createdAt: string
  updatedAt: string
}

export interface InvestmentInteraction {
  id: string
  prospectId: string
  type: InvestmentInteractionType
  summary: string
  occurredAt: string
  nextStep: string
  createdAt: string
}

export interface InvestmentDataRoomItem {
  id: string
  title: string
  description: string
  category: InvestmentDataRoomCategory
  externalUrl: string
  fileUploadId: string | null
  shareWithProgram: boolean
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface InvestmentApplicantAttestations {
  authorizedToSubmit: boolean
  informationAccurate: boolean
  noFundingGuarantee: boolean
  regulatedExecutionAcknowledged: boolean
  regulatedPartnerSharingConsent: boolean
}

export interface InvestmentApplicationSubmissionSnapshot {
  attestations: Omit<InvestmentApplicantAttestations, "regulatedPartnerSharingConsent">
  companySummary: string
  deckUrl: string
  fundraisingHistory: string
  instrument: InvestmentInstrument
  reason: string
  requestedAmount: string
  supplementalTermsAcceptedAt: string
  supplementalTermsVersion: string
  teamSummary: string
  traction: string
  useOfFunds: string
}

export interface InvestmentProgramApplication {
  id: string
  status: InvestmentProgramApplicationStatus
  opportunityId: string
  requestedAmount: string
  instrument: InvestmentInstrument
  companySummary: string
  traction: string
  teamSummary: string
  useOfFunds: string
  fundraisingHistory: string
  reason: string
  deckUrl: string
  supplementalTermsVersion: string | null
  supplementalTermsAcceptedAt: string | null
  submittedReadiness: InvestmentReadinessProfile | null
  submittedRounds: InvestmentRound[]
  submittedWorkspaceAt: string | null
  attestations: InvestmentApplicantAttestations
  submissionRevision: number
  submittedAt: string | null
  submittedApplication: InvestmentApplicationSubmissionSnapshot | null
  reviewedAt: string | null
  withdrawnAt: string | null
  withdrawalReason: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface InvestmentInformationRequest {
  id: string
  title: string
  request: string
  status: InvestmentInformationRequestStatus
  dueAt: string | null
  response: string | null
  respondedAt: string | null
  createdByUserId: string
  closedByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface InvestmentDiligenceItem {
  id: string
  title: string
  category: InvestmentDataRoomCategory
  description: string
  status: InvestmentDiligenceStatus
  dueAt: string | null
  response: string | null
  evidenceDataRoomItemIds: string[]
  createdByUserId: string
  resolvedByUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface InvestmentFounderUpdate {
  id: string
  title: string
  body: string
  metrics: string
  shareWithProgram: boolean
  createdAt: string
  updatedAt: string
}

export interface InvestmentReviewNote {
  id: string
  category: InvestmentReviewNoteCategory
  body: string
  createdByUserId: string
  createdAt: string
}

export interface InvestmentDecision {
  id: string
  outcome: InvestmentDecisionOutcome
  publicRationale: string
  internalRationale: string
  decidedByUserId: string
  decidedAt: string
}

export interface InvestmentPartnerHandoff {
  id: string
  partnerType: InvestmentPartnerType
  partnerName: string
  partnerUrl: string
  status: InvestmentPartnerHandoffStatus
  sharedDataRoomItemIds: string[]
  consentRecordedAt: string | null
  sentAt: string | null
  externalReference: string
  internalNotes: string
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface InvestmentReviewState {
  assignedReviewerUserId: string | null
  priority: InvestmentReviewPriority
  riskFlags: string[]
  stageSummary: string
  lastReviewedAt: string | null
}

export interface InvestmentAuditEvent {
  id: string
  actorUserId: string | null
  audience: InvestmentAuditAudience
  action: string
  targetType: string
  targetId: string
  summary: string
  createdAt: string
}

export interface InvestmentWorkspaceDocument {
  id: string
  version: number
  applicantUserId: string
  opportunityId: string
  organizationId: string | null
  companyName: string
  status: InvestmentWorkspaceStatus
  readiness: InvestmentReadinessProfile
  rounds: InvestmentRound[]
  prospects: InvestmentProspect[]
  interactions: InvestmentInteraction[]
  dataRoomItems: InvestmentDataRoomItem[]
  application: InvestmentProgramApplication
  informationRequests: InvestmentInformationRequest[]
  diligenceItems: InvestmentDiligenceItem[]
  founderUpdates: InvestmentFounderUpdate[]
  review: InvestmentReviewState
  reviewNotes: InvestmentReviewNote[]
  decisions: InvestmentDecision[]
  partnerHandoffs: InvestmentPartnerHandoff[]
  auditEvents: InvestmentAuditEvent[]
  createdAt: string
  updatedAt: string
}

export interface InvestmentApplicantSnapshot {
  fileUploads: InvestmentFileUploadSummary[]
  workspaces: InvestmentWorkspaceDocument[]
  supplementalTermsVersion: string
}

export interface InvestmentReviewerSnapshot {
  fileUploads: InvestmentFileUploadSummary[]
  reviewers: Array<{
    id: string
    name: string
  }>
  workspaces: InvestmentWorkspaceDocument[]
  supplementalTermsVersion: string
}

export type InvestmentApplicantMutation
  = | { action: "update_workspace", organizationId: string | null, status: Exclude<InvestmentWorkspaceStatus, "closed"> }
    | { action: "update_readiness", profile: Omit<InvestmentReadinessProfile, "updatedAt"> }
    | { action: "create_round", discount: string, instrument: InvestmentInstrument, minimumInvestment: string, openedAt: string | null, targetAmount: string, targetCloseAt: string | null, title: string, useOfFunds: string, valuationCap: string }
    | { action: "update_round", discount: string, instrument: InvestmentInstrument, minimumInvestment: string, openedAt: string | null, roundId: string, status: InvestmentRoundStatus, targetAmount: string, targetCloseAt: string | null, title: string, useOfFunds: string, valuationCap: string }
    | { action: "create_prospect", email: string, expectedCheckSize: string, firm: string, kind: InvestmentProspectKind, name: string, nextStep: string, nextStepAt: string | null, notes: string, source: string, status: InvestmentProspectStatus, website: string }
    | { action: "update_prospect", email: string, expectedCheckSize: string, firm: string, kind: InvestmentProspectKind, name: string, nextStep: string, nextStepAt: string | null, notes: string, prospectId: string, source: string, status: InvestmentProspectStatus, website: string }
    | { action: "record_interaction", nextStep: string, occurredAt: string, prospectId: string, summary: string, type: InvestmentInteractionType }
    | { action: "add_data_room_item", category: InvestmentDataRoomCategory, description: string, externalUrl: string, fileUploadId: string | null, shareWithProgram: boolean, title: string }
    | { action: "update_data_room_item", category: InvestmentDataRoomCategory, dataRoomItemId: string, description: string, externalUrl: string, shareWithProgram: boolean, title: string }
    | { action: "remove_data_room_item", dataRoomItemId: string }
    | { action: "update_application", companySummary: string, deckUrl: string, fundraisingHistory: string, instrument: InvestmentInstrument, reason: string, requestedAmount: string, teamSummary: string, traction: string, useOfFunds: string }
    | { action: "accept_supplemental_terms", attestations: Omit<InvestmentApplicantAttestations, "regulatedPartnerSharingConsent"> }
    | { action: "set_partner_sharing_consent", consent: boolean }
    | { action: "submit_application" }
    | { action: "withdraw_application", reason: string }
    | { action: "respond_information_request", informationRequestId: string, response: string }
    | { action: "respond_diligence_item", diligenceItemId: string, evidenceDataRoomItemIds: string[], response: string, status: "in_progress" | "submitted" }
    | { action: "publish_founder_update", body: string, metrics: string, shareWithProgram: boolean, title: string }
    | { action: "update_founder_update", body: string, founderUpdateId: string, metrics: string, shareWithProgram: boolean, title: string }

export type InvestmentReviewerMutation
  = | { action: "assign_reviewer", reviewerUserId: string | null }
    | { action: "update_review", priority: InvestmentReviewPriority, riskFlags: string[], stageSummary: string }
    | { action: "set_application_status", status: Exclude<InvestmentProgramApplicationStatus, "accepted" | "declined" | "draft" | "withdrawn"> }
    | { action: "request_information", dueAt: string | null, request: string, title: string }
    | { action: "close_information_request", informationRequestId: string, status: "accepted" | "closed" }
    | { action: "create_diligence_item", category: InvestmentDataRoomCategory, description: string, dueAt: string | null, title: string }
    | { action: "resolve_diligence_item", diligenceItemId: string, status: "accepted" | "waived" }
    | { action: "add_review_note", body: string, category: InvestmentReviewNoteCategory }
    | { action: "record_decision", internalRationale: string, outcome: InvestmentDecisionOutcome, publicRationale: string }
    | { action: "create_partner_handoff", internalNotes: string, partnerName: string, partnerType: InvestmentPartnerType, partnerUrl: string, sharedDataRoomItemIds: string[] }
    | { action: "update_partner_handoff", externalReference: string, handoffId: string, internalNotes: string, sharedDataRoomItemIds: string[], status: InvestmentPartnerHandoffStatus }

export interface InvestmentApplicantMutationEnvelope {
  expectedVersion: number
  mutation: InvestmentApplicantMutation
}

export interface InvestmentReviewerMutationEnvelope {
  expectedVersion: number
  mutation: InvestmentReviewerMutation
}
