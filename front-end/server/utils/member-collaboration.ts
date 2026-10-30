import type { H3Event } from "h3"
import type {
  ConnectRequest,
  Contract,
  ContractVersion,
  Conversation,
  InvestmentApplication,
  Match,
  Message,
  Notification,
  Proposal,
  ProposalComment,
  ProposalVersion,
  RelationshipDecision,
  Report,
  Signature,
  TrialCollaboration,
  WorkspaceSeed,
} from "../../shared/types/domain"
import type { PersistedCollaborationState } from "./local-collaboration-store"
import { cloneValue } from "../../shared/utils/clone"
import { deriveCollaborationTrustMetrics } from "../../shared/utils/collaboration"
import { loadLocalCollaborationState, persistLocalCollaborationStateForUsers } from "./local-collaboration-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"
import { collectStablePages } from "./supabase-pagination"

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>

interface PersistedConnectRequestRow {
  created_at: string
  decline_reason: ConnectRequest["declineReason"]
  from_user_id: string
  id: string
  note: string
  responded_at: string | null
  status: ConnectRequest["status"]
  structured_intro: ConnectRequest["structuredIntro"]
  to_user_id: string
}

interface PersistedMatchRow {
  conversation_id: string
  created_at: string
  id: string
  participant_ids: Match["participantIds"]
  source: Match["source"]
}

interface PersistedConversationRow {
  id: string
  last_message_at: string
  participant_ids: string[]
  typing_by_user_ids: string[]
  unread_count_by_user: Conversation["unreadCountByUser"]
}

interface PersistedMessageRow {
  attachments: Message["attachments"]
  body: string
  conversation_id: string
  created_at: string
  id: string
  sender_user_id: string | null
  type: Message["type"]
}

interface PersistedProposalRow {
  conversation_id: string
  created_at: string
  created_by_user_id: string
  current_version_id: string
  id: string
  opportunity_id: string | null
  recipient_user_id: string
  status: Proposal["status"]
  title: string
  updated_at: string
}

interface PersistedProposalVersionRow {
  cash_compensation: string
  ceo_decision: string
  cliff: string
  confidentiality: string
  created_at: string
  created_by_user_id: string
  decision_rights: string
  equity: string
  exit_terms: string
  full_time_trigger: string
  id: string
  ip_assignment_required: boolean
  notes: string
  proposal_id: string
  relationship_type: ProposalVersion["relationshipType"]
  responsibilities: string[]
  role_title: string
  start_date: string
  summary: string
  trial_ip_handling: string
  trial_scope: string
  version_number: number
  vesting_schedule: string
  weekly_time_commitment: number
}

interface PersistedProposalCommentRow {
  author_user_id: string
  body: string
  created_at: string
  id: string
  proposal_id: string
  proposal_version_id: string
  section: ProposalComment["section"]
}

interface PersistedContractRow {
  created_at: string
  current_version_id: string
  disclaimer_acknowledged: boolean
  id: string
  proposal_id: string
  status: Contract["status"]
  title: string
  updated_at: string
}

interface PersistedContractVersionRow {
  compensation: string
  confidentiality: string
  contract_id: string
  created_at: string
  decision_making: string
  dispute_resolution: string
  equity: string
  generated_from_proposal_version_id: string | null
  id: string
  ip_assignment: string
  notes: string
  parties: string[]
  role_title: string
  scope: string
  termination: string
  time_commitment: string
  vesting: string
  version_number: number
}

interface PersistedSignatureRow {
  contract_id: string
  contract_version_id: string
  id: string
  signed_at: string
  typed_name: string
  user_id: string
}

interface PersistedTrialCollaborationRow {
  acknowledged_by_user_ids: string[]
  check_in_cadence: string
  created_at: string
  created_by_user_id: string
  deliverables: string[]
  duration_weeks: number
  id: string
  match_id: string
  next_check_in_at: string
  objective: string
  scope: string
  status: TrialCollaboration["status"]
  success_signals: string[]
  title: string
  updated_at: string
  weekly_hours: number
}

interface PersistedNotificationRow {
  body: string
  created_at: string
  href: string
  id: string
  read_at: string | null
  title: string
  type: Notification["type"]
  user_id: string
}

interface PersistedReportRow {
  created_at: string
  details: string
  id: string
  priority: Report["priority"]
  reason: Report["reason"]
  reporter_user_id: string
  resolution_notes: string | null
  resolved_at: string | null
  resolved_by_user_id: string | null
  review_notes: string | null
  reviewed_at: string | null
  reviewed_by_user_id: string | null
  status: Report["status"]
  target_id: string
  target_type: Report["targetType"]
}

interface PersistedInvestmentApplicationRow {
  applicant_user_id: string
  created_at: string
  deck_link: string
  id: string
  opportunity_id: string
  raise_amount: string
  reason: string
  status: InvestmentApplication["status"]
  team_summary: string
  traction: string
}

interface PersistedRelationshipDecisionRow {
  author_user_id: string
  body: string
  created_at: string
  id: string
  match_id: string
  status: RelationshipDecision["status"]
  title: string
  updated_at: string
}

function fromConnectRequestRow(row: PersistedConnectRequestRow): ConnectRequest {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    note: row.note,
    structuredIntro: row.structured_intro,
    status: row.status,
    declineReason: row.decline_reason,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }
}

function toConnectRequestRow(request: ConnectRequest): PersistedConnectRequestRow {
  return {
    id: request.id,
    from_user_id: request.fromUserId,
    to_user_id: request.toUserId,
    note: request.note,
    structured_intro: request.structuredIntro,
    status: request.status,
    decline_reason: request.declineReason,
    created_at: request.createdAt,
    responded_at: request.respondedAt,
  }
}

function fromMatchRow(row: PersistedMatchRow): Match {
  return {
    id: row.id,
    participantIds: row.participant_ids,
    source: row.source,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
  }
}

function toMatchRow(match: Match): PersistedMatchRow {
  return {
    id: match.id,
    participant_ids: match.participantIds,
    source: match.source,
    conversation_id: match.conversationId,
    created_at: match.createdAt,
  }
}

function fromConversationRow(row: PersistedConversationRow): Conversation {
  return {
    id: row.id,
    participantIds: row.participant_ids,
    lastMessageAt: row.last_message_at,
    unreadCountByUser: row.unread_count_by_user,
    typingByUserIds: row.typing_by_user_ids,
  }
}

function toConversationRow(conversation: Conversation): PersistedConversationRow {
  return {
    id: conversation.id,
    participant_ids: conversation.participantIds,
    last_message_at: conversation.lastMessageAt,
    unread_count_by_user: conversation.unreadCountByUser,
    typing_by_user_ids: conversation.typingByUserIds,
  }
}

function fromMessageRow(row: PersistedMessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderUserId: row.sender_user_id,
    type: row.type,
    body: row.body,
    attachments: row.attachments,
    createdAt: row.created_at,
  }
}

function toMessageRow(message: Message): PersistedMessageRow {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    sender_user_id: message.senderUserId,
    type: message.type,
    body: message.body,
    attachments: message.attachments,
    created_at: message.createdAt,
  }
}

function fromProposalRow(row: PersistedProposalRow): Proposal {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    opportunityId: row.opportunity_id,
    createdByUserId: row.created_by_user_id,
    recipientUserId: row.recipient_user_id,
    title: row.title,
    currentVersionId: row.current_version_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toProposalRow(proposal: Proposal): PersistedProposalRow {
  return {
    id: proposal.id,
    conversation_id: proposal.conversationId,
    opportunity_id: proposal.opportunityId,
    created_by_user_id: proposal.createdByUserId,
    recipient_user_id: proposal.recipientUserId,
    title: proposal.title,
    current_version_id: proposal.currentVersionId,
    status: proposal.status,
    created_at: proposal.createdAt,
    updated_at: proposal.updatedAt,
  }
}

function fromProposalVersionRow(row: PersistedProposalVersionRow): ProposalVersion {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    versionNumber: row.version_number,
    relationshipType: row.relationship_type,
    roleTitle: row.role_title,
    responsibilities: row.responsibilities,
    weeklyTimeCommitment: row.weekly_time_commitment,
    startDate: row.start_date,
    fullTimeTrigger: row.full_time_trigger,
    ceoDecision: row.ceo_decision,
    trialScope: row.trial_scope,
    trialIpHandling: row.trial_ip_handling,
    cashCompensation: row.cash_compensation,
    equity: row.equity,
    vestingSchedule: row.vesting_schedule,
    cliff: row.cliff,
    decisionRights: row.decision_rights,
    ipAssignmentRequired: row.ip_assignment_required,
    confidentiality: row.confidentiality,
    exitTerms: row.exit_terms,
    notes: row.notes,
    summary: row.summary,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  }
}

function toProposalVersionRow(version: ProposalVersion): PersistedProposalVersionRow {
  return {
    id: version.id,
    proposal_id: version.proposalId,
    version_number: version.versionNumber,
    relationship_type: version.relationshipType,
    role_title: version.roleTitle,
    responsibilities: version.responsibilities,
    weekly_time_commitment: version.weeklyTimeCommitment,
    start_date: version.startDate,
    full_time_trigger: version.fullTimeTrigger,
    ceo_decision: version.ceoDecision,
    trial_scope: version.trialScope,
    trial_ip_handling: version.trialIpHandling,
    cash_compensation: version.cashCompensation,
    equity: version.equity,
    vesting_schedule: version.vestingSchedule,
    cliff: version.cliff,
    decision_rights: version.decisionRights,
    ip_assignment_required: version.ipAssignmentRequired,
    confidentiality: version.confidentiality,
    exit_terms: version.exitTerms,
    notes: version.notes,
    summary: version.summary,
    created_by_user_id: version.createdByUserId,
    created_at: version.createdAt,
  }
}

function fromProposalCommentRow(row: PersistedProposalCommentRow): ProposalComment {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    proposalVersionId: row.proposal_version_id,
    authorUserId: row.author_user_id,
    section: row.section,
    body: row.body,
    createdAt: row.created_at,
  }
}

function toProposalCommentRow(comment: ProposalComment): PersistedProposalCommentRow {
  return {
    id: comment.id,
    proposal_id: comment.proposalId,
    proposal_version_id: comment.proposalVersionId,
    author_user_id: comment.authorUserId,
    section: comment.section,
    body: comment.body,
    created_at: comment.createdAt,
  }
}

function fromContractRow(row: PersistedContractRow): Contract {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    title: row.title,
    status: row.status,
    currentVersionId: row.current_version_id,
    disclaimerAcknowledged: row.disclaimer_acknowledged,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toContractRow(contract: Contract): PersistedContractRow {
  return {
    id: contract.id,
    proposal_id: contract.proposalId,
    title: contract.title,
    status: contract.status,
    current_version_id: contract.currentVersionId,
    disclaimer_acknowledged: contract.disclaimerAcknowledged,
    created_at: contract.createdAt,
    updated_at: contract.updatedAt,
  }
}

function fromContractVersionRow(row: PersistedContractVersionRow): ContractVersion {
  return {
    id: row.id,
    contractId: row.contract_id,
    versionNumber: row.version_number,
    parties: row.parties,
    roleTitle: row.role_title,
    scope: row.scope,
    timeCommitment: row.time_commitment,
    compensation: row.compensation,
    equity: row.equity,
    vesting: row.vesting,
    ipAssignment: row.ip_assignment,
    confidentiality: row.confidentiality,
    decisionMaking: row.decision_making,
    termination: row.termination,
    disputeResolution: row.dispute_resolution,
    notes: row.notes,
    generatedFromProposalVersionId: row.generated_from_proposal_version_id,
    createdAt: row.created_at,
  }
}

function toContractVersionRow(version: ContractVersion): PersistedContractVersionRow {
  return {
    id: version.id,
    contract_id: version.contractId,
    version_number: version.versionNumber,
    parties: version.parties,
    role_title: version.roleTitle,
    scope: version.scope,
    time_commitment: version.timeCommitment,
    compensation: version.compensation,
    equity: version.equity,
    vesting: version.vesting,
    ip_assignment: version.ipAssignment,
    confidentiality: version.confidentiality,
    decision_making: version.decisionMaking,
    termination: version.termination,
    dispute_resolution: version.disputeResolution,
    notes: version.notes,
    generated_from_proposal_version_id: version.generatedFromProposalVersionId,
    created_at: version.createdAt,
  }
}

function fromSignatureRow(row: PersistedSignatureRow): Signature {
  return {
    id: row.id,
    contractId: row.contract_id,
    contractVersionId: row.contract_version_id,
    userId: row.user_id,
    typedName: row.typed_name,
    signedAt: row.signed_at,
  }
}

function toSignatureRow(signature: Signature): PersistedSignatureRow {
  return {
    id: signature.id,
    contract_id: signature.contractId,
    contract_version_id: signature.contractVersionId,
    user_id: signature.userId,
    typed_name: signature.typedName,
    signed_at: signature.signedAt,
  }
}

function fromTrialCollaborationRow(row: PersistedTrialCollaborationRow): TrialCollaboration {
  return {
    id: row.id,
    matchId: row.match_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    objective: row.objective,
    scope: row.scope,
    weeklyHours: row.weekly_hours,
    durationWeeks: row.duration_weeks,
    checkInCadence: row.check_in_cadence,
    deliverables: row.deliverables,
    successSignals: row.success_signals,
    status: row.status,
    acknowledgedByUserIds: row.acknowledged_by_user_ids,
    nextCheckInAt: row.next_check_in_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toTrialCollaborationRow(trial: TrialCollaboration): PersistedTrialCollaborationRow {
  return {
    id: trial.id,
    match_id: trial.matchId,
    created_by_user_id: trial.createdByUserId,
    title: trial.title,
    objective: trial.objective,
    scope: trial.scope,
    weekly_hours: trial.weeklyHours,
    duration_weeks: trial.durationWeeks,
    check_in_cadence: trial.checkInCadence,
    deliverables: trial.deliverables,
    success_signals: trial.successSignals,
    status: trial.status,
    acknowledged_by_user_ids: trial.acknowledgedByUserIds,
    next_check_in_at: trial.nextCheckInAt,
    created_at: trial.createdAt,
    updated_at: trial.updatedAt,
  }
}

function fromNotificationRow(row: PersistedNotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

function toNotificationRow(notification: Notification): PersistedNotificationRow {
  return {
    id: notification.id,
    user_id: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    read_at: notification.readAt,
    created_at: notification.createdAt,
  }
}

function fromReportRow(row: PersistedReportRow): Report {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    priority: row.priority,
    details: row.details,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    resolutionNotes: row.resolution_notes,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id,
    createdAt: row.created_at,
  }
}

function fromInvestmentApplicationRow(row: PersistedInvestmentApplicationRow): InvestmentApplication {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    applicantUserId: row.applicant_user_id,
    status: row.status,
    raiseAmount: row.raise_amount,
    traction: row.traction,
    deckLink: row.deck_link,
    teamSummary: row.team_summary,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

function fromRelationshipDecisionRow(row: PersistedRelationshipDecisionRow): RelationshipDecision {
  return {
    id: row.id,
    matchId: row.match_id,
    authorUserId: row.author_user_id,
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRelationshipDecisionRow(decision: RelationshipDecision): PersistedRelationshipDecisionRow {
  return {
    id: decision.id,
    match_id: decision.matchId,
    author_user_id: decision.authorUserId,
    title: decision.title,
    body: decision.body,
    status: decision.status,
    created_at: decision.createdAt,
    updated_at: decision.updatedAt,
  }
}

function buildEmptyState(): PersistedCollaborationState {
  return {
    connectRequests: [],
    contractVersions: [],
    contracts: [],
    conversations: [],
    investmentApplications: [],
    matches: [],
    messages: [],
    notifications: [],
    proposalComments: [],
    proposalVersions: [],
    proposals: [],
    relationshipDecisions: [],
    reports: [],
    signatures: [],
    trialCollaborations: [],
  }
}

function mergeCollaborationState(seed: WorkspaceSeed, state: PersistedCollaborationState) {
  const nextSeed = cloneValue(seed)
  nextSeed.connectRequests = state.connectRequests
  nextSeed.matches = state.matches
  nextSeed.conversations = state.conversations
  nextSeed.messages = state.messages
  nextSeed.proposals = state.proposals
  nextSeed.proposalVersions = state.proposalVersions
  nextSeed.proposalComments = state.proposalComments
  nextSeed.contracts = state.contracts
  nextSeed.contractVersions = state.contractVersions
  nextSeed.signatures = state.signatures
  nextSeed.trialCollaborations = state.trialCollaborations
  nextSeed.relationshipDecisions = state.relationshipDecisions
  nextSeed.notifications = state.notifications
  nextSeed.reports = state.reports
  nextSeed.investmentApplications = state.investmentApplications
  return deriveCollaborationTrustMetrics(nextSeed)
}

export function extractUsersCollaborationState(seed: WorkspaceSeed, userIds: string[]): PersistedCollaborationState {
  const userIdSet = new Set(userIds)
  const connectRequests = seed.connectRequests.filter(request => userIdSet.has(request.fromUserId) || userIdSet.has(request.toUserId))
  const matches = seed.matches.filter(match => match.participantIds.some(userId => userIdSet.has(userId)))
  const matchIds = new Set(matches.map(match => match.id))
  const conversations = seed.conversations.filter(conversation => conversation.participantIds.some(userId => userIdSet.has(userId)))
  const conversationIds = new Set(conversations.map(conversation => conversation.id))
  const messages = seed.messages.filter(message => conversationIds.has(message.conversationId))
  const proposals = seed.proposals.filter(proposal => userIdSet.has(proposal.createdByUserId) || userIdSet.has(proposal.recipientUserId))
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const proposalVersions = seed.proposalVersions.filter(version => proposalIds.has(version.proposalId))
  const proposalComments = seed.proposalComments.filter(comment => proposalIds.has(comment.proposalId))
  const contracts = seed.contracts.filter(contract => proposalIds.has(contract.proposalId))
  const contractIds = new Set(contracts.map(contract => contract.id))
  const contractVersions = seed.contractVersions.filter(version => contractIds.has(version.contractId))
  const signatures = seed.signatures.filter(signature => contractIds.has(signature.contractId))
  const trialCollaborations = seed.trialCollaborations.filter(trial => matchIds.has(trial.matchId))
  const relationshipDecisions = seed.relationshipDecisions.filter(decision => matchIds.has(decision.matchId))
  const notifications = seed.notifications.filter(notification => userIdSet.has(notification.userId))

  return {
    ...buildEmptyState(),
    connectRequests,
    matches,
    conversations,
    messages,
    proposals,
    proposalVersions,
    proposalComments,
    contracts,
    contractVersions,
    signatures,
    trialCollaborations,
    relationshipDecisions,
    notifications,
    reports: seed.reports.filter(report => userIdSet.has(report.reporterUserId)),
    investmentApplications: seed.investmentApplications.filter(application => userIdSet.has(application.applicantUserId)),
  }
}

async function selectConnectRequests(adminClient: AdminClient, userId: string) {
  const { data, error } = await adminClient
    .from("connect_requests")
    .select("*")
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedConnectRequestRow[]
}

async function selectMatches(adminClient: AdminClient, userId: string) {
  const { data, error } = await adminClient
    .from("matches")
    .select("*")
    .contains("participant_ids", [userId])
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedMatchRow[]
}

async function selectConversations(adminClient: AdminClient, userId: string) {
  const { data, error } = await adminClient
    .from("conversations")
    .select("*")
    .contains("participant_ids", [userId])
    .order("last_message_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedConversationRow[]
}

async function selectMessages(adminClient: AdminClient, conversationIds: string[]) {
  if (!conversationIds.length)
    return [] as PersistedMessageRow[]

  const { data, error } = await adminClient
    .from("messages")
    .select("*")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true })

  if (error)
    throw error

  return (data || []) as PersistedMessageRow[]
}

async function selectProposals(adminClient: AdminClient, userId: string) {
  const { data, error } = await adminClient
    .from("proposals")
    .select("*")
    .or(`created_by_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order("updated_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedProposalRow[]
}

async function selectProposalVersions(adminClient: AdminClient, proposalIds: string[]) {
  if (!proposalIds.length)
    return [] as PersistedProposalVersionRow[]

  return collectStablePages<PersistedProposalVersionRow>(async (start, end) => {
    const { count, data, error } = await adminClient
      .from("proposal_versions")
      .select("*", { count: "exact" })
      .in("proposal_id", proposalIds)
      .order("version_number", { ascending: false })
      .order("id", { ascending: true })
      .range(start, end)
    return { count, data: data as PersistedProposalVersionRow[] | null, error }
  })
}

async function selectProposalComments(adminClient: AdminClient, proposalIds: string[]) {
  if (!proposalIds.length)
    return [] as PersistedProposalCommentRow[]

  const { data, error } = await adminClient
    .from("proposal_comments")
    .select("*")
    .in("proposal_id", proposalIds)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedProposalCommentRow[]
}

async function selectContracts(adminClient: AdminClient, proposalIds: string[]) {
  if (!proposalIds.length)
    return [] as PersistedContractRow[]

  const { data, error } = await adminClient
    .from("contracts")
    .select("*")
    .in("proposal_id", proposalIds)
    .order("updated_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedContractRow[]
}

async function selectContractVersions(adminClient: AdminClient, contractIds: string[]) {
  if (!contractIds.length)
    return [] as PersistedContractVersionRow[]

  return collectStablePages<PersistedContractVersionRow>(async (start, end) => {
    const { count, data, error } = await adminClient
      .from("contract_versions")
      .select("*", { count: "exact" })
      .in("contract_id", contractIds)
      .order("version_number", { ascending: false })
      .order("id", { ascending: true })
      .range(start, end)
    return { count, data: data as PersistedContractVersionRow[] | null, error }
  })
}

async function selectSignatures(adminClient: AdminClient, contractIds: string[]) {
  if (!contractIds.length)
    return [] as PersistedSignatureRow[]

  const { data, error } = await adminClient
    .from("signatures")
    .select("*")
    .in("contract_id", contractIds)
    .order("signed_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedSignatureRow[]
}

async function selectTrialCollaborations(adminClient: AdminClient, matchIds: string[]) {
  if (!matchIds.length)
    return [] as PersistedTrialCollaborationRow[]

  const { data, error } = await adminClient
    .from("trial_collaborations")
    .select("*")
    .in("match_id", matchIds)
    .order("updated_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedTrialCollaborationRow[]
}

async function selectNotifications(adminClient: AdminClient, userId: string) {
  const { data, error } = await adminClient
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedNotificationRow[]
}

async function selectReports(adminClient: AdminClient, userId: string, includeAdministrativeData: boolean) {
  const query = adminClient
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500)
  const { data, error } = includeAdministrativeData
    ? await query
    : await query.eq("reporter_user_id", userId)

  if (error)
    throw error

  return (data || []) as PersistedReportRow[]
}

async function selectInvestmentApplications(adminClient: AdminClient, userId: string, includeAdministrativeData: boolean) {
  const query = adminClient
    .from("investment_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500)
  const { data, error } = includeAdministrativeData
    ? await query
    : await query.eq("applicant_user_id", userId)

  if (error)
    throw error

  return (data || []) as PersistedInvestmentApplicationRow[]
}

async function selectRelationshipDecisions(adminClient: AdminClient, matchIds: string[]) {
  if (!matchIds.length)
    return [] as PersistedRelationshipDecisionRow[]

  const { data, error } = await adminClient
    .from("relationship_decisions")
    .select("*")
    .in("match_id", matchIds)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedRelationshipDecisionRow[]
}

export function mergeServerCollaborationState(seed: WorkspaceSeed, state: PersistedCollaborationState) {
  return mergeCollaborationState(seed, state)
}

export async function loadServerCollaborationState(
  event: H3Event,
  userId: string,
  options: { includeAdministrativeData?: boolean } = {},
) {
  if (!isSupabaseEnabled(event))
    return await loadLocalCollaborationState(userId, options) || buildEmptyState()

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const connectRequests = await selectConnectRequests(adminClient, userId)
  const matches = await selectMatches(adminClient, userId)
  const conversations = await selectConversations(adminClient, userId)
  const messages = await selectMessages(adminClient, conversations.map(conversation => conversation.id))
  const proposals = await selectProposals(adminClient, userId)
  const proposalVersions = await selectProposalVersions(adminClient, proposals.map(proposal => proposal.id))
  const proposalComments = await selectProposalComments(adminClient, proposals.map(proposal => proposal.id))
  const contracts = await selectContracts(adminClient, proposals.map(proposal => proposal.id))
  const contractVersions = await selectContractVersions(adminClient, contracts.map(contract => contract.id))
  const signatures = await selectSignatures(adminClient, contracts.map(contract => contract.id))
  const trialCollaborations = await selectTrialCollaborations(adminClient, matches.map(match => match.id))
  const relationshipDecisions = await selectRelationshipDecisions(adminClient, matches.map(match => match.id))
  const notifications = await selectNotifications(adminClient, userId)
  const reports = await selectReports(adminClient, userId, options.includeAdministrativeData === true)
  const investmentApplications = await selectInvestmentApplications(adminClient, userId, options.includeAdministrativeData === true)

  return {
    ...buildEmptyState(),
    connectRequests: connectRequests.map(fromConnectRequestRow),
    matches: matches.map(fromMatchRow),
    conversations: conversations.map(fromConversationRow),
    messages: messages.map(fromMessageRow),
    proposals: proposals.map(fromProposalRow),
    proposalVersions: proposalVersions.map(fromProposalVersionRow),
    proposalComments: proposalComments.map(fromProposalCommentRow),
    contracts: contracts.map(fromContractRow),
    contractVersions: contractVersions.map(fromContractVersionRow),
    signatures: signatures.map(fromSignatureRow),
    trialCollaborations: trialCollaborations.map(fromTrialCollaborationRow),
    relationshipDecisions: relationshipDecisions.map(fromRelationshipDecisionRow),
    notifications: notifications.map(fromNotificationRow),
    reports: reports.map(fromReportRow),
    investmentApplications: investmentApplications.map(fromInvestmentApplicationRow),
  } satisfies PersistedCollaborationState
}

export async function persistServerCollaborationState(
  event: H3Event,
  userIdOrIds: string | string[],
  seed: WorkspaceSeed,
  options: {
    expectedSeed: WorkspaceSeed
    signatureEvents?: Array<{
      contract_id: string
      contract_version_id: string
      created_at: string
      event_type: "typed_signature"
      id: string
      ip_address: string | null
      signature_id: string
      typed_name: string
      user_agent: string | null
      user_id: string
    }>
  },
) {
  const userIds = [
    ...new Set((Array.isArray(userIdOrIds)
      ? userIdOrIds
      : [userIdOrIds]).filter(Boolean))
  ]
  if (!userIds.length)
    throw createError({ statusCode: 400, statusMessage: "At least one collaboration participant is required." })

  const state = extractUsersCollaborationState(seed, userIds)
  const expectedState = extractUsersCollaborationState(options.expectedSeed, userIds)

  if (!isSupabaseEnabled(event)) {
    await persistLocalCollaborationStateForUsers(userIds, state, {
      expectedState,
    })
    return
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const expectedConnectRequests = new Map(expectedState.connectRequests.map(row => [row.id, row]))
  const expectedConversations = new Map(expectedState.conversations.map(row => [row.id, row]))
  const expectedProposals = new Map(expectedState.proposals.map(row => [row.id, row]))
  const expectedContracts = new Map(expectedState.contracts.map(row => [row.id, row]))
  const expectedTrials = new Map(expectedState.trialCollaborations.map(row => [row.id, row]))
  const expectedNotifications = new Map(expectedState.notifications.map(row => [row.id, row]))

  const { error } = await adminClient.rpc("cofoundry_upsert_collaboration_state", {
    p_connect_requests: state.connectRequests.map((row) => {
      const expected = expectedConnectRequests.get(row.id)
      return {
        ...toConnectRequestRow(row),
        expected_decline_reason: expected?.declineReason ?? null,
        expected_exists: Boolean(expected),
        expected_responded_at: expected?.respondedAt ?? null,
        expected_status: expected?.status ?? null,
      }
    }),
    p_contract_versions: state.contractVersions.map(toContractVersionRow),
    p_contracts: state.contracts.map((row) => {
      const expected = expectedContracts.get(row.id)
      return {
        ...toContractRow(row),
        expected_current_version_id: expected?.currentVersionId ?? null,
        expected_disclaimer_acknowledged: expected?.disclaimerAcknowledged ?? null,
        expected_exists: Boolean(expected),
        expected_status: expected?.status ?? null,
        expected_updated_at: expected?.updatedAt ?? null,
      }
    }),
    p_conversations: state.conversations.map((row) => {
      const expected = expectedConversations.get(row.id)
      return {
        ...toConversationRow(row),
        expected_exists: Boolean(expected),
        expected_last_message_at: expected?.lastMessageAt ?? null,
        expected_typing_by_user_ids: expected?.typingByUserIds ?? null,
        expected_unread_count_by_user: expected?.unreadCountByUser ?? null,
      }
    }),
    p_matches: state.matches.map(toMatchRow),
    p_messages: state.messages.map(toMessageRow),
    p_notifications: state.notifications.map((row) => {
      const expected = expectedNotifications.get(row.id)
      return {
        ...toNotificationRow(row),
        expected_exists: Boolean(expected),
        expected_read_at: expected?.readAt ?? null,
      }
    }),
    p_proposal_comments: state.proposalComments.map(toProposalCommentRow),
    p_proposal_versions: state.proposalVersions.map(toProposalVersionRow),
    p_proposals: state.proposals.map((row) => {
      const expected = expectedProposals.get(row.id)
      return {
        ...toProposalRow(row),
        expected_current_version_id: expected?.currentVersionId ?? null,
        expected_exists: Boolean(expected),
        expected_status: expected?.status ?? null,
        expected_updated_at: expected?.updatedAt ?? null,
      }
    }),
    p_relationship_decisions: state.relationshipDecisions.map(toRelationshipDecisionRow),
    p_signature_events: options.signatureEvents || [],
    p_signatures: state.signatures.map(toSignatureRow),
    p_trial_collaborations: state.trialCollaborations.map((row) => {
      const expected = expectedTrials.get(row.id)
      return {
        ...toTrialCollaborationRow(row),
        expected_acknowledged_by_user_ids: expected?.acknowledgedByUserIds ?? null,
        expected_exists: Boolean(expected),
        expected_next_check_in_at: expected?.nextCheckInAt ?? null,
        expected_status: expected?.status ?? null,
        expected_updated_at: expected?.updatedAt ?? null,
      }
    }),
    p_user_ids: userIds,
  })

  if (error?.message?.includes("Collaboration state changed") || error?.code === "23505") {
    throw createError({
      statusCode: 409,
      statusMessage: "The collaboration changed after this action began. Refresh and try again.",
    })
  }

  if (error)
    throw error
}
