import type { H3Event } from "h3"
import type { AdminAction, AppRole, ReportStatus } from "~/shared/types/domain"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

export async function persistAdminAction(event: H3Event, action: AdminAction) {
  if (!isSupabaseEnabled(event))
    return

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("admin_actions")
    .insert({
      id: action.id,
      admin_user_id: action.adminUserId,
      type: action.type,
      target_id: action.targetId,
      target_type: action.targetType,
      notes: action.notes,
      created_at: action.createdAt,
    })

  if (error)
    throw error
}

export async function persistUserSuspension(event: H3Event, targetUserId: string, suspendedAt: string | null) {
  if (!isSupabaseEnabled(event))
    return

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("users")
    .update({ suspended_at: suspendedAt })
    .eq("id", targetUserId)
    .select("id")

  if (error)
    throw error

  if (!data?.length)
    throw createError({ statusCode: 404, statusMessage: "Target user was not found." })
}

export async function persistUserRole(event: H3Event, targetUserId: string, role: AppRole) {
  if (!isSupabaseEnabled(event))
    return

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("users")
    .update({ role })
    .eq("id", targetUserId)
    .select("id")

  if (error)
    throw error

  if (!data?.length)
    throw createError({ statusCode: 404, statusMessage: "Target user was not found." })
}

export async function persistReportStatus(event: H3Event, input: {
  adminUserId: string
  notes: string
  reportId: string
  status: ReportStatus
  timestamp: string
}) {
  if (!isSupabaseEnabled(event))
    return

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const patch = input.status === "reviewed"
    ? {
        status: "reviewed",
        review_notes: input.notes,
        reviewed_at: input.timestamp,
        reviewed_by_user_id: input.adminUserId,
      }
    : {
        status: "resolved",
        resolution_notes: input.notes,
        resolved_at: input.timestamp,
        resolved_by_user_id: input.adminUserId,
      }

  const { data, error } = await adminClient
    .from("reports")
    .update(patch)
    .eq("id", input.reportId)
    .select("id")

  if (error)
    throw error

  if (!data?.length)
    throw createError({ statusCode: 404, statusMessage: "Target report was not found." })
}
