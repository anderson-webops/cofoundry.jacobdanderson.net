import type { H3Event } from "h3"
import type { PrivacyRequest, SessionUser } from "~/shared/types/domain"
import { createLocalPrivacyRequest, listLocalPrivacyRequests } from "./local-privacy-requests"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

interface PersistedPrivacyRequestRow {
  created_at: string
  details: string
  id: string
  resolution_notes: string | null
  resolved_at: string | null
  resolved_by_user_id: string | null
  review_notes: string | null
  reviewed_at: string | null
  reviewed_by_user_id: string | null
  status: PrivacyRequest["status"]
  type: PrivacyRequest["type"]
  user_id: string
}

function fromRow(row: PersistedPrivacyRequestRow): PrivacyRequest {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    resolutionNotes: row.resolution_notes,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id,
  }
}

export async function persistPrivacyRequest(event: H3Event, session: SessionUser, input: Pick<PrivacyRequest, "details" | "type">) {
  const request: PrivacyRequest = {
    id: crypto.randomUUID(),
    userId: session.id,
    type: input.type,
    details: input.details,
    status: "open",
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedByUserId: null,
    createdAt: new Date().toISOString(),
  }

  if (!isSupabaseEnabled(event))
    return createLocalPrivacyRequest(request)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("privacy_requests")
    .insert({
      id: request.id,
      user_id: request.userId,
      type: request.type,
      details: request.details,
      status: request.status,
      review_notes: request.reviewNotes,
      reviewed_at: request.reviewedAt,
      reviewed_by_user_id: request.reviewedByUserId,
      resolution_notes: request.resolutionNotes,
      resolved_at: request.resolvedAt,
      resolved_by_user_id: request.resolvedByUserId,
      created_at: request.createdAt,
    })

  if (error)
    throw error

  return request
}

export async function listPrivacyRequests(event: H3Event) {
  if (!isSupabaseEnabled(event))
    return listLocalPrivacyRequests()

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("privacy_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error)
    throw error

  return ((data || []) as PersistedPrivacyRequestRow[]).map(fromRow)
}
