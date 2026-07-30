import type { z } from "zod"
import type { AdminAction, FileUpload, FileUploadRelatedType, SessionUser } from "../../shared/types/domain"
import type { fileScanResultSchema, fileUploadPolicySchema, operationsBackupRunSchema, operationsContractEnvelopeSchema, operationsEmailSuppressionSchema, operationsEventSchema, operationsTrustVerificationSchema } from "../../shared/utils/validation"
import { Buffer } from "node:buffer"
import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { assertLocalAdminActor } from "./local-admin-audit"
import { withLocalAdminSecurityLock } from "./local-admin-security-lock"
import { readPrivateFile, readPrivateTextFile, writePrivateFileAtomic, writePrivateFileExclusive } from "./private-file-store"

type FileScanResultPayload = z.infer<typeof fileScanResultSchema>
type FileUploadPolicyPayload = z.infer<typeof fileUploadPolicySchema>
type OperationsBackupRunPayload = z.infer<typeof operationsBackupRunSchema>
type OperationsContractEnvelopePayload = z.infer<typeof operationsContractEnvelopeSchema>
type OperationsEmailSuppressionPayload = z.infer<typeof operationsEmailSuppressionSchema>
type OperationsEventPayload = z.infer<typeof operationsEventSchema>
type OperationsTrustVerificationPayload = z.infer<typeof operationsTrustVerificationSchema>

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
  local_upload_token_expires_at?: string | null
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
  status: FileUpload["status"]
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

interface LocalContractEnvelopeEventRow {
  completed_pdf_file_upload_id: string | null
  completed_pdf_sha256: string | null
  contract_id: string
  contract_version_id: string
  created_at: string
  id: string
  metadata: Record<string, unknown>
  occurred_at: string
  provider: string
  provider_envelope_id: string
  signed_by_user_ids: string[]
  source_event_id: string | null
  status: OperationsContractEnvelopePayload["status"]
}

interface LocalTrustVerificationEventRow {
  confidence: number | null
  created_at: string
  evidence_file_upload_id: string | null
  id: string
  metadata: Record<string, unknown>
  occurred_at: string
  provider: string
  provider_subject_id: string | null
  source_event_id: string | null
  status: OperationsTrustVerificationPayload["status"]
  target_id: string
  target_type: OperationsTrustVerificationPayload["targetType"]
  verification_type: OperationsTrustVerificationPayload["verificationType"]
}

interface LocalOperationsStore {
  adminActions: AdminAction[]
  backupRuns: LocalBackupRunRow[]
  contractEnvelopeEvents: LocalContractEnvelopeEventRow[]
  emailSuppressions: LocalEmailSuppressionRow[]
  fileUploads: LocalFileUploadRow[]
  notificationDeliveries: LocalNotificationDeliveryRow[]
  operationalEvents: LocalOperationalEventRow[]
  trustVerificationEvents: LocalTrustVerificationEventRow[]
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

function localUploadTokenMatches(storedHash: string, token: string) {
  if (!storedHash || !token)
    return false

  const expected = Buffer.from(storedHash, "hex")
  const actual = Buffer.from(hashLocalUploadToken(token), "hex")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_OPERATIONS_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 10), 1000)
}

function emptyStore(): LocalOperationsStore {
  return {
    adminActions: [],
    backupRuns: [],
    contractEnvelopeEvents: [],
    emailSuppressions: [],
    fileUploads: [],
    notificationDeliveries: [],
    operationalEvents: [],
    trustVerificationEvents: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

function getRowTime(row: object) {
  const record = row as Record<string, unknown>
  const value = record.created_at || record.createdAt || record.started_at || record.updated_at || record.updatedAt
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
    adminActions: newestFirst(store.adminActions).slice(0, retentionLimit()),
    backupRuns: withRetention(store.backupRuns),
    contractEnvelopeEvents: withRetention(store.contractEnvelopeEvents),
    emailSuppressions: withRetention(store.emailSuppressions),
    fileUploads: withRetention(store.fileUploads),
    notificationDeliveries: withRetention(store.notificationDeliveries),
    operationalEvents: withRetention(store.operationalEvents),
    trustVerificationEvents: withRetention(store.trustVerificationEvents),
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
  return readPrivateTextFile(storePath())
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
  await writePrivateFileAtomic(storePath(), `${JSON.stringify(pruneStore(store), null, 2)}\n`)
}

async function updateStore<T>(updater: (_store: LocalOperationsStore) => T | Promise<T>) {
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
    contractEnvelopeEvents: store.contractEnvelopeEvents,
    emailSuppressions: store.emailSuppressions,
    fileUploads: store.fileUploads,
    mode: "mock",
    notificationDeliveries: store.notificationDeliveries,
    operationalEvents: store.operationalEvents,
    trustVerificationEvents: store.trustVerificationEvents,
  }
}

export async function listLocalOperationsAdminActions() {
  return pruneStore(await readStore()).adminActions
}

export async function recordLocalContractEnvelopeEvent(payload: OperationsContractEnvelopePayload) {
  return updateStore((store) => {
    const provider = payload.provider.trim().toLowerCase()
    const sourceEventId = payload.sourceEventId || null
    const existing = sourceEventId
      ? store.contractEnvelopeEvents.find(row => row.provider === provider && row.source_event_id === sourceEventId)
      : null
    if (existing)
      return existing

    const now = new Date().toISOString()
    const row: LocalContractEnvelopeEventRow = {
      completed_pdf_file_upload_id: payload.completedPdfFileUploadId || null,
      completed_pdf_sha256: payload.completedPdfSha256?.toLowerCase() || null,
      contract_id: payload.contractId,
      contract_version_id: payload.contractVersionId,
      created_at: now,
      id: randomUUID(),
      metadata: payload.metadata,
      occurred_at: payload.occurredAt || now,
      provider,
      provider_envelope_id: payload.providerEnvelopeId,
      signed_by_user_ids: payload.signedByUserIds,
      source_event_id: sourceEventId,
      status: payload.status,
    }

    store.contractEnvelopeEvents = [row, ...store.contractEnvelopeEvents]
    return row
  })
}

export async function listLocalContractEnvelopeEvents(contractId: string, contractVersionId: string) {
  const store = await readStore()

  return newestFirst(store.contractEnvelopeEvents.filter(row =>
    row.contract_id === contractId && row.contract_version_id === contractVersionId,
  ))
}

export async function recordLocalEmailSuppression(payload: OperationsEmailSuppressionPayload) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const normalizedEmail = payload.email.toLowerCase()
    const provider = payload.provider.trim().toLowerCase()
    const sourceEventId = payload.sourceEventId || null
    const existing = sourceEventId
      ? store.emailSuppressions.find(row => row.provider === provider && row.source_event_id === sourceEventId)
      : null
    if (existing)
      return existing

    const row: LocalEmailSuppressionRow = {
      category: payload.category,
      created_at: now,
      email: normalizedEmail,
      id: randomUUID(),
      metadata: payload.metadata,
      provider,
      reason: payload.reason,
      source_event_id: sourceEventId,
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

export async function recordLocalTrustVerificationEvent(payload: OperationsTrustVerificationPayload) {
  return updateStore((store) => {
    const provider = payload.provider.trim().toLowerCase()
    const sourceEventId = payload.sourceEventId || null
    const existing = sourceEventId
      ? store.trustVerificationEvents.find(row => row.provider === provider && row.source_event_id === sourceEventId)
      : null
    if (existing)
      return existing

    const now = new Date().toISOString()
    const row: LocalTrustVerificationEventRow = {
      confidence: typeof payload.confidence === "number" ? payload.confidence : null,
      created_at: now,
      evidence_file_upload_id: payload.evidenceFileUploadId || null,
      id: randomUUID(),
      metadata: payload.metadata,
      occurred_at: payload.occurredAt || now,
      provider,
      provider_subject_id: payload.providerSubjectId || null,
      source_event_id: sourceEventId,
      status: payload.status,
      target_id: payload.targetId,
      target_type: payload.targetType,
      verification_type: payload.verificationType,
    }

    store.trustVerificationEvents = [row, ...store.trustVerificationEvents]
    return row
  })
}

export async function listLocalTrustVerificationEvents(targetIds: string[]) {
  const targets = new Set(targetIds)
  if (!targets.size)
    return []

  const store = await readStore()
  return store.trustVerificationEvents
    .filter(row => targets.has(row.target_id))
    .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime())
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

export async function recordLocalFileUploadPolicy(session: SessionUser, policy: { bucket: string, id: string, objectPath: string, uploadTokenExpiresAt?: string | null, uploadTokenHash?: string | null }, payload: FileUploadPolicyPayload) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const row: LocalFileUploadRow = {
      bucket: policy.bucket,
      created_at: now,
      deleted_at: null,
      id: policy.id,
      local_file_path: null,
      local_upload_token_expires_at: policy.uploadTokenExpiresAt || null,
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

export async function assertLocalFileUploadToken(uploadId: string, token: string) {
  const existing = (await readStore()).fileUploads.find(row => row.id === uploadId)
  if (
    !existing
    || !existing.local_upload_token_hash
    || !existing.local_upload_token_expires_at
    || Date.parse(existing.local_upload_token_expires_at) <= Date.now()
    || !localUploadTokenMatches(existing.local_upload_token_hash, token)
    || existing.local_file_path
    || existing.status !== "pending"
  ) {
    throw new Error("Local upload token is invalid or expired.")
  }

  return {
    sizeBytes: existing.size_bytes,
  }
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

    if (
      !existing.local_upload_token_hash
      || !existing.local_upload_token_expires_at
      || Date.parse(existing.local_upload_token_expires_at) <= Date.now()
      || !localUploadTokenMatches(existing.local_upload_token_hash, token)
    ) {
      throw new Error("Local upload token is invalid or expired.")
    }

    if (existing.local_file_path || existing.status !== "pending")
      throw new Error("This local upload policy has already been used.")

    if (bytes.byteLength !== existing.size_bytes)
      throw new Error("Uploaded file size does not match the requested upload policy.")

    const localFilePath = localFilePathForObjectPath(existing.object_path)
    await writePrivateFileExclusive(localFilePath, bytes)

    const row: LocalFileUploadRow = {
      ...existing,
      local_file_path: localFilePath,
      local_upload_token_expires_at: null,
      local_upload_token_hash: null,
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
    if (!existing || existing.scan_status !== "pending" || existing.status !== "pending")
      return null

    const row: LocalFileUploadRow = {
      ...existing,
      bucket: existing.bucket,
      created_at: existing.created_at,
      deleted_at: existing.deleted_at || null,
      id: uploadId,
      mime_type: existing.mime_type,
      object_path: existing.object_path,
      original_filename: existing.original_filename,
      owner_user_id: existing.owner_user_id,
      purpose: existing.purpose,
      related_id: existing.related_id,
      related_type: existing.related_type,
      scan_notes: payload.notes || null,
      scan_status: payload.scanStatus,
      size_bytes: existing.size_bytes,
      status: payload.scanStatus === "clean" ? "uploaded" : "blocked",
      updated_at: now,
    }

    store.fileUploads = [row, ...store.fileUploads.filter(item => item.id !== uploadId)]
    return row
  })
}

export async function recordLocalAdminFileScanResult(
  uploadId: string,
  payload: FileScanResultPayload & { expectedUpdatedAt: string },
  action: AdminAction,
) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(action.adminUserId)

    return updateStore((store) => {
      const existing = store.fileUploads.find(row => row.id === uploadId)
      if (!existing)
        return null

      if (existing.updated_at !== payload.expectedUpdatedAt) {
        throw Object.assign(new Error("The file changed after this review began. Refresh and review the current state."), {
          statusCode: 409,
          statusMessage: "The file changed after this review began. Refresh and review the current state.",
        })
      }

      if (
        existing.deleted_at
        || existing.status === "deleted"
        || !["pending", "failed", "skipped"].includes(existing.scan_status)
      ) {
        throw Object.assign(new Error("This file is not eligible for a manual scan verdict."), {
          statusCode: 409,
          statusMessage: "This file is not eligible for a manual scan verdict.",
        })
      }

      const row: LocalFileUploadRow = {
        ...existing,
        scan_notes: payload.notes || null,
        scan_status: payload.scanStatus,
        status: payload.scanStatus === "clean" ? "uploaded" : "blocked",
        updated_at: action.createdAt,
      }

      store.adminActions = [action, ...store.adminActions.filter(item => item.id !== action.id)]
      store.fileUploads = [row, ...store.fileUploads.filter(item => item.id !== uploadId)]
      return row
    })
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
  const bytes = await readPrivateFile(localFilePath)
  if (!bytes)
    return null

  return {
    bytes,
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
