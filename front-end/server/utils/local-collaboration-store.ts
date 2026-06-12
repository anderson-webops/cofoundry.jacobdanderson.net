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
  Report,
  Signature,
  TrialCollaboration,
} from "../../shared/types/domain"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { cloneValue } from "../../shared/utils/clone"

export interface PersistedCollaborationState {
  connectRequests: ConnectRequest[]
  contractVersions: ContractVersion[]
  contracts: Contract[]
  conversations: Conversation[]
  matches: Match[]
  messages: Message[]
  notifications: Notification[]
  proposalComments: ProposalComment[]
  proposalVersions: ProposalVersion[]
  proposals: Proposal[]
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
    matches: [],
    messages: [],
    notifications: [],
    proposalComments: [],
    proposalVersions: [],
    proposals: [],
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
    matches: newestFirst(store.matches).slice(0, limit),
    messages: newestFirst(store.messages).slice(0, limit),
    notifications: newestFirst(store.notifications).slice(0, limit),
    proposalComments: newestFirst(store.proposalComments).slice(0, limit),
    proposalVersions: newestFirst(store.proposalVersions).slice(0, limit),
    proposals: newestFirst(store.proposals).slice(0, limit),
    reports: newestFirst(store.reports).slice(0, limit),
    signatures: newestFirst(store.signatures).slice(0, limit),
    trialCollaborations: newestFirst(store.trialCollaborations).slice(0, limit),
    updatedAt: new Date().toISOString(),
  }
}

async function readStoreFile() {
  try {
    return await readFile(storePath(), "utf-8")
  }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return null

    throw error
  }
}

async function readStore() {
  const contents = await readStoreFile()
  if (!contents)
    return emptyStore()

  return {
    ...emptyStore(),
    ...JSON.parse(contents),
  } as LocalCollaborationStore
}

async function writeStore(store: LocalCollaborationStore) {
  await mkdir(dirname(storePath()), { recursive: true })
  await writeFile(storePath(), `${JSON.stringify(pruneStore(store), null, 2)}\n`, "utf-8")
}

async function updateStore<T>(updater: (store: LocalCollaborationStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
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
  store.notifications = store.notifications.filter(notification => notification.userId !== userId)
}

export function hasCollaborationRows(state: PersistedCollaborationState) {
  return Object.values(state).some(rows => Array.isArray(rows) && rows.length > 0)
}

export function filterCollaborationStateForUser(state: PersistedCollaborationState, userId: string): PersistedCollaborationState {
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
  const notifications = state.notifications.filter(notification => notification.userId === userId)

  return {
    connectRequests,
    contractVersions,
    contracts,
    conversations,
    matches,
    messages,
    notifications,
    proposalComments,
    proposalVersions,
    proposals,
    reports: state.reports,
    signatures,
    trialCollaborations,
  }
}

export async function loadLocalCollaborationState(userId: string) {
  const store = pruneStore(await readStore())
  const state = filterCollaborationStateForUser(store, userId)
  return hasCollaborationRows(state) ? state : null
}

export async function persistLocalCollaborationState(userId: string, state: PersistedCollaborationState) {
  return updateStore((store) => {
    removeExistingUserState(store, userId)
    store.connectRequests = upsertById(store.connectRequests, state.connectRequests)
    store.matches = upsertById(store.matches, state.matches)
    store.conversations = upsertById(store.conversations, state.conversations)
    store.messages = upsertById(store.messages, state.messages)
    store.proposals = upsertById(store.proposals, state.proposals)
    store.proposalVersions = upsertById(store.proposalVersions, state.proposalVersions)
    store.proposalComments = upsertById(store.proposalComments, state.proposalComments)
    store.contracts = upsertById(store.contracts, state.contracts)
    store.contractVersions = upsertById(store.contractVersions, state.contractVersions)
    store.signatures = upsertById(store.signatures, state.signatures)
    store.trialCollaborations = upsertById(store.trialCollaborations, state.trialCollaborations)
    store.notifications = upsertById(store.notifications, state.notifications)
    store.reports = upsertById(store.reports, state.reports)
    return filterCollaborationStateForUser(store, userId)
  })
}

export async function clearLocalCollaborationStoreForTests() {
  await rm(storePath(), { force: true })
}
