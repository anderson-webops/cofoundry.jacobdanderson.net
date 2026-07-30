import type { H3Event } from "h3"
import type { z } from "zod"
import type { AdminAction, FileUpload, FileUploadRelatedType, SessionUser } from "~/shared/types/domain"
import type { adminFileScanResultSchema, fileScanResultSchema, fileUploadPolicySchema } from "~/shared/utils/validation"
import { randomUUID } from "node:crypto"
import { createError } from "h3"
import { resolveServerAppUrl } from "./app-url"
import { hashLocalUploadToken, listLocalFileUploadsByRelated, listLocalPendingFileScans, recordLocalAdminFileScanResult, recordLocalFileScanResult, recordLocalFileUploadPolicy } from "./local-operations-store"
import { loadMemberWorkspaceState } from "./member-workspace"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type FileUploadPolicyPayload = z.infer<typeof fileUploadPolicySchema>
type FileScanResultPayload = z.infer<typeof fileScanResultSchema>
type AdminFileScanResultPayload = z.infer<typeof adminFileScanResultSchema>

interface PendingFileScanRow {
  bucket: string
  created_at: string
  id: string
  mime_type: string
  object_path: string
  original_filename: string
  owner_user_id: string
  purpose: string
  related_id: string | null
  related_type: string | null
  size_bytes: number
}

interface PersistedFileUploadRow {
  bucket: string
  created_at: string
  deleted_at: string | null
  id: string
  mime_type: string
  object_path: string
  original_filename: string
  owner_user_id: string
  purpose: FileUpload["purpose"]
  related_id: string | null
  related_type: FileUploadRelatedType | null
  scan_notes: string | null
  scan_status: FileUpload["scanStatus"]
  size_bytes: number
  status: FileUpload["status"]
  updated_at: string
}

interface FileUploadRelatedSelector {
  relatedId: string
  relatedType: FileUploadRelatedType
}

const privateFileBucket = "cofoundry-private-files"
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])
const unsafeFilenamePattern = /[^\w.-]+/g
const leadingDotsPattern = /^\.+/
const allowedRelatedTypesByPurpose: Record<FileUpload["purpose"], ReadonlySet<FileUploadRelatedType>> = {
  contract_attachment: new Set(["contract"]),
  message_attachment: new Set(["message"]),
  proposal_attachment: new Set(["proposal"]),
  trust_evidence: new Set(["opportunity", "profile"]),
}

function sanitizeFilename(filename: string) {
  return filename
    .replaceAll(unsafeFilenamePattern, "-")
    .replace(leadingDotsPattern, "")
    .slice(0, 120) || "upload"
}

function objectPathFor(session: SessionUser, filename: string) {
  const today = new Date().toISOString().slice(0, 10)
  return `${session.id}/${today}/${randomUUID()}-${sanitizeFilename(filename)}`
}

function fileUploadRowToDomain(row: PersistedFileUploadRow): FileUpload {
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
    deletedAt: row.deleted_at,
  }
}

function dedupeRelatedSelectors(relatedItems: FileUploadRelatedSelector[]) {
  const seen = new Set<string>()

  return relatedItems.filter((item) => {
    const key = `${item.relatedType}:${item.relatedId}`
    if (seen.has(key))
      return false

    seen.add(key)
    return true
  })
}

function buildIdentity(session: SessionUser) {
  return {
    email: session.email,
    id: session.id,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

export function assertFileUploadAuthorization(seed: Awaited<ReturnType<typeof loadMemberWorkspaceState>>["seed"], session: SessionUser, payload: FileUploadPolicyPayload) {
  const relatedId = payload.relatedId
  const relatedType = payload.relatedType
  if (!relatedId || !relatedType)
    throw createError({ statusCode: 400, statusMessage: "A related workspace record is required for every upload." })
  if (!allowedRelatedTypesByPurpose[payload.purpose].has(relatedType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "The upload purpose does not match the selected workspace record.",
    })
  }

  const fullAdmin = session.role === "admin"
  let authorized = false

  if (relatedType === "message") {
    const message = seed.messages.find(item => item.id === relatedId)
    const conversation = message
      ? seed.conversations.find(item => item.id === message.conversationId)
      : null
    authorized = Boolean(message && conversation?.participantIds.includes(session.id))
  }
  else if (relatedType === "proposal") {
    const proposal = seed.proposals.find(item => item.id === relatedId)
    authorized = Boolean(proposal && (
      proposal.createdByUserId === session.id
      || proposal.recipientUserId === session.id
      || fullAdmin
    ))
  }
  else if (relatedType === "contract") {
    const contract = seed.contracts.find(item => item.id === relatedId)
    const proposal = contract
      ? seed.proposals.find(item => item.id === contract.proposalId)
      : null
    authorized = Boolean(contract && proposal && (
      proposal.createdByUserId === session.id
      || proposal.recipientUserId === session.id
      || fullAdmin
    ))
  }
  else if (relatedType === "profile") {
    const profile = seed.profiles.find(item => item.id === relatedId)
    authorized = Boolean(profile && (profile.userId === session.id || fullAdmin))
  }
  else if (relatedType === "opportunity") {
    const opportunity = seed.opportunities.find(item => item.id === relatedId)
    authorized = Boolean(opportunity && (opportunity.ownerUserId === session.id || fullAdmin))
  }

  if (!authorized) {
    throw createError({
      statusCode: 403,
      statusMessage: "You cannot attach files to that workspace record.",
    })
  }
}

export async function createFileUploadPolicy(event: H3Event, session: SessionUser, payload: FileUploadPolicyPayload) {
  if (!allowedMimeTypes.has(payload.mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "That file type is not allowed for workspace uploads.",
    })
  }

  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  assertFileUploadAuthorization(workspace.seed, workspace.session, payload)

  const uploadId = randomUUID()
  const objectPath = objectPathFor(session, payload.filename)
  let signedUploadUrl: string | null = null
  let uploadToken: string | null = null

  if (isSupabaseEnabled(event)) {
    const adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const { error } = await adminClient
      .from("file_uploads")
      .insert({
        id: uploadId,
        owner_user_id: session.id,
        bucket: privateFileBucket,
        object_path: objectPath,
        original_filename: payload.filename,
        mime_type: payload.mimeType,
        size_bytes: payload.sizeBytes,
        purpose: payload.purpose,
        related_type: payload.relatedType || null,
        related_id: payload.relatedId || null,
        status: "pending",
        scan_status: "pending",
      })

    if (error)
      throw error

    const signed = await adminClient.storage
      .from(privateFileBucket)
      .createSignedUploadUrl(objectPath)

    if (signed.error) {
      await adminClient
        .from("file_uploads")
        .delete()
        .eq("id", uploadId)
        .eq("owner_user_id", session.id)
      throw signed.error
    }

    signedUploadUrl = signed.data.signedUrl
    uploadToken = signed.data.token
  }
  else {
    uploadToken = randomUUID()
    signedUploadUrl = `${resolveServerAppUrl(event)}/api/files/local-upload/${encodeURIComponent(uploadId)}`
    await recordLocalFileUploadPolicy(session, {
      bucket: privateFileBucket,
      id: uploadId,
      objectPath,
      uploadTokenExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      uploadTokenHash: hashLocalUploadToken(uploadToken),
    }, payload)
  }

  return {
    bucket: privateFileBucket,
    expiresInSeconds: 7200,
    id: uploadId,
    maxBytes: 10 * 1024 * 1024,
    method: "PUT",
    objectPath,
    signedUploadUrl,
    uploadToken,
  }
}

export async function listFileUploadsByRelated(event: H3Event, relatedItems: FileUploadRelatedSelector[]) {
  const selectors = dedupeRelatedSelectors(relatedItems)

  if (!selectors.length)
    return []

  if (!isSupabaseEnabled(event))
    return listLocalFileUploadsByRelated(selectors)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const uploads: FileUpload[] = []
  const relatedTypes = Array.from(new Set(selectors.map(item => item.relatedType)))

  for (const relatedType of relatedTypes) {
    const relatedIds = selectors
      .filter(item => item.relatedType === relatedType)
      .map(item => item.relatedId)

    const { data, error } = await adminClient
      .from("file_uploads")
      .select("*")
      .eq("related_type", relatedType)
      .in("related_id", relatedIds)
      .is("deleted_at", null)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })

    if (error)
      throw error

    uploads.push(...((data || []) as PersistedFileUploadRow[]).map(fileUploadRowToDomain))
  }

  return uploads.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function recordFileScanResult(event: H3Event, uploadId: string, payload: FileScanResultPayload) {
  if (!isSupabaseEnabled(event))
    return recordLocalFileScanResult(uploadId, payload)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("file_uploads")
    .update({
      scan_notes: payload.notes || null,
      scan_status: payload.scanStatus,
      status: payload.scanStatus === "clean" ? "uploaded" : "blocked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", uploadId)
    .eq("scan_status", "pending")
    .eq("status", "pending")
    .select()
    .maybeSingle()

  if (error)
    throw error

  return data
}

export async function recordAdminFileScanResult(
  event: H3Event,
  uploadId: string,
  payload: AdminFileScanResultPayload,
  action: AdminAction,
) {
  if (!isSupabaseEnabled(event))
    return recordLocalAdminFileScanResult(uploadId, payload, action)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data: existingData, error: existingError } = await adminClient
    .from("file_uploads")
    .select("*")
    .eq("id", uploadId)
    .maybeSingle<PersistedFileUploadRow>()

  if (existingError)
    throw existingError
  if (!existingData)
    return null

  const { error } = await adminClient.rpc("cofoundry_apply_admin_file_scan", {
    p_action_id: action.id,
    p_actor_user_id: action.adminUserId,
    p_expected_updated_at: payload.expectedUpdatedAt,
    p_notes: action.notes,
    p_scan_status: payload.scanStatus,
    p_target_id: uploadId,
    p_timestamp: action.createdAt,
  })

  if (error) {
    const stale = error.message.includes("changed after")
    const ineligible = error.message.includes("not eligible")
    throw createError({
      statusCode: stale || ineligible ? 409 : 400,
      statusMessage: stale
        ? "The file changed after this review began. Refresh and review the current state."
        : ineligible
          ? "This file is not eligible for a manual scan verdict."
          : "The file-scan action could not be applied.",
    })
  }

  return {
    ...existingData,
    scan_notes: payload.notes,
    scan_status: payload.scanStatus,
    status: payload.scanStatus === "clean" ? "uploaded" as const : "blocked" as const,
    updated_at: action.createdAt,
  }
}

export async function listPendingFileScans(event: H3Event, limit: number) {
  if (!isSupabaseEnabled(event))
    return listLocalPendingFileScans(limit, { appUrl: resolveServerAppUrl(event) })

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("file_uploads")
    .select("id,owner_user_id,bucket,object_path,original_filename,mime_type,size_bytes,purpose,related_type,related_id,created_at")
    .eq("scan_status", "pending")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error)
    throw error

  const rows = (data || []) as PendingFileScanRow[]
  return Promise.all(rows.map(async (row) => {
    const signed = await adminClient.storage
      .from(row.bucket)
      .createSignedUrl(row.object_path, 10 * 60)

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
      signedDownloadError: signed.error?.message || null,
      signedDownloadUrl: signed.data?.signedUrl || null,
      sizeBytes: row.size_bytes,
    }
  }))
}
