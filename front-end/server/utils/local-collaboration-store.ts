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
} from "../../shared/types/domain"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

export interface PersistedCollaborationState {
  connectRequests: ConnectRequest[]
  contractVersions: ContractVersion[]
  contracts: Contract[]
  conversations: Conversation[]
  investmentApplications: InvestmentApplication[]
  matches: Match[]
  messages: Message[]
  notifications: Notification[]
  proposalComments: ProposalComment[]
  proposalVersions: ProposalVersion[]
  proposals: Proposal[]
  relationshipDecisions: RelationshipDecision[]
  reports: Report[]
  signatures: Signature[]
  trialCollaborations: TrialCollaboration[]
}

interface LocalCollaborationStore extends PersistedCollaborationState {
  updatedAt: string
  version: 1
}

const localCollaborationFilename = "collaboration-state.json"
const defaultRetentionLimit = 1000

let writeQueue = Promise.resolve()

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), localCollaborationFilename)
}

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 100), 5000)
}

function emptyCollaborationState(): PersistedCollaborationState {
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

function emptyStore(): LocalCollaborationStore {
  return {
    ...emptyCollaborationState(),
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function seededStore(): LocalCollaborationStore {
  return {
    connectRequests: cloneValue(workspaceSeed.connectRequests),
    contractVersions: cloneValue(workspaceSeed.contractVersions),
    contracts: cloneValue(workspaceSeed.contracts),
    conversations: cloneValue(workspaceSeed.conversations),
    investmentApplications: cloneValue(workspaceSeed.investmentApplications),
    matches: cloneValue(workspaceSeed.matches),
    messages: cloneValue(workspaceSeed.messages),
    notifications: cloneValue(workspaceSeed.notifications),
    proposalComments: cloneValue(workspaceSeed.proposalComments),
    proposalVersions: cloneValue(workspaceSeed.proposalVersions),
    proposals: cloneValue(workspaceSeed.proposals),
    relationshipDecisions: cloneValue(workspaceSeed.relationshipDecisions),
    reports: cloneValue(workspaceSeed.reports),
    signatures: cloneValue(workspaceSeed.signatures),
    trialCollaborations: cloneValue(workspaceSeed.trialCollaborations),
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function newestFirst<T extends { createdAt?: string, lastMessageAt?: string, signedAt?: string, updatedAt?: string }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.updatedAt || left.lastMessageAt || left.signedAt || 0).getTime()
    const rightTime = new Date(right.createdAt || right.updatedAt || right.lastMessageAt || right.signedAt || 0).getTime()
    return rightTime - leftTime
  })
}

function pruneStore(store: LocalCollaborationStore): LocalCollaborationStore {
  const limit = retentionLimit()

  return {
    ...store,
    connectRequests: newestFirst(store.connectRequests).slice(0, limit),
    contractVersions: newestFirst(store.contractVersions).slice(0, limit),
    contracts: newestFirst(store.contracts).slice(0, limit),
    conversations: newestFirst(store.conversations).slice(0, limit),
    investmentApplications: newestFirst(store.investmentApplications).slice(0, limit),
    matches: newestFirst(store.matches).slice(0, limit),
    messages: newestFirst(store.messages).slice(0, limit),
    notifications: newestFirst(store.notifications).slice(0, limit),
    proposalComments: newestFirst(store.proposalComments).slice(0, limit),
    proposalVersions: newestFirst(store.proposalVersions).slice(0, limit),
    proposals: newestFirst(store.proposals).slice(0, limit),
    relationshipDecisions: newestFirst(store.relationshipDecisions).slice(0, limit),
    reports: newestFirst(store.reports).slice(0, limit),
    signatures: newestFirst(store.signatures).slice(0, limit),
    trialCollaborations: newestFirst(store.trialCollaborations).slice(0, limit),
    updatedAt: new Date().toISOString(),
  }
}

async function readStoreFile() {
  return readPrivateTextFile(storePath())
}

async function readStore(seedForWrite = false) {
  const contents = await readStoreFile()
  if (!contents)
    return seedForWrite ? seededStore() : emptyStore()

  return {
    ...emptyStore(),
    ...JSON.parse(contents),
  } as LocalCollaborationStore
}

async function writeStore(store: LocalCollaborationStore) {
  await writePrivateFileAtomic(storePath(), `${JSON.stringify(pruneStore(store), null, 2)}\n`)
}

async function updateStore<T>(updater: (_store: LocalCollaborationStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore(true)
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function upsertById<T extends { id: string }>(existing: T[], nextRows: T[]) {
  const nextIds = new Set(nextRows.map(row => row.id))
  return [
    ...existing.filter(row => !nextIds.has(row.id)),
    ...cloneValue(nextRows),
  ]
}

function preserveUnobservedRows<T extends { id: string }>(current: T[], observed: T[], next: T[]) {
  const observedIds = new Set(observed.map(row => row.id))
  const nextIds = new Set(next.map(row => row.id))
  return [
    ...cloneValue(next),
    ...cloneValue(current.filter(row => !observedIds.has(row.id) && !nextIds.has(row.id))),
  ]
}

function mergeUnobservedRows(
  current: PersistedCollaborationState,
  observed: PersistedCollaborationState,
  next: PersistedCollaborationState,
): PersistedCollaborationState {
  return {
    connectRequests: preserveUnobservedRows(current.connectRequests, observed.connectRequests, next.connectRequests),
    contractVersions: preserveUnobservedRows(current.contractVersions, observed.contractVersions, next.contractVersions),
    contracts: preserveUnobservedRows(current.contracts, observed.contracts, next.contracts),
    conversations: preserveUnobservedRows(current.conversations, observed.conversations, next.conversations),
    investmentApplications: preserveUnobservedRows(current.investmentApplications, observed.investmentApplications, next.investmentApplications),
    matches: preserveUnobservedRows(current.matches, observed.matches, next.matches),
    messages: preserveUnobservedRows(current.messages, observed.messages, next.messages),
    notifications: preserveUnobservedRows(current.notifications, observed.notifications, next.notifications),
    proposalComments: preserveUnobservedRows(current.proposalComments, observed.proposalComments, next.proposalComments),
    proposalVersions: preserveUnobservedRows(current.proposalVersions, observed.proposalVersions, next.proposalVersions),
    proposals: preserveUnobservedRows(current.proposals, observed.proposals, next.proposals),
    relationshipDecisions: preserveUnobservedRows(current.relationshipDecisions, observed.relationshipDecisions, next.relationshipDecisions),
    reports: preserveUnobservedRows(current.reports, observed.reports, next.reports),
    signatures: preserveUnobservedRows(current.signatures, observed.signatures, next.signatures),
    trialCollaborations: preserveUnobservedRows(current.trialCollaborations, observed.trialCollaborations, next.trialCollaborations),
  }
}

function extractLocalStateForUsers(state: PersistedCollaborationState, userIds: string[]): PersistedCollaborationState {
  const userIdSet = new Set(userIds)
  const connectRequests = state.connectRequests.filter(request => userIdSet.has(request.fromUserId) || userIdSet.has(request.toUserId))
  const matches = state.matches.filter(match => match.participantIds.some(userId => userIdSet.has(userId)))
  const matchIds = new Set(matches.map(match => match.id))
  const conversations = state.conversations.filter(conversation => conversation.participantIds.some(userId => userIdSet.has(userId)))
  const conversationIds = new Set(conversations.map(conversation => conversation.id))
  const proposals = state.proposals.filter(proposal => userIdSet.has(proposal.createdByUserId) || userIdSet.has(proposal.recipientUserId))
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const contracts = state.contracts.filter(contract => proposalIds.has(contract.proposalId))
  const contractIds = new Set(contracts.map(contract => contract.id))

  return {
    connectRequests,
    contractVersions: state.contractVersions.filter(version => contractIds.has(version.contractId)),
    contracts,
    conversations,
    investmentApplications: state.investmentApplications.filter(application => userIdSet.has(application.applicantUserId)),
    matches,
    messages: state.messages.filter(message => conversationIds.has(message.conversationId)),
    notifications: state.notifications.filter(notification => userIdSet.has(notification.userId)),
    proposalComments: state.proposalComments.filter(comment => proposalIds.has(comment.proposalId)),
    proposalVersions: state.proposalVersions.filter(version => proposalIds.has(version.proposalId)),
    proposals,
    relationshipDecisions: state.relationshipDecisions.filter(decision => matchIds.has(decision.matchId)),
    reports: state.reports.filter(report => userIdSet.has(report.reporterUserId)),
    signatures: state.signatures.filter(signature => contractIds.has(signature.contractId)),
    trialCollaborations: state.trialCollaborations.filter(trial => matchIds.has(trial.matchId)),
  }
}

function collaborationStateFingerprint(state: PersistedCollaborationState) {
  return JSON.stringify(Object.fromEntries(
    Object.entries(state).map(([key, rows]) => [
      key,
      [...rows].sort((left, right) => left.id.localeCompare(right.id)),
    ]),
  ))
}

function assertExpectedCollaborationState(
  store: LocalCollaborationStore,
  expected: PersistedCollaborationState,
  userIds: string[],
) {
  const current = extractLocalStateForUsers(pruneStore(store), userIds)

  // The local runtime starts from demonstration seed data. An empty private
  // store is therefore a valid first-write bootstrap, but every later write
  // must be based on the exact affected-user snapshot that was loaded.
  if (!hasCollaborationRows(current))
    return

  if (collaborationStateFingerprint(current) === collaborationStateFingerprint(expected))
    return

  throw Object.assign(new Error("Collaboration state changed after this action began."), {
    statusCode: 409,
    statusMessage: "The collaboration changed after this action began. Refresh and try again.",
  })
}

function buildUserIndexes(state: PersistedCollaborationState, userId: string) {
  const matchIds = new Set(state.matches.filter(match => match.participantIds.includes(userId)).map(match => match.id))
  const conversationIds = new Set(state.conversations.filter(conversation => conversation.participantIds.includes(userId)).map(conversation => conversation.id))
  const proposalIds = new Set(state.proposals.filter(proposal => proposal.createdByUserId === userId || proposal.recipientUserId === userId).map(proposal => proposal.id))
  const contractIds = new Set(state.contracts.filter(contract => proposalIds.has(contract.proposalId)).map(contract => contract.id))

  return {
    contractIds,
    conversationIds,
    matchIds,
    proposalIds,
  }
}

function removeExistingUserState(store: LocalCollaborationStore, userId: string) {
  const indexes = buildUserIndexes(store, userId)

  store.connectRequests = store.connectRequests.filter(request => request.fromUserId !== userId && request.toUserId !== userId)
  store.matches = store.matches.filter(match => !match.participantIds.includes(userId))
  store.conversations = store.conversations.filter(conversation => !conversation.participantIds.includes(userId))
  store.messages = store.messages.filter(message => !indexes.conversationIds.has(message.conversationId))
  store.proposals = store.proposals.filter(proposal => proposal.createdByUserId !== userId && proposal.recipientUserId !== userId)
  store.proposalVersions = store.proposalVersions.filter(version => !indexes.proposalIds.has(version.proposalId))
  store.proposalComments = store.proposalComments.filter(comment => !indexes.proposalIds.has(comment.proposalId))
  store.contracts = store.contracts.filter(contract => !indexes.proposalIds.has(contract.proposalId))
  store.contractVersions = store.contractVersions.filter(version => !indexes.contractIds.has(version.contractId))
  store.signatures = store.signatures.filter(signature => !indexes.contractIds.has(signature.contractId))
  store.trialCollaborations = store.trialCollaborations.filter(trial => !indexes.matchIds.has(trial.matchId))
  store.relationshipDecisions = store.relationshipDecisions.filter(decision => !indexes.matchIds.has(decision.matchId))
  store.notifications = store.notifications.filter(notification => notification.userId !== userId)
}

export function hasCollaborationRows(state: PersistedCollaborationState) {
  return Object.values(state).some(rows => Array.isArray(rows) && rows.length > 0)
}

export function filterCollaborationStateForUser(
  state: PersistedCollaborationState,
  userId: string,
  options: { includeAdministrativeData?: boolean } = {},
): PersistedCollaborationState {
  const connectRequests = state.connectRequests.filter(request => request.fromUserId === userId || request.toUserId === userId)
  const matches = state.matches.filter(match => match.participantIds.includes(userId))
  const matchIds = new Set(matches.map(match => match.id))
  const conversations = state.conversations.filter(conversation => conversation.participantIds.includes(userId))
  const conversationIds = new Set(conversations.map(conversation => conversation.id))
  const messages = state.messages.filter(message => conversationIds.has(message.conversationId))
  const proposals = state.proposals.filter(proposal => proposal.createdByUserId === userId || proposal.recipientUserId === userId)
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const proposalVersions = state.proposalVersions.filter(version => proposalIds.has(version.proposalId))
  const proposalComments = state.proposalComments.filter(comment => proposalIds.has(comment.proposalId))
  const contracts = state.contracts.filter(contract => proposalIds.has(contract.proposalId))
  const contractIds = new Set(contracts.map(contract => contract.id))
  const contractVersions = state.contractVersions.filter(version => contractIds.has(version.contractId))
  const signatures = state.signatures.filter(signature => contractIds.has(signature.contractId))
  const trialCollaborations = state.trialCollaborations.filter(trial => matchIds.has(trial.matchId))
  const relationshipDecisions = state.relationshipDecisions.filter(decision => matchIds.has(decision.matchId))
  const notifications = state.notifications.filter(notification => notification.userId === userId)

  return {
    connectRequests,
    contractVersions,
    contracts,
    conversations,
    investmentApplications: options.includeAdministrativeData
      ? state.investmentApplications
      : state.investmentApplications.filter(application => application.applicantUserId === userId),
    matches,
    messages,
    notifications,
    proposalComments,
    proposalVersions,
    proposals,
    relationshipDecisions,
    reports: options.includeAdministrativeData
      ? state.reports
      : state.reports.filter(report => report.reporterUserId === userId),
    signatures,
    trialCollaborations,
  }
}

export async function loadLocalCollaborationState(
  userId: string,
  options: { includeAdministrativeData?: boolean } = {},
) {
  const store = pruneStore(await readStore())
  const state = filterCollaborationStateForUser(store, userId, options)
  return hasCollaborationRows(state) ? state : null
}

export async function findLocalReportById(reportId: string) {
  const store = await readStore()
  return store.reports.find(report => report.id === reportId) || null
}

export async function persistLocalCollaborationStateForUsers(
  userIds: string[],
  state: PersistedCollaborationState,
  options: { expectedState?: PersistedCollaborationState } = {},
) {
  return updateStore((store) => {
    const uniqueUserIds = [...new Set(userIds)]
    let nextState = cloneValue(state)

    if (options.expectedState) {
      const currentState = extractLocalStateForUsers(pruneStore(store), uniqueUserIds)
      const reconciledExpectedState = mergeUnobservedRows(currentState, options.expectedState, options.expectedState)
      assertExpectedCollaborationState(store, reconciledExpectedState, uniqueUserIds)
      nextState = mergeUnobservedRows(currentState, options.expectedState, nextState)
    }

    for (const userId of uniqueUserIds)
      removeExistingUserState(store, userId)

    store.connectRequests = upsertById(store.connectRequests, nextState.connectRequests)
    store.matches = upsertById(store.matches, nextState.matches)
    store.conversations = upsertById(store.conversations, nextState.conversations)
    store.investmentApplications = upsertById(store.investmentApplications, nextState.investmentApplications)
    store.messages = upsertById(store.messages, nextState.messages)
    store.proposals = upsertById(store.proposals, nextState.proposals)
    store.proposalVersions = upsertById(store.proposalVersions, nextState.proposalVersions)
    store.proposalComments = upsertById(store.proposalComments, nextState.proposalComments)
    store.contracts = upsertById(store.contracts, nextState.contracts)
    store.contractVersions = upsertById(store.contractVersions, nextState.contractVersions)
    store.signatures = upsertById(store.signatures, nextState.signatures)
    store.trialCollaborations = upsertById(store.trialCollaborations, nextState.trialCollaborations)
    store.relationshipDecisions = upsertById(store.relationshipDecisions, nextState.relationshipDecisions)
    store.notifications = upsertById(store.notifications, nextState.notifications)
    store.reports = upsertById(store.reports, nextState.reports)
    return cloneValue(nextState)
  })
}

export async function persistLocalCollaborationState(userId: string, state: PersistedCollaborationState) {
  await persistLocalCollaborationStateForUsers([userId], state)
  return filterCollaborationStateForUser(state, userId)
}

export async function recordLocalReportSubmission(report: Report, notifications: Notification[]) {
  return updateStore((store) => {
    store.reports = upsertById(store.reports, [report])
    store.notifications = upsertById(store.notifications, notifications)
    return report
  })
}

export async function recordLocalInvestmentApplication(application: InvestmentApplication) {
  return updateStore((store) => {
    const duplicate = store.investmentApplications.some(existing =>
      existing.applicantUserId === application.applicantUserId
      && existing.opportunityId === application.opportunityId
      && existing.status !== "declined",
    )
    if (duplicate) {
      throw Object.assign(new Error("An active investment application already exists for this opportunity."), {
        statusCode: 409,
        statusMessage: "An active investment application already exists for this opportunity.",
      })
    }

    store.investmentApplications = upsertById(store.investmentApplications, [application])
    return application
  })
}

export async function clearLocalCollaborationStoreForTests() {
  await rm(storePath(), { force: true })
}
