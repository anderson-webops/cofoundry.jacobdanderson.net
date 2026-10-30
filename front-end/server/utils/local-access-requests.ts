import type { z } from "zod"
import type { AccessRequest, AdminAction } from "../../shared/types/domain"
import type { accessRequestSchema } from "../../shared/utils/validation"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { assertLocalAdminActor } from "./local-admin-audit"
import { withLocalAdminSecurityLock } from "./local-admin-security-lock"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

type AccessRequestPayload = z.infer<typeof accessRequestSchema>

interface LocalAccessRequestRow extends AccessRequest {
  inviteTokenHash: string | null
}

interface LocalAccessRequestStore {
  actions: AdminAction[]
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
    actions: [],
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

function newestFirst<T extends { createdAt: string }>(rows: T[]) {
  return [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function pruneStore(store: LocalAccessRequestStore): LocalAccessRequestStore {
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
  } as LocalAccessRequestStore
  cachedStorePath = path
  return cachedStore
}

async function writeStore(store: LocalAccessRequestStore) {
  const path = storePath()
  const prunedStore = pruneStore(store)

  await writePrivateFileAtomic(path, `${JSON.stringify(prunedStore)}\n`)
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

export async function createLocalAccessRequestResult(payload: AccessRequestPayload) {
  const email = normalizeEmail(payload.email)

  return updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.requests.find(request => request.email === email && request.status !== "denied" && !request.inviteAcceptedAt)

    if (existing) {
      return {
        created: false,
        request: publicRequest(existing),
      }
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
    return {
      created: true,
      request: publicRequest(row),
    }
  })
}

export async function createLocalAccessRequest(payload: AccessRequestPayload) {
  return (await createLocalAccessRequestResult(payload)).request
}

export async function listLocalAccessRequests() {
  const store = pruneStore(await readStore())
  return store.requests.map(publicRequest)
}

export async function listLocalAccessAdminActions() {
  return pruneStore(await readStore()).actions
}

export async function applyLocalAdminAccessRequestStatus(
  id: string,
  payload: {
    action: AdminAction
    expectedUpdatedAt: string
    status: "approved" | "denied" | "open"
  },
) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(payload.action.adminUserId)

    return updateStore((store) => {
      const request = store.requests.find(row => row.id === id)
      if (!request)
        return null

      if (request.updatedAt !== payload.expectedUpdatedAt) {
        throw Object.assign(new Error("The access request changed after this review began. Refresh and review the current state."), {
          statusCode: 409,
          statusMessage: "The access request changed after this review began. Refresh and review the current state.",
        })
      }

      if (request.inviteAcceptedAt) {
        throw Object.assign(new Error("An accepted access invite cannot be reopened or denied."), {
          statusCode: 409,
          statusMessage: "An accepted access invite cannot be reopened or denied.",
        })
      }

      request.adminNotes = payload.action.notes
      request.inviteExpiresAt = null
      request.inviteTokenHash = null
      request.inviteTokenIssuedAt = null
      request.reviewedAt = payload.action.createdAt
      request.reviewedByUserId = payload.action.adminUserId
      request.status = payload.status
      request.updatedAt = payload.action.createdAt
      store.actions = [
        payload.action,
        ...store.actions.filter(action => action.id !== payload.action.id)
      ]
      return publicRequest(request)
    })
  })
}

export async function issueLocalAdminAccessInvite(id: string, payload: {
  action: AdminAction
  appUrl: string
  expectedUpdatedAt: string
}) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(payload.action.adminUserId)

    return updateStore((store) => {
      const request = store.requests.find(row => row.id === id)
      if (!request)
        return null

      if (request.updatedAt !== payload.expectedUpdatedAt) {
        throw Object.assign(new Error("The access request changed after this review began. Refresh and review the current state."), {
          statusCode: 409,
          statusMessage: "The access request changed after this review began. Refresh and review the current state.",
        })
      }

      if (request.inviteAcceptedAt) {
        throw Object.assign(new Error("An accepted access invite cannot be reissued."), {
          statusCode: 409,
          statusMessage: "An accepted access invite cannot be reissued.",
        })
      }

      if (!["approved", "invited"].includes(request.status)) {
        throw Object.assign(new Error("Approve the access request before issuing an invite."), {
          statusCode: 409,
          statusMessage: "Approve the access request before issuing an invite.",
        })
      }

      const token = randomBytes(32).toString("base64url")
      const now = new Date(payload.action.createdAt)
      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + inviteLifetimeDays)

      request.adminNotes = payload.action.notes
      request.inviteAcceptedAt = null
      request.inviteExpiresAt = expiresAt.toISOString()
      request.inviteTokenHash = tokenHash(token)
      request.inviteTokenIssuedAt = payload.action.createdAt
      request.reviewedAt = payload.action.createdAt
      request.reviewedByUserId = payload.action.adminUserId
      request.status = "invited"
      request.updatedAt = payload.action.createdAt
      store.actions = [
        payload.action,
        ...store.actions.filter(action => action.id !== payload.action.id)
      ]

      return {
        inviteToken: token,
        inviteUrl: `${payload.appUrl.replace(/\/+$/, "")}/auth/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(request.email)}`,
        request: publicRequest(request),
      }
    })
  })
}

export async function validateLocalAccessInvite(token: string, email?: string) {
  const hash = tokenHash(token.trim())
  const normalizedEmail = email
    ? normalizeEmail(email)
    : ""
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

export async function markLocalAccessInviteAccepted(token: string, email: string) {
  const hash = tokenHash(token.trim())
  const normalizedEmail = normalizeEmail(email)

  return updateStore((store) => {
    const request = store.requests.find(row => row.inviteTokenHash === hash)
    const now = new Date().toISOString()
    if (
      !request
      || request.status !== "invited"
      || request.email !== normalizedEmail
      || request.inviteAcceptedAt
      || !request.inviteExpiresAt
      || request.inviteExpiresAt < now
    ) {
      return null
    }

    request.inviteAcceptedAt = now
    request.inviteExpiresAt = null
    request.inviteTokenHash = null
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
