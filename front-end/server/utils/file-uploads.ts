import type { H3Event } from "h3"
import type { z } from "zod"
import type { SessionUser } from "~/shared/types/domain"
import type { fileScanResultSchema, fileUploadPolicySchema } from "~/shared/utils/validation"
import { randomUUID } from "node:crypto"
import { listLocalPendingFileScans, recordLocalFileScanResult, recordLocalFileUploadPolicy } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type FileUploadPolicyPayload = z.infer<typeof fileUploadPolicySchema>
type FileScanResultPayload = z.infer<typeof fileScanResultSchema>

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

function sanitizeFilename(filename: string) {
  return filename
    .replaceAll(unsafeFilenamePattern, "-")
    .replaceAll(leadingDotsPattern, "")
    .slice(0, 120) || "upload"
}

function objectPathFor(session: SessionUser, filename: string) {
  const today = new Date().toISOString().slice(0, 10)
  return `${session.id}/${today}/${randomUUID()}-${sanitizeFilename(filename)}`
}

export async function createFileUploadPolicy(event: H3Event, session: SessionUser, payload: FileUploadPolicyPayload) {
  if (!allowedMimeTypes.has(payload.mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "That file type is not allowed for workspace uploads.",
    })
  }

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

    if (signed.error)
      throw signed.error

    signedUploadUrl = signed.data.signedUrl
    uploadToken = signed.data.token
  }
  else {
    await recordLocalFileUploadPolicy(session, { bucket: privateFileBucket, id: uploadId, objectPath }, payload)
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
      status: payload.status || (payload.scanStatus === "flagged" ? "blocked" : "uploaded"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", uploadId)
    .select()
    .maybeSingle()

  if (error)
    throw error

  return data
}

export async function listPendingFileScans(event: H3Event, limit: number) {
  if (!isSupabaseEnabled(event))
    return listLocalPendingFileScans(limit)

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
