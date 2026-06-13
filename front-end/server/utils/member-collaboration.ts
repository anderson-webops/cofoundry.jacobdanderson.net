import type { H3Event } from "h3"
import type {
  ConnectRequest,
  Contract,
  ContractVersion,
  Conversation,
  Match,
  Message,
  Notification,
  Proposal,
  ProposalComment,
  ProposalVersion,
  RelationshipDecision,
  Signature,
  TrialCollaboration,
  WorkspaceSeed,
} from "../../shared/types/domain"
import type { PersistedCollaborationState } from "./local-collaboration-store"
import { cloneValue } from "../../shared/utils/clone"
import { loadLocalCollaborationState, persistLocalCollaborationState } from "./local-collaboration-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

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
  return nextSeed
}

function extractUserCollaborationState(seed: WorkspaceSeed, userId: string): PersistedCollaborationState {
  const connectRequests = seed.connectRequests.filter(request => request.fromUserId === userId || request.toUserId === userId)
  const matches = seed.matches.filter(match => match.participantIds.includes(userId))
  const matchIds = new Set(matches.map(match => match.id))
  const conversations = seed.conversations.filter(conversation => conversation.participantIds.includes(userId))
  const conversationIds = new Set(conversations.map(conversation => conversation.id))
  const messages = seed.messages.filter(message => conversationIds.has(message.conversationId))
  const proposals = seed.proposals.filter(proposal => proposal.createdByUserId === userId || proposal.recipientUserId === userId)
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const proposalVersions = seed.proposalVersions.filter(version => proposalIds.has(version.proposalId))
  const proposalComments = seed.proposalComments.filter(comment => proposalIds.has(comment.proposalId))
  const contracts = seed.contracts.filter(contract => proposalIds.has(contract.proposalId))
  const contractIds = new Set(contracts.map(contract => contract.id))
  const contractVersions = seed.contractVersions.filter(version => contractIds.has(version.contractId))
  const signatures = seed.signatures.filter(signature => contractIds.has(signature.contractId))
  const trialCollaborations = seed.trialCollaborations.filter(trial => matchIds.has(trial.matchId))
  const relationshipDecisions = seed.relationshipDecisions.filter(decision => matchIds.has(decision.matchId))
  const notifications = seed.notifications.filter(notification => notification.userId === userId)

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

  const { data, error } = await adminClient
    .from("proposal_versions")
    .select("*")
    .in("proposal_id", proposalIds)
    .order("version_number", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedProposalVersionRow[]
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

  const { data, error } = await adminClient
    .from("contract_versions")
    .select("*")
    .in("contract_id", contractIds)
    .order("version_number", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedContractVersionRow[]
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

async function replaceRows<T extends { id: string }>(
  adminClient: AdminClient,
  table: string,
  runDelete: () => any,
  rows: T[],
) {
  const { error: deleteError } = await runDelete()
  if (deleteError)
    throw deleteError

  if (!rows.length)
    return

  const { error } = await adminClient.from(table).insert(rows)
  if (error)
    throw error
}

export function mergeServerCollaborationState(seed: WorkspaceSeed, state: PersistedCollaborationState) {
  return mergeCollaborationState(seed, state)
}

export async function loadServerCollaborationState(event: H3Event, userId: string) {
  if (!isSupabaseEnabled(event))
    return await loadLocalCollaborationState(userId) || buildEmptyState()

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
  } satisfies PersistedCollaborationState
}

export async function persistServerCollaborationState(event: H3Event, userId: string, seed: WorkspaceSeed) {
  const state = extractUserCollaborationState(seed, userId)

  if (!isSupabaseEnabled(event)) {
    await persistLocalCollaborationState(userId, state)
    return
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const conversationIds = state.conversations.map(conversation => conversation.id)
  const proposalIds = state.proposals.map(proposal => proposal.id)
  const contractIds = state.contracts.map(contract => contract.id)
  const matchIds = state.matches.map(match => match.id)

  await replaceRows(
    adminClient,
    "connect_requests",
    () => adminClient.from("connect_requests").delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
    state.connectRequests.map(toConnectRequestRow),
  )
  await replaceRows(
    adminClient,
    "matches",
    () => adminClient.from("matches").delete().contains("participant_ids", [userId]),
    state.matches.map(toMatchRow),
  )
  await replaceRows(
    adminClient,
    "conversations",
    () => adminClient.from("conversations").delete().contains("participant_ids", [userId]),
    state.conversations.map(toConversationRow),
  )
  await replaceRows(
    adminClient,
    "messages",
    () => conversationIds.length
      ? adminClient.from("messages").delete().in("conversation_id", conversationIds)
      : adminClient.from("messages").delete().eq("id", "__none__"),
    state.messages.map(toMessageRow),
  )
  await replaceRows(
    adminClient,
    "proposals",
    () => adminClient.from("proposals").delete().or(`created_by_user_id.eq.${userId},recipient_user_id.eq.${userId}`),
    state.proposals.map(toProposalRow),
  )
  await replaceRows(
    adminClient,
    "proposal_versions",
    () => proposalIds.length
      ? adminClient.from("proposal_versions").delete().in("proposal_id", proposalIds)
      : adminClient.from("proposal_versions").delete().eq("id", "__none__"),
    state.proposalVersions.map(toProposalVersionRow),
  )
  await replaceRows(
    adminClient,
    "proposal_comments",
    () => proposalIds.length
      ? adminClient.from("proposal_comments").delete().in("proposal_id", proposalIds)
      : adminClient.from("proposal_comments").delete().eq("id", "__none__"),
    state.proposalComments.map(toProposalCommentRow),
  )
  await replaceRows(
    adminClient,
    "contracts",
    () => proposalIds.length
      ? adminClient.from("contracts").delete().in("proposal_id", proposalIds)
      : adminClient.from("contracts").delete().eq("id", "__none__"),
    state.contracts.map(toContractRow),
  )
  await replaceRows(
    adminClient,
    "contract_versions",
    () => contractIds.length
      ? adminClient.from("contract_versions").delete().in("contract_id", contractIds)
      : adminClient.from("contract_versions").delete().eq("id", "__none__"),
    state.contractVersions.map(toContractVersionRow),
  )
  await replaceRows(
    adminClient,
    "signatures",
    () => contractIds.length
      ? adminClient.from("signatures").delete().in("contract_id", contractIds)
      : adminClient.from("signatures").delete().eq("id", "__none__"),
    state.signatures.map(toSignatureRow),
  )
  await replaceRows(
    adminClient,
    "trial_collaborations",
    () => matchIds.length
      ? adminClient.from("trial_collaborations").delete().in("match_id", matchIds)
      : adminClient.from("trial_collaborations").delete().eq("id", "__none__"),
    state.trialCollaborations.map(toTrialCollaborationRow),
  )
  await replaceRows(
    adminClient,
    "relationship_decisions",
    () => matchIds.length
      ? adminClient.from("relationship_decisions").delete().in("match_id", matchIds)
      : adminClient.from("relationship_decisions").delete().eq("id", "__none__"),
    state.relationshipDecisions.map(toRelationshipDecisionRow),
  )
  await replaceRows(
    adminClient,
    "notifications",
    () => adminClient.from("notifications").delete().eq("user_id", userId),
    state.notifications.map(toNotificationRow),
  )
}
