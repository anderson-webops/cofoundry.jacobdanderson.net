import type { PrivacyRequest } from "~/shared/types/domain"
import { requireAdminSession } from "../../utils/admin"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../utils/supabase"

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

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:privacy-requests",
    windowMs: 60 * 1000,
  })

  if (!isSupabaseEnabled(event))
    return { requests: [] as PrivacyRequest[] }

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

  return { requests: ((data || []) as PersistedPrivacyRequestRow[]).map(fromRow) }
})
