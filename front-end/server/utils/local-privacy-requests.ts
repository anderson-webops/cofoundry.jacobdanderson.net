import type { AdminAction, PrivacyRequest, PrivacyRequestStatus } from "../../shared/types/domain"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { assertLocalAdminActor } from "./local-admin-audit"
import { withLocalAdminSecurityLock } from "./local-admin-security-lock"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

interface LocalPrivacyRequestStore {
  actions: AdminAction[]
  requests: PrivacyRequest[]
  updatedAt: string
  version: 1
}

const privacyRequestStoreFilename = "privacy-requests.json"
const defaultRetentionLimit = 500
let writeQueue = Promise.resolve()
let cachedStore: LocalPrivacyRequestStore | null = null
let cachedStorePath: string | null = null

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), privacyRequestStoreFilename)
}

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 1), 2000)
}

function emptyStore(): LocalPrivacyRequestStore {
  return {
    actions: [],
    requests: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function newestFirst<T extends { createdAt: string }>(rows: T[]) {
  return [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function pruneStore(store: LocalPrivacyRequestStore): LocalPrivacyRequestStore {
  return {
    ...store,
    actions: newestFirst(store.actions).slice(0, retentionLimit()),
    requests: newestFirst(store.requests).slice(0, retentionLimit()),
    updatedAt: new Date().toISOString(),
  }
}

async function readStoreFile() {
  return readPrivateTextFile(storePath())
}

async function readStore() {
  const path = storePath()
  if (cachedStore && cachedStorePath === path)
    return cachedStore

  const contents = await readStoreFile()
  if (!contents) {
    cachedStore = emptyStore()
    cachedStorePath = path
    return cachedStore
  }

  cachedStore = {
    ...emptyStore(),
    ...JSON.parse(contents),
  } as LocalPrivacyRequestStore
  cachedStorePath = path
  return cachedStore
}

async function writeStore(store: LocalPrivacyRequestStore) {
  const path = storePath()
  const prunedStore = pruneStore(store)

  await writePrivateFileAtomic(path, `${JSON.stringify(prunedStore)}\n`)
  cachedStore = prunedStore
  cachedStorePath = path
}

async function updateStore<T>(updater: (_store: LocalPrivacyRequestStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function createLocalPrivacyRequest(request: PrivacyRequest) {
  return updateStore((store) => {
    store.requests = [request, ...store.requests]
    return request
  })
}

export async function listLocalPrivacyRequests() {
  const store = pruneStore(await readStore())
  return store.requests
}

export async function listLocalPrivacyRequestsForUser(userId: string) {
  return (await listLocalPrivacyRequests()).filter(request => request.userId === userId)
}

export async function listLocalPrivacyAdminActions() {
  return pruneStore(await readStore()).actions
}

export async function persistLocalPrivacyRequestStatusAction(input: {
  action: AdminAction
  completionConfirmed: boolean
  expectedStatus: "open" | "reviewed"
  status: Exclude<PrivacyRequestStatus, "open">
}) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(input.action.adminUserId)

    return updateStore((store) => {
      const request = store.requests.find(row => row.id === input.action.targetId)
      if (!request) {
        throw Object.assign(new Error("Privacy request was not found."), {
          statusCode: 404,
          statusMessage: "Privacy request was not found.",
        })
      }

      if (request.status !== input.expectedStatus) {
        throw Object.assign(new Error("The privacy request changed after this review began. Refresh and review the current state."), {
          statusCode: 409,
          statusMessage: "The privacy request changed after this review began. Refresh and review the current state.",
        })
      }

      if (input.status === "reviewed" && request.status !== "open") {
        throw Object.assign(new Error("The requested privacy-request transition is invalid."), {
          statusCode: 409,
          statusMessage: "The requested privacy-request transition is invalid.",
        })
      }

      if (input.status === "resolved" && !input.completionConfirmed) {
        throw Object.assign(new Error("Confirm that the requested privacy action was actually completed before resolving it."), {
          statusCode: 400,
          statusMessage: "Confirm that the requested privacy action was actually completed before resolving it.",
        })
      }

      request.status = input.status
      if (input.status === "reviewed") {
        request.reviewNotes = input.action.notes
        request.reviewedAt = input.action.createdAt
        request.reviewedByUserId = input.action.adminUserId
      }
      else {
        request.reviewNotes ||= input.action.notes
        request.reviewedAt ||= input.action.createdAt
        request.reviewedByUserId ||= input.action.adminUserId
        request.resolutionNotes = input.action.notes
        request.resolvedAt = input.action.createdAt
        request.resolvedByUserId = input.action.adminUserId
      }

      store.actions = [input.action, ...store.actions.filter(action => action.id !== input.action.id)]
      return request
    })
  })
}

export async function clearLocalPrivacyRequestStoreForTests() {
  await writeQueue
  cachedStore = null
  cachedStorePath = null
  await rm(storePath(), { force: true })
}
