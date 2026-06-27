import type { z } from "zod"
import type { AccessRequest } from "../../shared/types/domain"
import type { accessRequestSchema } from "../../shared/utils/validation"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"

type AccessRequestPayload = z.infer<typeof accessRequestSchema>

interface LocalAccessRequestRow extends AccessRequest {
  inviteTokenHash: string | null
}

interface LocalAccessRequestStore {
  requests: LocalAccessRequestRow[]
  updatedAt: string
  version: 1
}

const accessRequestStoreFilename = "access-requests.json"
const defaultRetentionLimit = 500
const inviteLifetimeDays = 30
let writeQueue = Promise.resolve()
let cachedStore: LocalAccessRequestStore | null = null
let cachedStorePath: string | null = null

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), accessRequestStoreFilename)
}

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 1), 2000)
}

function emptyStore(): LocalAccessRequestStore {
  return {
    requests: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("base64url")
}

function publicRequest(row: LocalAccessRequestRow): AccessRequest {
  const { inviteTokenHash: _inviteTokenHash, ...request } = row
  return request
}

function newestFirst(rows: LocalAccessRequestRow[]) {
  return [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function pruneStore(store: LocalAccessRequestStore): LocalAccessRequestStore {
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
  } as LocalAccessRequestStore
  cachedStorePath = path
  return cachedStore
}

async function writeStore(store: LocalAccessRequestStore) {
  const path = storePath()
  const prunedStore = pruneStore(store)

  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(prunedStore)}\n`, "utf-8")
  cachedStore = prunedStore
  cachedStorePath = path
}

async function updateStore<T>(updater: (_store: LocalAccessRequestStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function createLocalAccessRequest(payload: AccessRequestPayload) {
  const email = normalizeEmail(payload.email)

  return updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.requests.find(request => request.email === email && request.status !== "denied" && !request.inviteAcceptedAt)

    if (existing) {
      Object.assign(existing, {
        company: payload.company?.trim() || "",
        companyStage: payload.companyStage,
        name: payload.name.trim(),
        role: payload.role,
        source: payload.source?.trim() || "site",
        timeline: payload.timeline,
        updatedAt: now,
        useCase: payload.useCase.trim(),
      })
      return publicRequest(existing)
    }

    const row: LocalAccessRequestRow = {
      adminNotes: null,
      company: payload.company?.trim() || "",
      companyStage: payload.companyStage,
      createdAt: now,
      email,
      id: `access_${randomUUID().replaceAll("-", "")}`,
      inviteAcceptedAt: null,
      inviteExpiresAt: null,
      inviteTokenHash: null,
      inviteTokenIssuedAt: null,
      name: payload.name.trim(),
      reviewedAt: null,
      reviewedByUserId: null,
      role: payload.role,
      source: payload.source?.trim() || "site",
      status: "open",
      timeline: payload.timeline,
      updatedAt: now,
      useCase: payload.useCase.trim(),
    }

    store.requests = [row, ...store.requests]
    return publicRequest(row)
  })
}

export async function listLocalAccessRequests() {
  const store = pruneStore(await readStore())
  return store.requests.map(publicRequest)
}

export async function updateLocalAccessRequestStatus(id: string, payload: { adminNotes: string, reviewedByUserId: string, status: "approved" | "denied" | "open" }) {
  return updateStore((store) => {
    const request = store.requests.find(row => row.id === id)
    if (!request)
      return null

    const now = new Date().toISOString()
    request.adminNotes = payload.adminNotes
    request.reviewedAt = now
    request.reviewedByUserId = payload.reviewedByUserId
    request.status = payload.status
    request.updatedAt = now
    return publicRequest(request)
  })
}

export async function createLocalAccessInvite(id: string, payload: { adminNotes: string, appUrl: string, reviewedByUserId: string }) {
  return updateStore((store) => {
    const request = store.requests.find(row => row.id === id)
    if (!request)
      return null

    const token = randomBytes(32).toString("base64url")
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + inviteLifetimeDays)

    request.adminNotes = payload.adminNotes
    request.inviteAcceptedAt = null
    request.inviteExpiresAt = expiresAt.toISOString()
    request.inviteTokenHash = tokenHash(token)
    request.inviteTokenIssuedAt = now.toISOString()
    request.reviewedAt = now.toISOString()
    request.reviewedByUserId = payload.reviewedByUserId
    request.status = "invited"
    request.updatedAt = now.toISOString()

    const inviteUrl = `${payload.appUrl.replace(/\/+$/, "")}/auth/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(request.email)}`

    return {
      inviteToken: token,
      inviteUrl,
      request: publicRequest(request),
    }
  })
}

export async function validateLocalAccessInvite(token: string, email?: string) {
  const hash = tokenHash(token.trim())
  const normalizedEmail = email ? normalizeEmail(email) : ""
  const request = (await readStore()).requests.find(row => row.inviteTokenHash === hash)

  if (!request || request.status !== "invited")
    return null

  if (normalizedEmail && request.email !== normalizedEmail)
    return null

  if (request.inviteAcceptedAt)
    return null

  if (!request.inviteExpiresAt || new Date(request.inviteExpiresAt).getTime() < Date.now())
    return null

  return publicRequest(request)
}

export async function markLocalAccessInviteAccepted(token: string) {
  const hash = tokenHash(token.trim())

  return updateStore((store) => {
    const request = store.requests.find(row => row.inviteTokenHash === hash)
    if (!request)
      return null

    const now = new Date().toISOString()
    request.inviteAcceptedAt = now
    request.updatedAt = now
    return publicRequest(request)
  })
}

export async function clearLocalAccessRequestStoreForTests() {
  await writeQueue
  cachedStore = null
  cachedStorePath = null
  await rm(storePath(), { force: true })
}
