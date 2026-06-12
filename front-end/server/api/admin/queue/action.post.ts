import type { H3Event } from "h3"
import type { AdminActionTargetType, AdminActionType, AdminEscalationQueue, SessionUser } from "~/shared/types/domain"
import { defaultAdminEscalationQueueForTarget } from "~/shared/utils/admin"
import { getUserById } from "~/shared/utils/workspace"
import { requireAdminSession, validateAdminCommandQueueActionPayload } from "../../../utils/admin"
import { persistAdminAction } from "../../../utils/admin-persistence"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../../utils/supabase"

const actionTypeByQueueAction: Record<ReturnType<typeof validateAdminCommandQueueActionPayload>["action"], AdminActionType> = {
  assign: "assign_case",
  escalate: "escalate_case",
  review_evidence: "review_evidence",
}

function sessionIdentity(session: SessionUser) {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

function defaultEscalationQueue(targetType: AdminActionTargetType): AdminEscalationQueue {
  return defaultAdminEscalationQueueForTarget(targetType)
}

async function assertAssignableAdmin(event: H3Event, session: SessionUser, userId: string) {
  if (userId === session.id)
    return userId

  if (isSupabaseEnabled(event)) {
    const adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const { data, error } = await adminClient
      .from("users")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle<{ id: string, role: string }>()

    if (error)
      throw error

    if (!data || !["admin", "investor_admin"].includes(data.role))
      throw createError({ statusCode: 400, statusMessage: "Queue cases can only be assigned to admin users." })

    return data.id
  }

  const { seed } = await loadMemberWorkspaceState(event, sessionIdentity(session))
  const user = getUserById(seed, userId)
  if (!user || !["admin", "investor_admin"].includes(user.role))
    throw createError({ statusCode: 400, statusMessage: "Queue cases can only be assigned to admin users." })

  return user.id
}

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 90,
    scope: "admin:queue-action",
    windowMs: 60 * 1000,
  })

  const payload = validateAdminCommandQueueActionPayload(await readBody(event))
  const createdAt = new Date().toISOString()
  const metadata = payload.action === "assign"
    ? { assignedAdminUserId: await assertAssignableAdmin(event, session, payload.assignedAdminUserId || session.id) }
    : payload.action === "escalate"
      ? { escalationQueue: payload.escalationQueue || defaultEscalationQueue(payload.targetType) }
      : {}
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    metadata,
    notes: payload.notes,
    targetId: payload.targetId,
    targetType: payload.targetType,
    type: actionTypeByQueueAction[payload.action],
  }

  await persistAdminAction(event, action)

  return { action }
})
