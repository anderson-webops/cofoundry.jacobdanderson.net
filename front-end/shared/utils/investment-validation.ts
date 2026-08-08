import { z } from "zod"

const id = z.string().trim().min(1).max(160)
const nullableId = id.nullable()
const dateTime = z.string().datetime("Use an ISO timestamp.")
const nullableDateTime = dateTime.nullable()
const shortText = z.string().trim().max(240)
const mediumText = z.string().trim().max(4000)
const longText = z.string().trim().max(12000)
const requiredShortText = shortText.min(2)
const requiredMediumText = mediumText.min(10)
const secureUrl = z.string().trim().max(1000).refine((value) => {
  if (!value)
    return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
  }
  catch {
    return false
  }
}, "Use a credential-free HTTPS URL.")
const requiredSecureUrl = secureUrl.refine(Boolean, "Add a secure HTTPS URL.")
const instrument = z.enum(["safe", "convertible_note", "preferred_equity", "other"])
const dataRoomCategory = z.enum(["pitch", "corporate", "financial", "traction", "team", "product", "legal", "other"])

export const investmentWorkspaceCreateSchema = z.object({
  opportunityId: id,
  organizationId: nullableId.default(null),
}).strict()

const applicantMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_workspace"),
    organizationId: nullableId,
    status: z.enum(["planning", "fundraising", "paused"]),
  }).strict(),
  z.object({
    action: z.literal("update_readiness"),
    profile: z.object({
      capTableCurrent: z.boolean(),
      counselEngaged: z.boolean(),
      dataRoomReady: z.boolean(),
      financialsCurrent: z.boolean(),
      formationComplete: z.boolean(),
      formationJurisdiction: shortText,
      fundraisingOwner: requiredShortText,
      legalName: requiredShortText,
      notes: mediumText,
      targetCloseAt: nullableDateTime,
    }).strict(),
  }).strict(),
  z.object({
    action: z.literal("create_round"),
    discount: shortText,
    instrument,
    minimumInvestment: shortText,
    openedAt: nullableDateTime,
    targetAmount: requiredShortText,
    targetCloseAt: nullableDateTime,
    title: requiredShortText,
    useOfFunds: requiredMediumText,
    valuationCap: shortText,
  }).strict(),
  z.object({
    action: z.literal("update_round"),
    discount: shortText,
    instrument,
    minimumInvestment: shortText,
    openedAt: nullableDateTime,
    roundId: id,
    status: z.enum(["planning", "open", "soft_circled", "closed", "canceled"]),
    targetAmount: requiredShortText,
    targetCloseAt: nullableDateTime,
    title: requiredShortText,
    useOfFunds: requiredMediumText,
    valuationCap: shortText,
  }).strict(),
  z.object({
    action: z.literal("create_prospect"),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    expectedCheckSize: shortText,
    firm: shortText,
    kind: z.enum(["angel", "fund", "strategic", "accelerator", "other"]),
    name: shortText,
    nextStep: mediumText,
    nextStepAt: nullableDateTime,
    notes: longText,
    source: shortText,
    status: z.enum(["researching", "contact_planned", "contacted", "meeting", "diligence", "passed", "committed", "closed"]),
    website: secureUrl,
  }).strict().refine(payload => Boolean(payload.name || payload.firm), {
    message: "Add a person or firm name.",
    path: ["name"],
  }),
  z.object({
    action: z.literal("update_prospect"),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    expectedCheckSize: shortText,
    firm: shortText,
    kind: z.enum(["angel", "fund", "strategic", "accelerator", "other"]),
    name: shortText,
    nextStep: mediumText,
    nextStepAt: nullableDateTime,
    notes: longText,
    prospectId: id,
    source: shortText,
    status: z.enum(["researching", "contact_planned", "contacted", "meeting", "diligence", "passed", "committed", "closed"]),
    website: secureUrl,
  }).strict().refine(payload => Boolean(payload.name || payload.firm), {
    message: "Add a person or firm name.",
    path: ["name"],
  }),
  z.object({
    action: z.literal("record_interaction"),
    nextStep: mediumText,
    occurredAt: dateTime,
    prospectId: id,
    summary: requiredMediumText,
    type: z.enum(["note", "email", "call", "meeting", "data_room", "term_sheet"]),
  }).strict(),
  z.object({
    action: z.literal("add_data_room_item"),
    category: dataRoomCategory,
    description: requiredMediumText,
    externalUrl: secureUrl,
    fileUploadId: nullableId,
    shareWithProgram: z.boolean(),
    title: requiredShortText,
  }).strict().refine(payload => Boolean(payload.externalUrl || payload.fileUploadId), {
    message: "Add either a secure link or an uploaded file.",
    path: ["externalUrl"],
  }),
  z.object({
    action: z.literal("update_data_room_item"),
    category: dataRoomCategory,
    dataRoomItemId: id,
    description: requiredMediumText,
    externalUrl: secureUrl,
    shareWithProgram: z.boolean(),
    title: requiredShortText,
  }).strict(),
  z.object({ action: z.literal("remove_data_room_item"), dataRoomItemId: id }).strict(),
  z.object({
    action: z.literal("update_application"),
    companySummary: requiredMediumText,
    deckUrl: requiredSecureUrl,
    fundraisingHistory: requiredMediumText,
    instrument,
    reason: requiredMediumText,
    requestedAmount: requiredShortText,
    teamSummary: requiredMediumText,
    traction: requiredMediumText,
    useOfFunds: requiredMediumText,
  }).strict(),
  z.object({
    action: z.literal("accept_supplemental_terms"),
    attestations: z.object({
      authorizedToSubmit: z.boolean(),
      informationAccurate: z.boolean(),
      noFundingGuarantee: z.boolean(),
      regulatedExecutionAcknowledged: z.boolean(),
    }).strict(),
  }).strict(),
  z.object({ action: z.literal("set_partner_sharing_consent"), consent: z.boolean() }).strict(),
  z.object({ action: z.literal("submit_application") }).strict(),
  z.object({ action: z.literal("withdraw_application"), reason: requiredMediumText }).strict(),
  z.object({
    action: z.literal("respond_information_request"),
    informationRequestId: id,
    response: requiredMediumText,
  }).strict(),
  z.object({
    action: z.literal("respond_diligence_item"),
    diligenceItemId: id,
    evidenceDataRoomItemIds: z.array(id).max(100),
    response: requiredMediumText,
    status: z.enum(["in_progress", "submitted"]),
  }).strict(),
  z.object({
    action: z.literal("publish_founder_update"),
    body: requiredMediumText,
    metrics: mediumText,
    shareWithProgram: z.boolean(),
    title: requiredShortText,
  }).strict(),
  z.object({
    action: z.literal("update_founder_update"),
    body: requiredMediumText,
    founderUpdateId: id,
    metrics: mediumText,
    shareWithProgram: z.boolean(),
    title: requiredShortText,
  }).strict(),
])

export const investmentApplicantMutationEnvelopeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  mutation: applicantMutationSchema,
}).strict()

const reviewerMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign_reviewer"), reviewerUserId: nullableId }).strict(),
  z.object({
    action: z.literal("update_review"),
    priority: z.enum(["standard", "high", "urgent"]),
    riskFlags: z.array(requiredShortText).max(30),
    stageSummary: mediumText,
  }).strict(),
  z.object({
    action: z.literal("set_application_status"),
    status: z.enum(["submitted", "under_review", "information_requested", "diligence", "committee_review", "closed"]),
  }).strict(),
  z.object({
    action: z.literal("request_information"),
    dueAt: nullableDateTime,
    request: requiredMediumText,
    title: requiredShortText,
  }).strict(),
  z.object({
    action: z.literal("close_information_request"),
    informationRequestId: id,
    status: z.enum(["accepted", "closed"]),
  }).strict(),
  z.object({
    action: z.literal("create_diligence_item"),
    category: dataRoomCategory,
    description: requiredMediumText,
    dueAt: nullableDateTime,
    title: requiredShortText,
  }).strict(),
  z.object({
    action: z.literal("resolve_diligence_item"),
    diligenceItemId: id,
    status: z.enum(["accepted", "waived"]),
  }).strict(),
  z.object({
    action: z.literal("add_review_note"),
    body: requiredMediumText,
    category: z.enum(["screening", "diligence", "committee", "compliance", "partner"]),
  }).strict(),
  z.object({
    action: z.literal("record_decision"),
    internalRationale: requiredMediumText,
    outcome: z.enum(["advance", "hold", "decline", "refer_to_partner"]),
    publicRationale: requiredMediumText,
  }).strict(),
  z.object({
    action: z.literal("create_partner_handoff"),
    internalNotes: mediumText,
    partnerName: requiredShortText,
    partnerType: z.enum(["broker_dealer", "funding_portal", "counsel", "investment_adviser", "other"]),
    partnerUrl: requiredSecureUrl,
    sharedDataRoomItemIds: z.array(id).max(100),
  }).strict(),
  z.object({
    action: z.literal("update_partner_handoff"),
    externalReference: shortText,
    handoffId: id,
    internalNotes: mediumText,
    sharedDataRoomItemIds: z.array(id).max(100),
    status: z.enum(["planned", "consent_pending", "ready", "sent", "acknowledged", "closed", "canceled"]),
  }).strict(),
])

export const investmentReviewerMutationEnvelopeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  mutation: reviewerMutationSchema,
}).strict()
