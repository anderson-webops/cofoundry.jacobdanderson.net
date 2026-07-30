import type { H3Event } from "h3"
import type { AdminAction, AppRole, Notification, OpportunityVerificationStatus, PrivacyRequestStatus, ReportStatus } from "~/shared/types/domain"
import type { AdminSecurityMutation, AdminSecurityUser } from "~/shared/utils/admin-authorization"
import { workspaceSeed } from "../../shared/data/seed"
import { listLocalAccessAdminActions } from "./local-access-requests"
import { mergeLocalAdminAuditState, persistLocalAdminUserSecurityAction, persistLocalOpportunityVerificationAction, persistLocalReportStatusAction, readLocalAdminAuditStore, recordLocalAdminQueueAction, recordLocalUserNotification } from "./local-admin-audit"
import { readLocalMemberWorkspaceStates } from "./local-member-workspace"
import { listLocalOperationsAdminActions } from "./local-operations-store"
import { listLocalPrivacyAdminActions, persistLocalPrivacyRequestStatusAction } from "./local-privacy-requests"
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

interface PersistedAdminSecurityUserRow {
  id: string
  role: AppRole
  suspended_at: string | null
  verified_email: boolean
}

export async function listAdminSecurityUsers(event: H3Event): Promise<AdminSecurityUser[]> {
  if (!isSupabaseEnabled(event)) {
    const localStates = await readLocalMemberWorkspaceStates()
    const localUserIds = new Set(localStates.map(state => state.user.id))
    const seed = await mergeLocalAdminAuditState({
      ...structuredClone(workspaceSeed),
      users: [
        ...localStates.map(state => state.user),
        ...workspaceSeed.users.filter(user => !localUserIds.has(user.id)),
      ],
    })
    return seed.users.map(user => ({
      id: user.id,
      role: user.role,
      suspendedAt: user.suspendedAt,
      verifiedEmail: user.verifiedEmail,
    }))
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("users")
    .select("id,role,suspended_at,verified_email")

  if (error)
    throw error

  return ((data || []) as PersistedAdminSecurityUserRow[]).map(user => ({
    id: user.id,
    role: user.role,
    suspendedAt: user.suspended_at,
    verifiedEmail: user.verified_email,
  }))
}

export async function persistAdminUserSecurityAction(event: H3Event, input: {
  action: AdminAction
  mutation: AdminSecurityMutation
}) {
  if (!isSupabaseEnabled(event))
    return persistLocalAdminUserSecurityAction(input)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient.rpc("cofoundry_apply_admin_security_action", {
    p_action_id: input.action.id,
    p_actor_user_id: input.action.adminUserId,
    p_created_at: input.action.createdAt,
    p_new_role: input.mutation.kind === "change_role" ? input.mutation.role : null,
    p_notes: input.action.notes,
    p_operation: input.mutation.kind,
    p_status_action: input.mutation.kind === "change_status" ? input.mutation.action : null,
    p_target_user_id: input.action.targetId,
  })

  if (error) {
    throw createError({
      statusCode: error.message.includes("not found") ? 404 : 409,
      statusMessage: error.message,
    })
  }

  return data
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
    return recordLocalAdminQueueAction(action)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient.rpc("cofoundry_record_admin_queue_action", {
    p_action_id: action.id,
    p_action_type: action.type,
    p_actor_user_id: action.adminUserId,
    p_metadata: action.metadata || {},
    p_notes: action.notes,
    p_target_id: action.targetId,
    p_target_type: action.targetType,
    p_timestamp: action.createdAt,
  })

  if (error) {
    throw createError({
      statusCode: error.message.includes("active full admin") ? 403 : 400,
      statusMessage: error.message.includes("active full admin")
        ? "An active full admin account is required for this action."
        : "The queue action could not be recorded.",
    })
  }
}

export async function listPersistedAdminActions(event: H3Event) {
  if (!isSupabaseEnabled(event)) {
    const [store, accessActions, operationsActions, privacyActions] = await Promise.all([
      readLocalAdminAuditStore(),
      listLocalAccessAdminActions(),
      listLocalOperationsAdminActions(),
      listLocalPrivacyAdminActions(),
    ])
    return [...store.actions, ...accessActions, ...operationsActions, ...privacyActions]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 500)
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

export async function persistAdminReportStatusAction(event: H3Event, input: {
  action: AdminAction
  expectedStatus: "open" | "reviewed"
  status: ReportStatus
}) {
  if (!isSupabaseEnabled(event))
    return persistLocalReportStatusAction(input)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient.rpc("cofoundry_apply_admin_report_action", {
    p_action_id: input.action.id,
    p_actor_user_id: input.action.adminUserId,
    p_expected_status: input.expectedStatus,
    p_notes: input.action.notes,
    p_status: input.status,
    p_target_id: input.action.targetId,
    p_timestamp: input.action.createdAt,
  })

  if (error) {
    const stale = error.message.includes("changed after")
    throw createError({
      statusCode: error.message.includes("not found") ? 404 : stale ? 409 : 400,
      statusMessage: stale
        ? "The report changed after this review began. Refresh and review the current state."
        : error.message.includes("not found")
          ? "Target report was not found."
          : "The report action could not be applied.",
    })
  }

  const result = data as { reporterUserId?: string, status?: ReportStatus, targetId?: string } | null
  return {
    id: result?.targetId || input.action.targetId,
    reporterUserId: result?.reporterUserId || null,
    status: result?.status || input.status,
  }
}

export async function persistOpportunityVerificationAction(event: H3Event, input: {
  action: AdminAction
  expectedUpdatedAt: string
  status: Exclude<OpportunityVerificationStatus, "manual_review">
}) {
  if (!isSupabaseEnabled(event)) {
    const patch = await persistLocalOpportunityVerificationAction(input)
    return {
      id: patch.id,
      verificationStatus: patch.status,
    }
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient.rpc("cofoundry_review_opportunity", {
    p_action_id: input.action.id,
    p_actor_user_id: input.action.adminUserId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_notes: input.action.notes,
    p_status: input.status,
    p_target_id: input.action.targetId,
    p_timestamp: input.action.createdAt,
  })

  if (error) {
    throw createError({
      statusCode: error.message.includes("not found")
        ? 404
        : error.message.includes("changed after")
          ? 409
          : 400,
      statusMessage: error.message,
    })
  }

  const result = data as {
    ownerUserId?: string
    targetId?: string
    verificationStatus?: OpportunityVerificationStatus
  } | null

  return {
    id: result?.targetId || input.action.targetId,
    ownerUserId: result?.ownerUserId,
    verificationStatus: result?.verificationStatus || input.status,
  }
}

export async function persistAdminPrivacyRequestStatusAction(event: H3Event, input: {
  action: AdminAction
  completionConfirmed: boolean
  expectedStatus: "open" | "reviewed"
  status: Exclude<PrivacyRequestStatus, "open">
}) {
  if (!isSupabaseEnabled(event)) {
    const updatedRequest = await persistLocalPrivacyRequestStatusAction(input)
    return {
      id: updatedRequest.id,
      status: updatedRequest.status,
      userId: updatedRequest.userId,
    }
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient.rpc("cofoundry_apply_admin_privacy_action", {
    p_action_id: input.action.id,
    p_actor_user_id: input.action.adminUserId,
    p_completion_confirmed: input.completionConfirmed,
    p_expected_status: input.expectedStatus,
    p_notes: input.action.notes,
    p_status: input.status,
    p_target_id: input.action.targetId,
    p_timestamp: input.action.createdAt,
  })

  if (error) {
    const stale = error.message.includes("changed after")
    throw createError({
      statusCode: error.message.includes("not found") ? 404 : stale ? 409 : 400,
      statusMessage: stale
        ? "The privacy request changed after this review began. Refresh and review the current state."
        : error.message.includes("not found")
          ? "Privacy request was not found."
          : "The privacy-request action could not be applied.",
    })
  }

  const result = data as { status?: PrivacyRequestStatus, targetId?: string, userId?: string } | null
  return {
    id: result?.targetId || input.action.targetId,
    status: result?.status || input.status,
    userId: result?.userId || "",
  }
}
