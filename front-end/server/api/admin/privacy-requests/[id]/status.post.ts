import { adminReportStatusSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../../../utils/supabase"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:privacy-request-status",
    windowMs: 60 * 1000,
  })

  const requestId = getRouterParam(event, "id")
  if (!requestId)
    throw createError({ statusCode: 400, statusMessage: "A privacy request id is required." })

  const payload = adminReportStatusSchema.parse(await readBody(event))
  const updatedAt = new Date().toISOString()

  if (isSupabaseEnabled(event)) {
    const adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const patch = payload.status === "reviewed"
      ? {
          status: "reviewed",
          review_notes: payload.notes,
          reviewed_at: updatedAt,
          reviewed_by_user_id: session.id,
        }
      : {
          status: "resolved",
          resolution_notes: payload.notes,
          resolved_at: updatedAt,
          resolved_by_user_id: session.id,
        }

    const { data, error } = await adminClient
      .from("privacy_requests")
      .update(patch)
      .eq("id", requestId)
      .select("id")

    if (error)
      throw error

    if (!data?.length)
      throw createError({ statusCode: 404, statusMessage: "Privacy request was not found." })
  }

  return {
    request: {
      id: requestId,
      resolvedAt: payload.status === "resolved" ? updatedAt : null,
      reviewedAt: payload.status === "reviewed" ? updatedAt : null,
      status: payload.status,
    },
  }
})
