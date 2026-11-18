import type { H3Event } from "h3"
import type { ProductionReadinessAdminPosture } from "./production-readiness"
import type { AdminAction } from "~/shared/types/domain"
import { createError } from "h3"
import { listPersistedAdminActions } from "./admin-persistence"
import { mergeLocalAdminAuditState } from "./local-admin-audit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"
import { createInitialWorkspaceDocument } from "./workspace-seed"

interface AdminPostureUser {
  id: string
  role?: string | null
  suspendedAt?: string | null
  verifiedEmail: boolean
}

interface SupabaseAdminUserRow {
  id: string
  role: string | null
  suspended_at: string | null
  verified_email: boolean
}

const bootstrapAuditPattern = /\b(?:bootstrap|first[-\s]?admin|initial production admin)\b/i

function isActiveAdmin(user: AdminPostureUser) {
  return Boolean(user.id && user.role === "admin" && !user.suspendedAt && user.verifiedEmail)
}

function isInvestorAdmin(user: AdminPostureUser) {
  return user.role === "investor_admin" && user.verifiedEmail
}

function actionTime(action: AdminAction) {
  const time = new Date(action.createdAt).getTime()
  return Number.isFinite(time)
    ? time
    : 0
}

function indicatesAdminBootstrap(action: AdminAction, activeAdminIds: Set<string>) {
  return action.type === "change_user_role"
    && action.targetType === "user"
    && (activeAdminIds.has(action.targetId) || bootstrapAuditPattern.test(action.notes))
}

export function buildAdminPosture(users: AdminPostureUser[], actions: AdminAction[]): ProductionReadinessAdminPosture {
  const activeAdmins = users.filter(isActiveAdmin)
  const activeInvestorAdmins = users.filter(user => isInvestorAdmin(user) && !user.suspendedAt)
  const activeAdminIds = new Set(activeAdmins.map(user => user.id))
  const bootstrapActions = actions
    .filter(action => indicatesAdminBootstrap(action, activeAdminIds))
    .sort((left, right) => actionTime(right) - actionTime(left))

  return {
    activeAdminCount: activeAdmins.length,
    activeInvestorAdminCount: activeInvestorAdmins.length,
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
      .select("id,role,suspended_at,verified_email")
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
    verifiedEmail: row.verified_email,
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
