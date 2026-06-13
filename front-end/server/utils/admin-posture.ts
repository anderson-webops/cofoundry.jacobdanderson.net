import type { H3Event } from "h3"
import type { ProductionReadinessAdminPosture } from "./production-readiness"
import type { AdminAction } from "~/shared/types/domain"
import { createInitialWorkspaceDocument } from "~/shared/utils/workspace-persistence"
import { listPersistedAdminActions } from "./admin-persistence"
import { mergeLocalAdminAuditState } from "./local-admin-audit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

interface AdminPostureUser {
  id: string
  role?: string | null
  suspendedAt?: string | null
}

interface SupabaseAdminUserRow {
  id: string
  role: string | null
  suspended_at: string | null
}

const adminRoles = new Set(["admin", "investor_admin"])
const bootstrapAuditPattern = /\b(?:bootstrap|first[-\s]?admin|initial production admin)\b/i

function isActiveAdmin(user: AdminPostureUser) {
  return Boolean(user.id && user.role && adminRoles.has(user.role) && !user.suspendedAt)
}

function isInvestorAdmin(user: AdminPostureUser) {
  return user.role === "investor_admin"
}

function actionTime(action: AdminAction) {
  const time = new Date(action.createdAt).getTime()
  return Number.isFinite(time) ? time : 0
}

function indicatesAdminBootstrap(action: AdminAction, activeAdminIds: Set<string>) {
  return action.type === "change_user_role"
    && action.targetType === "user"
    && (activeAdminIds.has(action.targetId) || bootstrapAuditPattern.test(action.notes))
}

export function buildAdminPosture(users: AdminPostureUser[], actions: AdminAction[]): ProductionReadinessAdminPosture {
  const activeAdmins = users.filter(isActiveAdmin)
  const activeAdminIds = new Set(activeAdmins.map(user => user.id))
  const bootstrapActions = actions
    .filter(action => indicatesAdminBootstrap(action, activeAdminIds))
    .sort((left, right) => actionTime(right) - actionTime(left))

  return {
    activeAdminCount: activeAdmins.length,
    activeInvestorAdminCount: activeAdmins.filter(isInvestorAdmin).length,
    hasBootstrapAuditEvidence: bootstrapActions.length > 0,
    latestBootstrapAuditAt: bootstrapActions.at(0)?.createdAt || null,
  }
}

async function readSupabaseAdminPosture(event: H3Event) {
  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const [usersResult, actions] = await Promise.all([
    adminClient
      .from("users")
      .select("id,role,suspended_at")
      .in("role", ["admin", "investor_admin"])
      .limit(500),
    listPersistedAdminActions(event),
  ])

  if (usersResult.error)
    throw usersResult.error

  const users = ((usersResult.data || []) as SupabaseAdminUserRow[]).map(row => ({
    id: row.id,
    role: row.role,
    suspendedAt: row.suspended_at,
  }))

  return buildAdminPosture(users, actions)
}

async function readLocalAdminPosture() {
  const seed = await mergeLocalAdminAuditState(createInitialWorkspaceDocument())
  return buildAdminPosture(seed.users, seed.adminActions)
}

export async function readAdminPosture(event: H3Event) {
  return isSupabaseEnabled(event)
    ? readSupabaseAdminPosture(event)
    : readLocalAdminPosture()
}
