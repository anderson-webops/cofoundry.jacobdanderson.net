import type { PrivacyRequest, PrivacyRequestStatus } from "../../shared/types/domain"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"

interface LocalPrivacyRequestStore {
  requests: PrivacyRequest[]
  updatedAt: string
  version: 1
}

const privacyRequestStoreFilename = "privacy-requests.json"
const defaultRetentionLimit = 500
let writeQueue = Promise.resolve()

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

  return Math.min(Math.max(configuredLimit, 50), 2000)
}

function emptyStore(): LocalPrivacyRequestStore {
  return {
    requests: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function newestFirst(rows: PrivacyRequest[]) {
  return [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function pruneStore(store: LocalPrivacyRequestStore): LocalPrivacyRequestStore {
  return {
    ...store,
    requests: newestFirst(store.requests).slice(0, retentionLimit()),
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
  } as LocalPrivacyRequestStore
}

async function writeStore(store: LocalPrivacyRequestStore) {
  await mkdir(dirname(storePath()), { recursive: true })
  await writeFile(storePath(), `${JSON.stringify(pruneStore(store), null, 2)}\n`, "utf-8")
}

async function updateStore<T>(updater: (store: LocalPrivacyRequestStore) => T | Promise<T>) {
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

export async function updateLocalPrivacyRequestStatus(input: {
  adminUserId: string
  notes: string
  requestId: string
  status: Exclude<PrivacyRequestStatus, "open">
  timestamp: string
}) {
  return updateStore((store) => {
    const request = store.requests.find(row => row.id === input.requestId)
    if (!request)
      return null

    request.status = input.status

    if (input.status === "reviewed") {
      request.reviewNotes = input.notes
      request.reviewedAt = input.timestamp
      request.reviewedByUserId = input.adminUserId
    }
    else {
      request.resolutionNotes = input.notes
      request.resolvedAt = input.timestamp
      request.resolvedByUserId = input.adminUserId
    }

    return request
  })
}

export async function clearLocalPrivacyRequestStoreForTests() {
  await rm(storePath(), { force: true })
}
