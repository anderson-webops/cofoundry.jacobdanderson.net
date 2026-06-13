import type { H3Event } from "h3"
import type { AdminAction, AppRole, Notification, PrivacyRequestStatus, ReportStatus } from "~/shared/types/domain"
import { persistLocalReportStatus, persistLocalUserEmailVerification, persistLocalUserRole, persistLocalUserSuspension, readLocalAdminAuditStore, recordLocalAdminAction, recordLocalUserNotification } from "./local-admin-audit"
import { updateLocalPrivacyRequestStatus } from "./local-privacy-requests"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

interface PersistedAdminActionRow {
  admin_user_id: string
  created_at: string
  id: string
  metadata?: AdminAction["metadata"] | null
  notes: string
  target_id: string
  target_type: AdminAction["targetType"]
  type: AdminAction["type"]
}

function fromAdminActionRow(row: PersistedAdminActionRow): AdminAction {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    type: row.type,
    targetId: row.target_id,
    targetType: row.target_type,
    notes: row.notes,
    createdAt: row.created_at,
    metadata: row.metadata || {},
  }
}

export async function persistAdminAction(event: H3Event, action: AdminAction) {
  if (!isSupabaseEnabled(event))
    return recordLocalAdminAction(action)

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
      metadata: action.metadata || {},
      created_at: action.createdAt,
    })

  if (error)
    throw error
}

export async function listPersistedAdminActions(event: H3Event) {
  if (!isSupabaseEnabled(event)) {
    const store = await readLocalAdminAuditStore()
    return store.actions
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error)
    throw error

  return ((data || []) as PersistedAdminActionRow[]).map(fromAdminActionRow)
}

export async function persistUserNotification(event: H3Event, notification: Notification) {
  if (!isSupabaseEnabled(event))
    return recordLocalUserNotification(notification)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("notifications")
    .insert({
      id: notification.id,
      user_id: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      read_at: notification.readAt,
      created_at: notification.createdAt,
    })

  if (error)
    throw error
}

export async function persistUserSuspension(event: H3Event, targetUserId: string, suspendedAt: string | null) {
  if (!isSupabaseEnabled(event))
    return persistLocalUserSuspension(targetUserId, suspendedAt)

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
    return persistLocalUserRole(targetUserId, role)

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

export async function persistUserEmailVerification(event: H3Event, targetUserId: string, verifiedEmail: boolean) {
  if (!isSupabaseEnabled(event))
    return persistLocalUserEmailVerification(targetUserId, verifiedEmail)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("users")
    .update({ verified_email: verifiedEmail })
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
    return persistLocalReportStatus(input)

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

export async function persistPrivacyRequestStatus(event: H3Event, input: {
  adminUserId: string
  notes: string
  requestId: string
  status: Exclude<PrivacyRequestStatus, "open">
  timestamp: string
}) {
  if (!isSupabaseEnabled(event)) {
    const updatedRequest = await updateLocalPrivacyRequestStatus(input)
    if (!updatedRequest)
      throw createError({ statusCode: 404, statusMessage: "Privacy request was not found." })

    return {
      id: updatedRequest.id,
      status: updatedRequest.status,
      userId: updatedRequest.userId,
    }
  }

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
    .from("privacy_requests")
    .update(patch)
    .eq("id", input.requestId)
    .select("id,user_id,status")
    .maybeSingle()

  if (error)
    throw error

  if (!data)
    throw createError({ statusCode: 404, statusMessage: "Privacy request was not found." })

  return {
    id: data.id as string,
    status: data.status as PrivacyRequestStatus,
    userId: data.user_id as string,
  }
}
