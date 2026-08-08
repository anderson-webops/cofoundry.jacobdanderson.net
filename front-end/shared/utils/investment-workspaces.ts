import type { FileUpload, SessionUser } from "../types/domain"
import type {
  InvestmentApplicantMutation,
  InvestmentAuditAudience,
  InvestmentDataRoomItem,
  InvestmentFileUploadSummary,
  InvestmentPartnerHandoffStatus,
  InvestmentProgramApplicationStatus,
  InvestmentReviewerMutation,
  InvestmentWorkspaceDocument,
} from "../types/investment-workspaces"
import { cloneValue } from "./clone"

export const investmentSupplementalTermsVersion = "2026-08-08"

export class InvestmentTransitionError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
    this.name = "InvestmentTransitionError"
  }
}

interface TransitionOptions {
  createId: (prefix: string) => string
  now: string
}

interface CreateInvestmentWorkspaceInput {
  companyName: string
  opportunityId: string
  organizationId: string | null
}

const reviewerVisibleApplicationStatuses = new Set<InvestmentProgramApplicationStatus>([
  "submitted",
  "under_review",
  "information_requested",
  "diligence",
  "committee_review",
  "accepted",
  "declined",
  "closed",
])

const reviewerStatusTransitions: Record<InvestmentProgramApplicationStatus, ReadonlySet<InvestmentProgramApplicationStatus>> = {
  accepted: new Set(["closed"]),
  closed: new Set(),
  committee_review: new Set(["diligence", "information_requested", "accepted", "declined"]),
  declined: new Set(["closed"]),
  diligence: new Set(["information_requested", "committee_review", "accepted", "declined"]),
  draft: new Set(),
  information_requested: new Set(["under_review", "diligence", "committee_review", "declined"]),
  submitted: new Set(["under_review", "information_requested", "diligence", "declined"]),
  under_review: new Set(["information_requested", "diligence", "committee_review", "accepted", "declined"]),
  withdrawn: new Set(["closed"]),
}

const handoffStatusTransitions: Record<InvestmentPartnerHandoffStatus, ReadonlySet<InvestmentPartnerHandoffStatus>> = {
  acknowledged: new Set(["closed"]),
  canceled: new Set(),
  closed: new Set(),
  consent_pending: new Set(["ready", "canceled"]),
  planned: new Set(["consent_pending", "ready", "canceled"]),
  ready: new Set(["sent", "canceled"]),
  sent: new Set(["acknowledged", "closed"]),
}

function fail(message: string, statusCode = 400): never {
  throw new InvestmentTransitionError(message, statusCode)
}

function requireApplicant(document: InvestmentWorkspaceDocument, session: Pick<SessionUser, "id">) {
  if (document.applicantUserId !== session.id)
    fail("You do not have access to this investment workspace.", 403)
}

function requireReviewer(session: Pick<SessionUser, "role">) {
  if (!["admin", "investor_admin"].includes(session.role))
    fail("Investment-review access is required for this action.", 403)
}

function audit(
  document: InvestmentWorkspaceDocument,
  actorUserId: string | null,
  audience: InvestmentAuditAudience,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
  options: TransitionOptions,
) {
  document.auditEvents.unshift({
    action,
    actorUserId,
    audience,
    createdAt: options.now,
    id: options.createId("investment_audit"),
    summary,
    targetId,
    targetType,
  })
  document.auditEvents = document.auditEvents.slice(0, 1000)
}

function finish(document: InvestmentWorkspaceDocument, options: TransitionOptions) {
  document.version += 1
  document.updatedAt = options.now
  document.auditEvents = document.auditEvents.slice(0, 1000)
  return document
}

function requireMutableApplication(document: InvestmentWorkspaceDocument) {
  if (!["draft", "information_requested"].includes(document.application.status))
    fail("Application fields can be edited only while drafting or responding to an information request.", 409)
}

function requireDataRoomItem(document: InvestmentWorkspaceDocument, itemId: string) {
  const item = document.dataRoomItems.find(candidate => candidate.id === itemId)
  if (!item)
    fail("Data-room item not found.", 404)
  return item
}

function requireProgramSharedDataRoomItems(document: InvestmentWorkspaceDocument, itemIds: string[]) {
  const uniqueIds = Array.from(new Set(itemIds))
  const sharedIds = new Set(document.dataRoomItems.filter(item => item.shareWithProgram).map(item => item.id))
  if (uniqueIds.some(id => !sharedIds.has(id)))
    fail("Partner handoffs may include only data-room items explicitly shared with the program.", 409)
  return uniqueIds
}

function validateApplicationReady(document: InvestmentWorkspaceDocument) {
  const application = document.application
  const requiredText = [
    application.requestedAmount,
    application.companySummary,
    application.traction,
    application.teamSummary,
    application.useOfFunds,
    application.fundraisingHistory,
    application.reason,
    application.deckUrl,
  ]
  if (requiredText.some(value => !value.trim()))
    fail("Complete every required program application field before submitting.", 409)
  if (application.supplementalTermsVersion !== investmentSupplementalTermsVersion || !application.supplementalTermsAcceptedAt)
    fail("Accept the current investment supplemental terms before submitting.", 409)
  const attestations = application.attestations
  if (!attestations.authorizedToSubmit || !attestations.informationAccurate || !attestations.noFundingGuarantee || !attestations.regulatedExecutionAcknowledged)
    fail("Complete all required application attestations before submitting.", 409)
}

function captureApplicationSubmission(document: InvestmentWorkspaceDocument) {
  const application = document.application
  return {
    attestations: {
      authorizedToSubmit: application.attestations.authorizedToSubmit,
      informationAccurate: application.attestations.informationAccurate,
      noFundingGuarantee: application.attestations.noFundingGuarantee,
      regulatedExecutionAcknowledged: application.attestations.regulatedExecutionAcknowledged,
    },
    companySummary: application.companySummary,
    deckUrl: application.deckUrl,
    fundraisingHistory: application.fundraisingHistory,
    instrument: application.instrument,
    reason: application.reason,
    requestedAmount: application.requestedAmount,
    supplementalTermsAcceptedAt: application.supplementalTermsAcceptedAt!,
    supplementalTermsVersion: application.supplementalTermsVersion!,
    teamSummary: application.teamSummary,
    traction: application.traction,
    useOfFunds: application.useOfFunds,
  }
}

function transitionApplicationStatus(
  document: InvestmentWorkspaceDocument,
  status: InvestmentProgramApplicationStatus,
  options: TransitionOptions,
) {
  const current = document.application.status
  if (current === status)
    fail(`The application is already ${status.replaceAll("_", " ")}.`, 409)
  if (!reviewerStatusTransitions[current].has(status))
    fail(`The application cannot move from ${current.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}.`, 409)

  document.application.status = status
  document.application.updatedAt = options.now
  if (["accepted", "declined"].includes(status))
    document.application.reviewedAt = options.now
  if (status === "closed")
    document.application.closedAt = options.now
}

export function createInvestmentWorkspaceDocument(
  session: SessionUser,
  input: CreateInvestmentWorkspaceInput,
  options: TransitionOptions,
): InvestmentWorkspaceDocument {
  const workspaceId = options.createId("investment_workspace")
  const applicationId = options.createId("investment_application")
  const document: InvestmentWorkspaceDocument = {
    applicantUserId: session.id,
    application: {
      attestations: {
        authorizedToSubmit: false,
        informationAccurate: false,
        noFundingGuarantee: false,
        regulatedExecutionAcknowledged: false,
        regulatedPartnerSharingConsent: false,
      },
      closedAt: null,
      companySummary: "",
      createdAt: options.now,
      deckUrl: "",
      fundraisingHistory: "",
      id: applicationId,
      instrument: "safe",
      opportunityId: input.opportunityId,
      reason: "",
      requestedAmount: "",
      reviewedAt: null,
      status: "draft",
      submissionRevision: 0,
      submittedAt: null,
      submittedApplication: null,
      submittedReadiness: null,
      submittedRounds: [],
      submittedWorkspaceAt: null,
      supplementalTermsAcceptedAt: null,
      supplementalTermsVersion: null,
      teamSummary: "",
      traction: "",
      updatedAt: options.now,
      useOfFunds: "",
      withdrawalReason: null,
      withdrawnAt: null,
    },
    auditEvents: [],
    companyName: input.companyName,
    createdAt: options.now,
    dataRoomItems: [],
    decisions: [],
    diligenceItems: [],
    founderUpdates: [],
    id: workspaceId,
    informationRequests: [],
    interactions: [],
    opportunityId: input.opportunityId,
    organizationId: input.organizationId,
    partnerHandoffs: [],
    prospects: [],
    readiness: {
      capTableCurrent: false,
      counselEngaged: false,
      dataRoomReady: false,
      financialsCurrent: false,
      formationComplete: false,
      formationJurisdiction: "",
      fundraisingOwner: session.name,
      legalName: input.companyName,
      notes: "",
      targetCloseAt: null,
      updatedAt: options.now,
    },
    review: {
      assignedReviewerUserId: null,
      lastReviewedAt: null,
      priority: "standard",
      riskFlags: [],
      stageSummary: "",
    },
    reviewNotes: [],
    rounds: [],
    status: "planning",
    updatedAt: options.now,
    version: 1,
  }
  audit(document, session.id, "all", "investment.workspace_created", "investment_workspace", workspaceId, `${session.name} created the ${input.companyName} fundraising workspace.`, options)
  return document
}

export function projectInvestmentWorkspaceForApplicant(
  source: InvestmentWorkspaceDocument,
  applicantUserId: string,
) {
  if (source.applicantUserId !== applicantUserId)
    return null

  const document = cloneValue(source)
  document.review = {
    assignedReviewerUserId: null,
    lastReviewedAt: document.review.lastReviewedAt,
    priority: "standard",
    riskFlags: [],
    stageSummary: "",
  }
  document.reviewNotes = []
  document.decisions = document.decisions.map(decision => ({
    ...decision,
    decidedByUserId: "",
    internalRationale: "",
  }))
  document.partnerHandoffs = document.partnerHandoffs.map(handoff => ({
    ...handoff,
    createdByUserId: "",
    internalNotes: "",
  }))
  document.informationRequests = document.informationRequests.map(request => ({
    ...request,
    closedByUserId: null,
    createdByUserId: "",
  }))
  document.diligenceItems = document.diligenceItems.map(item => ({
    ...item,
    createdByUserId: "",
    resolvedByUserId: null,
  }))
  document.auditEvents = document.auditEvents
    .filter(event => event.audience === "applicant" || event.audience === "all")
    .map(event => ({
      ...event,
      actorUserId: event.actorUserId === applicantUserId ? applicantUserId : null,
    }))
  return document
}

export function projectInvestmentFileUpload(source: FileUpload): InvestmentFileUploadSummary {
  return {
    createdAt: source.createdAt,
    deletedAt: source.deletedAt,
    id: source.id,
    mimeType: source.mimeType,
    originalFilename: source.originalFilename,
    purpose: source.purpose,
    relatedId: source.relatedId,
    relatedType: source.relatedType,
    scanStatus: source.scanStatus,
    sizeBytes: source.sizeBytes,
    status: source.status,
    updatedAt: source.updatedAt,
  }
}

export function projectInvestmentWorkspaceForReviewer(source: InvestmentWorkspaceDocument) {
  if (!reviewerVisibleApplicationStatuses.has(source.application.status))
    return null

  const document = cloneValue(source)
  const submittedApplication = document.application.submittedApplication
  if (submittedApplication) {
    Object.assign(document.application, submittedApplication, {
      attestations: {
        ...submittedApplication.attestations,
        regulatedPartnerSharingConsent: document.application.attestations.regulatedPartnerSharingConsent,
      },
    })
  }
  else {
    Object.assign(document.application, {
      attestations: {
        authorizedToSubmit: false,
        informationAccurate: false,
        noFundingGuarantee: false,
        regulatedExecutionAcknowledged: false,
        regulatedPartnerSharingConsent: document.application.attestations.regulatedPartnerSharingConsent,
      },
      companySummary: "",
      deckUrl: "",
      fundraisingHistory: "",
      instrument: "safe",
      reason: "",
      requestedAmount: "",
      supplementalTermsAcceptedAt: null,
      supplementalTermsVersion: null,
      teamSummary: "",
      traction: "",
      useOfFunds: "",
    })
  }
  document.readiness = document.application.submittedReadiness
    ? cloneValue(document.application.submittedReadiness)
    : {
        capTableCurrent: false,
        counselEngaged: false,
        dataRoomReady: false,
        financialsCurrent: false,
        formationComplete: false,
        formationJurisdiction: "",
        fundraisingOwner: "",
        legalName: "",
        notes: "",
        targetCloseAt: null,
        updatedAt: document.application.submittedAt || document.application.createdAt,
      }
  document.rounds = cloneValue(document.application.submittedRounds)
  document.prospects = []
  document.interactions = []
  document.dataRoomItems = document.dataRoomItems.filter(item => item.shareWithProgram)
  const visibleDataRoomIds = new Set(document.dataRoomItems.map(item => item.id))
  document.founderUpdates = document.founderUpdates.filter(item => item.shareWithProgram)
  const visibleFounderUpdateIds = new Set(document.founderUpdates.map(item => item.id))
  document.diligenceItems = document.diligenceItems.map(item => ({
    ...item,
    evidenceDataRoomItemIds: item.evidenceDataRoomItemIds.filter(id => visibleDataRoomIds.has(id)),
  }))
  document.partnerHandoffs = document.partnerHandoffs.map(handoff => ({
    ...handoff,
    sharedDataRoomItemIds: handoff.sharedDataRoomItemIds.filter(id => visibleDataRoomIds.has(id)),
  }))
  document.auditEvents = document.auditEvents.filter((event) => {
    if (event.audience !== "staff" && event.audience !== "all")
      return false
    if (event.targetType === "investment_data_room_item")
      return visibleDataRoomIds.has(event.targetId)
    if (event.targetType === "investment_founder_update")
      return visibleFounderUpdateIds.has(event.targetId)
    return true
  })
  return document
}

export function applyInvestmentApplicantMutation(
  source: InvestmentWorkspaceDocument,
  session: SessionUser,
  mutation: InvestmentApplicantMutation,
  options: TransitionOptions,
) {
  const document = cloneValue(source)
  requireApplicant(document, session)
  if (document.status === "closed")
    fail("This investment workspace is closed.", 409)

  switch (mutation.action) {
    case "update_workspace": {
      document.organizationId = mutation.organizationId
      document.status = mutation.status
      audit(document, session.id, "all", "investment.workspace_updated", "investment_workspace", document.id, `${session.name} updated fundraising workspace settings.`, options)
      break
    }
    case "update_readiness": {
      document.readiness = { ...mutation.profile, updatedAt: options.now }
      audit(document, session.id, "applicant", "investment.readiness_updated", "investment_workspace", document.id, `${session.name} updated fundraising readiness.`, options)
      break
    }
    case "create_round": {
      const id = options.createId("investment_round")
      document.rounds.unshift({
        createdAt: options.now,
        currency: "USD",
        discount: mutation.discount,
        id,
        instrument: mutation.instrument,
        minimumInvestment: mutation.minimumInvestment,
        openedAt: mutation.openedAt,
        status: mutation.openedAt ? "open" : "planning",
        targetAmount: mutation.targetAmount,
        targetCloseAt: mutation.targetCloseAt,
        title: mutation.title,
        updatedAt: options.now,
        useOfFunds: mutation.useOfFunds,
        valuationCap: mutation.valuationCap,
      })
      document.status = mutation.openedAt ? "fundraising" : document.status
      audit(document, session.id, "applicant", "investment.round_created", "investment_round", id, `${session.name} created ${mutation.title}.`, options)
      break
    }
    case "update_round": {
      const round = document.rounds.find(item => item.id === mutation.roundId)
      if (!round)
        fail("Fundraising round not found.", 404)
      Object.assign(round, {
        discount: mutation.discount,
        instrument: mutation.instrument,
        minimumInvestment: mutation.minimumInvestment,
        openedAt: mutation.openedAt,
        status: mutation.status,
        targetAmount: mutation.targetAmount,
        targetCloseAt: mutation.targetCloseAt,
        title: mutation.title,
        updatedAt: options.now,
        useOfFunds: mutation.useOfFunds,
        valuationCap: mutation.valuationCap,
      })
      audit(document, session.id, "applicant", "investment.round_updated", "investment_round", round.id, `${session.name} updated ${round.title}.`, options)
      break
    }
    case "create_prospect": {
      const id = options.createId("investment_prospect")
      document.prospects.unshift({
        createdAt: options.now,
        email: mutation.email,
        expectedCheckSize: mutation.expectedCheckSize,
        firm: mutation.firm,
        id,
        kind: mutation.kind,
        name: mutation.name,
        nextStep: mutation.nextStep,
        nextStepAt: mutation.nextStepAt,
        notes: mutation.notes,
        source: mutation.source,
        status: mutation.status,
        updatedAt: options.now,
        website: mutation.website,
      })
      audit(document, session.id, "applicant", "investment.prospect_created", "investment_prospect", id, `${session.name} added ${mutation.name || mutation.firm} to the private outreach pipeline.`, options)
      break
    }
    case "update_prospect": {
      const prospect = document.prospects.find(item => item.id === mutation.prospectId)
      if (!prospect)
        fail("Investor prospect not found.", 404)
      Object.assign(prospect, {
        email: mutation.email,
        expectedCheckSize: mutation.expectedCheckSize,
        firm: mutation.firm,
        kind: mutation.kind,
        name: mutation.name,
        nextStep: mutation.nextStep,
        nextStepAt: mutation.nextStepAt,
        notes: mutation.notes,
        source: mutation.source,
        status: mutation.status,
        updatedAt: options.now,
        website: mutation.website,
      })
      audit(document, session.id, "applicant", "investment.prospect_updated", "investment_prospect", prospect.id, `${session.name} updated the private outreach record for ${prospect.name || prospect.firm}.`, options)
      break
    }
    case "record_interaction": {
      if (!document.prospects.some(item => item.id === mutation.prospectId))
        fail("Investor prospect not found.", 404)
      const id = options.createId("investment_interaction")
      document.interactions.unshift({
        createdAt: options.now,
        id,
        nextStep: mutation.nextStep,
        occurredAt: mutation.occurredAt,
        prospectId: mutation.prospectId,
        summary: mutation.summary,
        type: mutation.type,
      })
      audit(document, session.id, "applicant", "investment.interaction_recorded", "investment_interaction", id, `${session.name} recorded a private fundraising interaction.`, options)
      break
    }
    case "add_data_room_item": {
      if (!mutation.externalUrl && !mutation.fileUploadId)
        fail("Add either a secure link or an uploaded file.")
      const id = options.createId("investment_data_room_item")
      const item: InvestmentDataRoomItem = {
        category: mutation.category,
        createdAt: options.now,
        createdByUserId: session.id,
        description: mutation.description,
        externalUrl: mutation.externalUrl,
        fileUploadId: mutation.fileUploadId,
        id,
        shareWithProgram: mutation.shareWithProgram,
        title: mutation.title,
        updatedAt: options.now,
      }
      document.dataRoomItems.unshift(item)
      audit(document, session.id, mutation.shareWithProgram ? "all" : "applicant", "investment.data_room_item_added", "investment_data_room_item", id, `${session.name} added ${item.title} to the data room.`, options)
      break
    }
    case "update_data_room_item": {
      const item = requireDataRoomItem(document, mutation.dataRoomItemId)
      const transmittedHandoff = document.partnerHandoffs.find(handoff => ["sent", "acknowledged", "closed"].includes(handoff.status) && handoff.sharedDataRoomItemIds.includes(item.id))
      if (transmittedHandoff)
        fail("Data-room records included in a sent partner handoff are immutable. Add a new record for later changes.", 409)
      if (!mutation.externalUrl && !item.fileUploadId)
        fail("Keep either a secure link or an uploaded file on the data-room record.")
      if (!mutation.shareWithProgram && document.partnerHandoffs.some(handoff => !["canceled", "closed"].includes(handoff.status) && handoff.sharedDataRoomItemIds.includes(item.id)))
        fail("Remove this item from active partner handoffs before making it private.", 409)
      Object.assign(item, {
        category: mutation.category,
        description: mutation.description,
        externalUrl: mutation.externalUrl,
        shareWithProgram: mutation.shareWithProgram,
        title: mutation.title,
        updatedAt: options.now,
      })
      audit(document, session.id, mutation.shareWithProgram ? "all" : "applicant", "investment.data_room_item_updated", "investment_data_room_item", item.id, `${session.name} updated ${item.title}.`, options)
      break
    }
    case "remove_data_room_item": {
      const item = requireDataRoomItem(document, mutation.dataRoomItemId)
      const isReferenced = document.diligenceItems.some(diligence => diligence.evidenceDataRoomItemIds.includes(item.id))
        || document.partnerHandoffs.some(handoff => handoff.sharedDataRoomItemIds.includes(item.id))
      if (isReferenced)
        fail("Remove this item from diligence and partner handoff records before deleting it.", 409)
      document.dataRoomItems = document.dataRoomItems.filter(candidate => candidate.id !== item.id)
      audit(document, session.id, item.shareWithProgram ? "all" : "applicant", "investment.data_room_item_removed", "investment_data_room_item", item.id, `${session.name} removed ${item.title} from the data room.`, options)
      break
    }
    case "update_application": {
      requireMutableApplication(document)
      Object.assign(document.application, {
        companySummary: mutation.companySummary,
        deckUrl: mutation.deckUrl,
        fundraisingHistory: mutation.fundraisingHistory,
        instrument: mutation.instrument,
        reason: mutation.reason,
        requestedAmount: mutation.requestedAmount,
        teamSummary: mutation.teamSummary,
        traction: mutation.traction,
        updatedAt: options.now,
        useOfFunds: mutation.useOfFunds,
      })
      audit(document, session.id, "applicant", "investment.application_updated", "investment_application", document.application.id, `${session.name} updated the program application draft.`, options)
      break
    }
    case "accept_supplemental_terms": {
      requireMutableApplication(document)
      const required = mutation.attestations
      if (!required.authorizedToSubmit || !required.informationAccurate || !required.noFundingGuarantee || !required.regulatedExecutionAcknowledged)
        fail("All required supplemental-term attestations must be accepted.")
      document.application.attestations = {
        ...document.application.attestations,
        ...required,
      }
      document.application.supplementalTermsAcceptedAt = options.now
      document.application.supplementalTermsVersion = investmentSupplementalTermsVersion
      document.application.updatedAt = options.now
      audit(document, session.id, "applicant", "investment.supplemental_terms_accepted", "investment_application", document.application.id, `${session.name} accepted investment supplemental terms ${investmentSupplementalTermsVersion}.`, options)
      break
    }
    case "set_partner_sharing_consent": {
      document.application.attestations.regulatedPartnerSharingConsent = mutation.consent
      document.application.updatedAt = options.now
      if (!mutation.consent) {
        document.partnerHandoffs = document.partnerHandoffs.map(handoff => ["planned", "ready"].includes(handoff.status)
          ? { ...handoff, status: "consent_pending", updatedAt: options.now }
          : handoff)
      }
      audit(document, session.id, "all", mutation.consent ? "investment.partner_sharing_consented" : "investment.partner_sharing_revoked", "investment_application", document.application.id, mutation.consent ? `${session.name} consented to a separately approved regulated-partner handoff.` : `${session.name} withdrew consent for future regulated-partner sharing.`, options)
      break
    }
    case "submit_application": {
      if (!["draft", "information_requested"].includes(document.application.status))
        fail("This application cannot be submitted from its current status.", 409)
      validateApplicationReady(document)
      document.application.status = "submitted"
      document.application.submissionRevision += 1
      document.application.submittedAt = options.now
      document.application.submittedApplication = captureApplicationSubmission(document)
      document.application.submittedReadiness = cloneValue(document.readiness)
      document.application.submittedRounds = cloneValue(document.rounds)
      document.application.submittedWorkspaceAt = options.now
      document.application.updatedAt = options.now
      document.status = "fundraising"
      audit(document, session.id, "all", "investment.application_submitted", "investment_application", document.application.id, `${session.name} submitted revision ${document.application.submissionRevision} for program review.`, options)
      break
    }
    case "withdraw_application": {
      if (!["submitted", "under_review", "information_requested", "diligence", "committee_review"].includes(document.application.status))
        fail("This application cannot be withdrawn from its current status.", 409)
      document.application.status = "withdrawn"
      document.application.withdrawalReason = mutation.reason
      document.application.withdrawnAt = options.now
      document.application.updatedAt = options.now
      document.partnerHandoffs = document.partnerHandoffs.map((handoff) => {
        if (["planned", "consent_pending", "ready"].includes(handoff.status))
          return { ...handoff, status: "canceled", updatedAt: options.now }
        if (["sent", "acknowledged"].includes(handoff.status))
          return { ...handoff, status: "closed", updatedAt: options.now }
        return handoff
      })
      audit(document, session.id, "all", "investment.application_withdrawn", "investment_application", document.application.id, `${session.name} withdrew the program application.`, options)
      break
    }
    case "respond_information_request": {
      const request = document.informationRequests.find(item => item.id === mutation.informationRequestId)
      if (!request || request.status !== "open")
        fail("This information request is no longer open.", 409)
      request.response = mutation.response
      request.respondedAt = options.now
      request.status = "answered"
      request.updatedAt = options.now
      audit(document, session.id, "all", "investment.information_request_answered", "investment_information_request", request.id, `${session.name} answered ${request.title}.`, options)
      break
    }
    case "respond_diligence_item": {
      const item = document.diligenceItems.find(candidate => candidate.id === mutation.diligenceItemId)
      if (!item || !["open", "in_progress", "submitted"].includes(item.status))
        fail("This diligence item is no longer open.", 409)
      const evidenceIds = Array.from(new Set(mutation.evidenceDataRoomItemIds))
      if (evidenceIds.some(id => !document.dataRoomItems.some(dataRoomItem => dataRoomItem.id === id && dataRoomItem.shareWithProgram)))
        fail("Diligence evidence must be explicitly shared with the program.", 409)
      item.evidenceDataRoomItemIds = evidenceIds
      item.response = mutation.response
      item.status = mutation.status
      item.updatedAt = options.now
      audit(document, session.id, "all", "investment.diligence_response_updated", "investment_diligence_item", item.id, `${session.name} updated ${item.title}.`, options)
      break
    }
    case "publish_founder_update": {
      const id = options.createId("investment_founder_update")
      document.founderUpdates.unshift({
        body: mutation.body,
        createdAt: options.now,
        id,
        metrics: mutation.metrics,
        shareWithProgram: mutation.shareWithProgram,
        title: mutation.title,
        updatedAt: options.now,
      })
      audit(document, session.id, mutation.shareWithProgram ? "all" : "applicant", "investment.founder_update_published", "investment_founder_update", id, `${session.name} published ${mutation.title}.`, options)
      break
    }
    case "update_founder_update": {
      const update = document.founderUpdates.find(item => item.id === mutation.founderUpdateId)
      if (!update)
        fail("Founder update not found.", 404)
      Object.assign(update, {
        body: mutation.body,
        metrics: mutation.metrics,
        shareWithProgram: mutation.shareWithProgram,
        title: mutation.title,
        updatedAt: options.now,
      })
      audit(document, session.id, mutation.shareWithProgram ? "all" : "applicant", "investment.founder_update_updated", "investment_founder_update", update.id, `${session.name} updated ${update.title}.`, options)
      break
    }
  }

  return finish(document, options)
}

export function applyInvestmentReviewerMutation(
  source: InvestmentWorkspaceDocument,
  session: SessionUser,
  mutation: InvestmentReviewerMutation,
  options: TransitionOptions,
) {
  const document = cloneValue(source)
  requireReviewer(session)
  if (!reviewerVisibleApplicationStatuses.has(document.application.status))
    fail("Draft or withdrawn applications are not available for staff review.", 404)

  switch (mutation.action) {
    case "assign_reviewer": {
      document.review.assignedReviewerUserId = mutation.reviewerUserId
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "staff", "investment.reviewer_assigned", "investment_workspace", document.id, mutation.reviewerUserId ? `${session.name} assigned the review case.` : `${session.name} returned the case to the shared queue.`, options)
      break
    }
    case "update_review": {
      document.review.priority = mutation.priority
      document.review.riskFlags = Array.from(new Set(mutation.riskFlags))
      document.review.stageSummary = mutation.stageSummary
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "staff", "investment.review_updated", "investment_workspace", document.id, `${session.name} updated the staff review summary.`, options)
      break
    }
    case "set_application_status": {
      if (["accepted", "declined"].includes(mutation.status))
        fail("Record an applicant-facing and internal decision rationale for accepted or declined outcomes.", 409)
      transitionApplicationStatus(document, mutation.status, options)
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "all", "investment.application_status_updated", "investment_application", document.application.id, `Program review moved the application to ${mutation.status.replaceAll("_", " ")}.`, options)
      break
    }
    case "request_information": {
      if (!["submitted", "under_review", "diligence", "committee_review", "information_requested"].includes(document.application.status))
        fail("Information cannot be requested from this application state.", 409)
      const id = options.createId("investment_information_request")
      document.informationRequests.unshift({
        closedByUserId: null,
        createdAt: options.now,
        createdByUserId: session.id,
        dueAt: mutation.dueAt,
        id,
        request: mutation.request,
        respondedAt: null,
        response: null,
        status: "open",
        title: mutation.title,
        updatedAt: options.now,
      })
      if (document.application.status !== "information_requested") {
        document.application.status = "information_requested"
        document.application.updatedAt = options.now
      }
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "all", "investment.information_requested", "investment_information_request", id, `Program review requested ${mutation.title}.`, options)
      break
    }
    case "close_information_request": {
      const request = document.informationRequests.find(item => item.id === mutation.informationRequestId)
      if (!request || !["open", "answered"].includes(request.status))
        fail("This information request is already closed.", 409)
      request.closedByUserId = session.id
      request.status = mutation.status
      request.updatedAt = options.now
      audit(document, session.id, "all", "investment.information_request_closed", "investment_information_request", request.id, `Program review marked ${request.title} ${mutation.status}.`, options)
      break
    }
    case "create_diligence_item": {
      if (!["under_review", "information_requested", "diligence", "committee_review"].includes(document.application.status))
        fail("Diligence cannot begin from this application state.", 409)
      const id = options.createId("investment_diligence_item")
      document.diligenceItems.unshift({
        category: mutation.category,
        createdAt: options.now,
        createdByUserId: session.id,
        description: mutation.description,
        dueAt: mutation.dueAt,
        evidenceDataRoomItemIds: [],
        id,
        resolvedByUserId: null,
        response: null,
        status: "open",
        title: mutation.title,
        updatedAt: options.now,
      })
      if (document.application.status !== "diligence") {
        document.application.status = "diligence"
        document.application.updatedAt = options.now
      }
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "all", "investment.diligence_item_created", "investment_diligence_item", id, `Program review opened ${mutation.title}.`, options)
      break
    }
    case "resolve_diligence_item": {
      const item = document.diligenceItems.find(candidate => candidate.id === mutation.diligenceItemId)
      if (!item || !["open", "in_progress", "submitted"].includes(item.status))
        fail("This diligence item is already resolved.", 409)
      item.resolvedByUserId = session.id
      item.status = mutation.status
      item.updatedAt = options.now
      audit(document, session.id, "all", "investment.diligence_item_resolved", "investment_diligence_item", item.id, `Program review marked ${item.title} ${mutation.status}.`, options)
      break
    }
    case "add_review_note": {
      const id = options.createId("investment_review_note")
      document.reviewNotes.unshift({
        body: mutation.body,
        category: mutation.category,
        createdAt: options.now,
        createdByUserId: session.id,
        id,
      })
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "staff", "investment.review_note_added", "investment_review_note", id, `${session.name} added an internal ${mutation.category} note.`, options)
      break
    }
    case "record_decision": {
      if (!["submitted", "under_review", "information_requested", "diligence", "committee_review"].includes(document.application.status))
        fail("A new program decision cannot be recorded from this application state.", 409)
      const id = options.createId("investment_decision")
      document.decisions.unshift({
        decidedAt: options.now,
        decidedByUserId: session.id,
        id,
        internalRationale: mutation.internalRationale,
        outcome: mutation.outcome,
        publicRationale: mutation.publicRationale,
      })
      if (mutation.outcome === "advance" && ["submitted", "under_review", "information_requested", "diligence"].includes(document.application.status))
        document.application.status = "committee_review"
      else if (mutation.outcome === "decline")
        document.application.status = "declined"
      else if (mutation.outcome === "refer_to_partner")
        document.application.status = "accepted"
      document.application.updatedAt = options.now
      if (["decline", "refer_to_partner"].includes(mutation.outcome))
        document.application.reviewedAt = options.now
      document.review.lastReviewedAt = options.now
      audit(document, session.id, "all", "investment.decision_recorded", "investment_decision", id, mutation.outcome === "refer_to_partner" ? "The application was accepted for next-stage regulated-partner preparation; this is not a funding commitment." : `Program review recorded a ${mutation.outcome.replaceAll("_", " ")} decision.`, options)
      break
    }
    case "create_partner_handoff": {
      if (!document.application.attestations.regulatedPartnerSharingConsent)
        fail("The applicant must provide separate regulated-partner sharing consent before a handoff can be prepared.", 409)
      if (!["accepted", "committee_review"].includes(document.application.status))
        fail("Partner handoff preparation is available only after committee or next-stage acceptance.", 409)
      const sharedDataRoomItemIds = requireProgramSharedDataRoomItems(document, mutation.sharedDataRoomItemIds)
      const id = options.createId("investment_partner_handoff")
      document.partnerHandoffs.unshift({
        consentRecordedAt: options.now,
        createdAt: options.now,
        createdByUserId: session.id,
        externalReference: "",
        id,
        internalNotes: mutation.internalNotes,
        partnerName: mutation.partnerName,
        partnerType: mutation.partnerType,
        partnerUrl: mutation.partnerUrl,
        sentAt: null,
        sharedDataRoomItemIds,
        status: "ready",
        updatedAt: options.now,
      })
      audit(document, session.id, "all", "investment.partner_handoff_created", "investment_partner_handoff", id, `Program review prepared a consented handoff to ${mutation.partnerName}. No securities transaction occurs in CoFoundry.`, options)
      break
    }
    case "update_partner_handoff": {
      const handoff = document.partnerHandoffs.find(item => item.id === mutation.handoffId)
      if (!handoff)
        fail("Partner handoff not found.", 404)
      if (handoff.status !== mutation.status && !handoffStatusTransitions[handoff.status].has(mutation.status))
        fail(`The handoff cannot move from ${handoff.status.replaceAll("_", " ")} to ${mutation.status.replaceAll("_", " ")}.`, 409)
      const selectedItemsChanged = handoff.sharedDataRoomItemIds.length !== new Set(mutation.sharedDataRoomItemIds).size
        || handoff.sharedDataRoomItemIds.some(id => !mutation.sharedDataRoomItemIds.includes(id))
      if (["sent", "acknowledged", "closed", "canceled"].includes(handoff.status) && selectedItemsChanged)
        fail("Records selected for a sent or final handoff cannot be changed.", 409)
      if (["ready", "sent"].includes(mutation.status) && !document.application.attestations.regulatedPartnerSharingConsent)
        fail("Current regulated-partner sharing consent is required before this handoff can proceed.", 409)
      handoff.externalReference = mutation.externalReference
      handoff.internalNotes = mutation.internalNotes
      handoff.sharedDataRoomItemIds = requireProgramSharedDataRoomItems(document, mutation.sharedDataRoomItemIds)
      handoff.status = mutation.status
      handoff.updatedAt = options.now
      if (mutation.status === "sent" && !handoff.sentAt)
        handoff.sentAt = options.now
      audit(document, session.id, "all", "investment.partner_handoff_updated", "investment_partner_handoff", handoff.id, `Program review moved the ${handoff.partnerName} handoff to ${mutation.status.replaceAll("_", " ")}.`, options)
      break
    }
  }

  return finish(document, options)
}

export function applicantOwnsInvestmentWorkspace(document: InvestmentWorkspaceDocument, userId: string) {
  return document.applicantUserId === userId
}

export function investmentWorkspaceHasFile(document: InvestmentWorkspaceDocument, uploadId: string) {
  return document.dataRoomItems.some(item => item.fileUploadId === uploadId)
}
