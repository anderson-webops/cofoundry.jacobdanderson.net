import type { Buffer } from "node:buffer"
import type { z } from "zod"
import type { FileUpload, FileUploadRelatedType, SessionUser } from "../../shared/types/domain"
import type { fileScanResultSchema, fileUploadPolicySchema, operationsBackupRunSchema, operationsEmailSuppressionSchema, operationsEventSchema } from "../../shared/utils/validation"
import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"

type FileScanResultPayload = z.infer<typeof fileScanResultSchema>
type FileUploadPolicyPayload = z.infer<typeof fileUploadPolicySchema>
type OperationsBackupRunPayload = z.infer<typeof operationsBackupRunSchema>
type OperationsEmailSuppressionPayload = z.infer<typeof operationsEmailSuppressionSchema>
type OperationsEventPayload = z.infer<typeof operationsEventSchema>

interface NotificationDeliveryResult {
  bodyPreview?: string | null
  configured: boolean
  delivered: boolean
  error: string | null
  eventType?: string
  metadata?: Record<string, unknown>
  subject: string
  targetId?: string | null
  targetType?: string | null
  unreadCount: number
}

interface LocalNotificationDeliveryRow {
  body_preview: string | null
  channel: string
  created_at: string
  delivered_at: string | null
  error: string | null
  event_type: string
  id: string
  metadata: Record<string, unknown>
  notification_count: number
  recipient: string
  status: "sent" | "skipped" | "failed"
  subject: string
  target_id: string | null
  target_type: string | null
  user_id: string
}

interface LocalFileUploadRow {
  bucket: string
  created_at: string
  deleted_at?: string | null
  id: string
  local_file_path?: string | null
  local_upload_token_hash?: string | null
  mime_type: string
  object_path: string
  original_filename: string
  owner_user_id: string
  purpose: FileUploadPolicyPayload["purpose"]
  related_id: string | null
  related_type: NonNullable<FileUploadPolicyPayload["relatedType"]> | null
  scan_notes: string | null
  scan_status: "pending" | FileScanResultPayload["scanStatus"]
  size_bytes: number
  status: "pending" | NonNullable<FileScanResultPayload["status"]>
  updated_at: string
}

interface LocalBackupRunRow {
  artifact_uri: string | null
  completed_at: string | null
  created_at: string
  id: string
  metadata: Record<string, unknown>
  notes: string | null
  provider: string
  started_at: string
  status: OperationsBackupRunPayload["status"]
}

interface LocalOperationalEventRow {
  actor_user_id: string | null
  created_at: string
  event_type: string
  id: string
  metadata: Record<string, unknown>
  severity: OperationsEventPayload["severity"]
  source: string
  target_id: string | null
  target_type: string | null
}

interface LocalEmailSuppressionRow {
  category: OperationsEmailSuppressionPayload["category"]
  created_at: string
  email: string
  id: string
  metadata: Record<string, unknown>
  provider: string
  reason: OperationsEmailSuppressionPayload["reason"]
  source_event_id: string | null
  suppressed_at: string
}

interface LocalOperationsStore {
  backupRuns: LocalBackupRunRow[]
  emailSuppressions: LocalEmailSuppressionRow[]
  fileUploads: LocalFileUploadRow[]
  notificationDeliveries: LocalNotificationDeliveryRow[]
  operationalEvents: LocalOperationalEventRow[]
  updatedAt: string
  version: 1
}

const defaultRetentionLimit = 200
const localFileUploadDirectoryName = "local-file-uploads"
const localOperationsStoreFilename = "operations-telemetry.json"
const maxLocalUploadBytes = 10 * 1024 * 1024

let writeQueue = Promise.resolve()

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), localOperationsStoreFilename)
}

function localFileUploadRoot() {
  return resolve(rootDataDirectory(), localFileUploadDirectoryName)
}

function localFilePathForObjectPath(objectPath: string) {
  const root = localFileUploadRoot()
  const target = resolve(root, objectPath)

  if (!target.startsWith(`${root}/`))
    throw new Error("Local upload object path is outside the upload directory.")

  return target
}

export function hashLocalUploadToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_OPERATIONS_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 10), 1000)
}

function emptyStore(): LocalOperationsStore {
  return {
    backupRuns: [],
    emailSuppressions: [],
    fileUploads: [],
    notificationDeliveries: [],
    operationalEvents: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function getRowTime(row: object) {
  const record = row as Record<string, unknown>
  const value = record.created_at || record.started_at || record.updated_at
  return typeof value === "string" ? new Date(value).getTime() : 0
}

function newestFirst<T extends object>(rows: T[]) {
  return [...rows].sort((left, right) => getRowTime(right) - getRowTime(left))
}

function withRetention<T extends object>(rows: T[]) {
  return newestFirst(rows).slice(0, retentionLimit())
}

function pruneStore(store: LocalOperationsStore): LocalOperationsStore {
  return {
    ...store,
    backupRuns: withRetention(store.backupRuns),
    emailSuppressions: withRetention(store.emailSuppressions),
    fileUploads: withRetention(store.fileUploads),
    notificationDeliveries: withRetention(store.notificationDeliveries),
    operationalEvents: withRetention(store.operationalEvents),
    updatedAt: new Date().toISOString(),
  }
}

function localFileUploadToDomain(row: LocalFileUploadRow): FileUpload {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    bucket: row.bucket,
    objectPath: row.object_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    purpose: row.purpose,
    relatedType: row.related_type,
    relatedId: row.related_id,
    status: row.status,
    scanStatus: row.scan_status,
    scanNotes: row.scan_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  }
}

function relatedKey(relatedType: FileUploadRelatedType, relatedId: string) {
  return `${relatedType}:${relatedId}`
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
  } as LocalOperationsStore
}

async function writeStore(store: LocalOperationsStore) {
  await mkdir(dirname(storePath()), { recursive: true })
  await writeFile(storePath(), `${JSON.stringify(pruneStore(store), null, 2)}\n`, "utf-8")
}

async function updateStore<T>(updater: (store: LocalOperationsStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function readLocalOperationsRows() {
  const store = pruneStore(await readStore())

  return {
    backupRuns: store.backupRuns,
    emailSuppressions: store.emailSuppressions,
    fileUploads: store.fileUploads,
    mode: "mock",
    notificationDeliveries: store.notificationDeliveries,
    operationalEvents: store.operationalEvents,
  }
}

export async function recordLocalEmailSuppression(payload: OperationsEmailSuppressionPayload) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const normalizedEmail = payload.email.toLowerCase()
    const row: LocalEmailSuppressionRow = {
      category: payload.category,
      created_at: now,
      email: normalizedEmail,
      id: randomUUID(),
      metadata: payload.metadata,
      provider: payload.provider,
      reason: payload.reason,
      source_event_id: payload.sourceEventId || null,
      suppressed_at: payload.suppressedAt || now,
    }

    store.emailSuppressions = [row, ...store.emailSuppressions]
    return row
  })
}

export async function findLocalEmailSuppression(email: string, category: OperationsEmailSuppressionPayload["category"]) {
  const normalizedEmail = email.trim().toLowerCase()
  const store = await readStore()
  const rows = newestFirst(store.emailSuppressions)

  return rows.find(row =>
    row.email === normalizedEmail
    && (row.category === "all" || row.category === category),
  ) || null
}

export async function listLocalFileUploadsByRelated(relatedItems: Array<{ relatedId: string, relatedType: FileUploadRelatedType }>) {
  const relatedKeys = new Set(relatedItems.map(item => relatedKey(item.relatedType, item.relatedId)))

  if (!relatedKeys.size)
    return []

  const store = await readStore()

  return newestFirst(store.fileUploads)
    .filter(row => row.related_type && row.related_id)
    .filter(row => row.status !== "deleted" && !row.deleted_at)
    .filter(row => relatedKeys.has(relatedKey(row.related_type!, row.related_id!)))
    .map(localFileUploadToDomain)
}

export async function recordLocalBackupRun(payload: OperationsBackupRunPayload) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const id = payload.id || randomUUID()
    const existing = store.backupRuns.find(row => row.id === id)
    const row: LocalBackupRunRow = {
      artifact_uri: payload.artifactUri || null,
      completed_at: payload.completedAt || null,
      created_at: existing?.created_at || now,
      id,
      metadata: payload.metadata,
      notes: payload.notes || null,
      provider: payload.provider,
      started_at: payload.startedAt || existing?.started_at || now,
      status: payload.status,
    }

    store.backupRuns = [row, ...store.backupRuns.filter(item => item.id !== id)]
    return row
  })
}

export async function recordLocalFileUploadPolicy(session: SessionUser, policy: { bucket: string, id: string, objectPath: string, uploadTokenHash?: string | null }, payload: FileUploadPolicyPayload) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const row: LocalFileUploadRow = {
      bucket: policy.bucket,
      created_at: now,
      deleted_at: null,
      id: policy.id,
      local_file_path: null,
      local_upload_token_hash: policy.uploadTokenHash || null,
      mime_type: payload.mimeType,
      object_path: policy.objectPath,
      original_filename: payload.filename,
      owner_user_id: session.id,
      purpose: payload.purpose,
      related_id: payload.relatedId || null,
      related_type: payload.relatedType || null,
      scan_notes: null,
      scan_status: "pending",
      size_bytes: payload.sizeBytes,
      status: "pending",
      updated_at: now,
    }

    store.fileUploads = [row, ...store.fileUploads.filter(item => item.id !== row.id)]
    return row
  })
}

export async function writeLocalFileUploadContent(uploadId: string, token: string, bytes: Buffer) {
  if (!bytes.length)
    throw new Error("Uploaded file content is empty.")

  if (bytes.byteLength > maxLocalUploadBytes)
    throw new Error("Uploaded file exceeds the local file size limit.")

  return updateStore(async (store) => {
    const now = new Date().toISOString()
    const existing = store.fileUploads.find(row => row.id === uploadId)
    if (!existing)
      throw new Error("Local upload policy was not found.")

    if (!existing.local_upload_token_hash || existing.local_upload_token_hash !== hashLocalUploadToken(token))
      throw new Error("Local upload token is invalid.")

    if (bytes.byteLength > existing.size_bytes)
      throw new Error("Uploaded file is larger than the requested upload policy.")

    const localFilePath = localFilePathForObjectPath(existing.object_path)
    await mkdir(dirname(localFilePath), { recursive: true })
    await writeFile(localFilePath, bytes)

    const row: LocalFileUploadRow = {
      ...existing,
      local_file_path: localFilePath,
      scan_status: "pending",
      status: "pending",
      updated_at: now,
    }

    store.fileUploads = [row, ...store.fileUploads.filter(item => item.id !== uploadId)]
    return row
  })
}

export async function recordLocalFileScanResult(uploadId: string, payload: FileScanResultPayload) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.fileUploads.find(row => row.id === uploadId)
    const row: LocalFileUploadRow = {
      bucket: existing?.bucket || "local-mock-files",
      created_at: existing?.created_at || now,
      deleted_at: existing?.deleted_at || null,
      id: uploadId,
      mime_type: existing?.mime_type || "application/octet-stream",
      object_path: existing?.object_path || uploadId,
      original_filename: existing?.original_filename || uploadId,
      owner_user_id: existing?.owner_user_id || "operations-worker",
      purpose: existing?.purpose || "trust_evidence",
      related_id: existing?.related_id || null,
      related_type: existing?.related_type || null,
      scan_notes: payload.notes || null,
      scan_status: payload.scanStatus,
      size_bytes: existing?.size_bytes || 0,
      status: payload.status || (payload.scanStatus === "flagged" ? "blocked" : "uploaded"),
      updated_at: now,
    }

    store.fileUploads = [row, ...store.fileUploads.filter(item => item.id !== uploadId)]
    return row
  })
}

export async function listLocalPendingFileScans(limit: number, options: { appUrl?: string } = {}) {
  const store = await readStore()
  const rows = store.fileUploads
    .filter(row => row.scan_status === "pending" && row.status === "pending")
    .sort((left, right) => getRowTime(left) - getRowTime(right))
    .slice(0, limit)

  return rows.map((row) => {
    const downloadPath = `/api/operations/file-scans/${encodeURIComponent(row.id)}/download`
    const hasContent = Boolean(row.local_file_path)

    return {
      bucket: row.bucket,
      createdAt: row.created_at,
      id: row.id,
      mimeType: row.mime_type,
      objectPath: row.object_path,
      originalFilename: row.original_filename,
      ownerUserId: row.owner_user_id,
      purpose: row.purpose,
      relatedId: row.related_id,
      relatedType: row.related_type,
      signedDownloadError: hasContent ? null : "Local upload content has not been received.",
      signedDownloadUrl: hasContent ? `${options.appUrl || ""}${downloadPath}` : null,
      sizeBytes: row.size_bytes,
    }
  })
}

export async function readLocalFileUploadContent(uploadId: string) {
  const store = await readStore()
  const row = store.fileUploads.find(item => item.id === uploadId)

  if (!row?.local_file_path)
    return null

  const localFilePath = localFilePathForObjectPath(row.object_path)

  return {
    bytes: await readFile(localFilePath),
    filename: row.original_filename,
    mimeType: row.mime_type,
    row,
  }
}

export async function recordLocalNotificationDelivery(session: SessionUser, result: NotificationDeliveryResult) {
  return updateStore((store) => {
    const row: LocalNotificationDeliveryRow = {
      body_preview: result.bodyPreview || null,
      channel: "email",
      created_at: new Date().toISOString(),
      delivered_at: result.delivered ? new Date().toISOString() : null,
      error: result.error,
      event_type: result.eventType || "digest.unread",
      id: randomUUID(),
      metadata: result.metadata || {},
      notification_count: result.unreadCount,
      recipient: session.email,
      status: result.delivered ? "sent" : result.configured ? "failed" : "skipped",
      subject: result.subject,
      target_id: result.targetId || null,
      target_type: result.targetType || null,
      user_id: session.id,
    }

    store.notificationDeliveries = [row, ...store.notificationDeliveries]
    return row
  })
}

export async function recordLocalOperationalEvent(payload: OperationsEventPayload) {
  return updateStore((store) => {
    const row: LocalOperationalEventRow = {
      actor_user_id: payload.actorUserId || null,
      created_at: new Date().toISOString(),
      event_type: payload.eventType,
      id: randomUUID(),
      metadata: payload.metadata,
      severity: payload.severity,
      source: payload.source,
      target_id: payload.targetId || null,
      target_type: payload.targetType || null,
    }

    store.operationalEvents = [row, ...store.operationalEvents]
    return row
  })
}

export async function clearLocalOperationsStoreForTests() {
  await rm(storePath(), { force: true })
  await rm(localFileUploadRoot(), { force: true, recursive: true })
}
