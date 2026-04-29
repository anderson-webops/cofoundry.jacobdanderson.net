import type { H3Event } from "h3"
import type { PrivacyRequest, SessionUser } from "~/shared/types/domain"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

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
    return request

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
