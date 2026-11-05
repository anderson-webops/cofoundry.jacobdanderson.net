import type { H3Event } from "h3"
import type { AdminActionType, SessionUser } from "~/shared/types/domain"
import { defaultAdminEscalationQueueForTarget } from "~/shared/utils/admin"
import { getUserById } from "~/shared/utils/workspace"
import { listAccessRequests } from "../../../utils/access-requests"
import { requireAdminSession, validateAdminCommandQueueActionPayload } from "../../../utils/admin"
import { persistAdminAction } from "../../../utils/admin-persistence"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { listPrivacyRequests } from "../../../utils/privacy-requests"
import { productionReadinessCheckIds } from "../../../utils/production-readiness"
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

async function assertAssignableAdmin(event: H3Event, session: SessionUser, userId: string) {
  if (userId === session.id)
    return userId

  if (isSupabaseEnabled(event)) {
    const adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const { data, error } = await adminClient
      .from("users")
      .select("id,role,suspended_at")
      .eq("id", userId)
      .maybeSingle<{ id: string, role: string, suspended_at: string | null }>()

    if (error)
      throw error

    if (!data || data.suspended_at || data.role !== "admin")
      throw createError({ statusCode: 400, statusMessage: "Queue cases can only be assigned to active full-admin users." })

    return data.id
  }

  const { seed } = await loadMemberWorkspaceState(event, sessionIdentity(session))
  const user = getUserById(seed, userId)
  if (!user || user.suspendedAt || user.role !== "admin")
    throw createError({ statusCode: 400, statusMessage: "Queue cases can only be assigned to active full-admin users." })

  return user.id
}

async function assertQueueTargetExists(
  event: H3Event,
  session: SessionUser,
  targetType: ReturnType<typeof validateAdminCommandQueueActionPayload>["targetType"],
  targetId: string,
) {
  if (targetType === "readiness_check") {
    if (!productionReadinessCheckIds.has(targetId))
      throw createError({ statusCode: 404, statusMessage: "Queue target was not found." })
    return
  }

  if (targetType === "access_request") {
    if (!(await listAccessRequests(event)).some(request => request.id === targetId))
      throw createError({ statusCode: 404, statusMessage: "Queue target was not found." })
    return
  }

  if (targetType === "privacy_request") {
    if (!(await listPrivacyRequests(event)).some(request => request.id === targetId))
      throw createError({ statusCode: 404, statusMessage: "Queue target was not found." })
    return
  }

  const { seed } = await loadMemberWorkspaceState(event, sessionIdentity(session))
  const exists = targetType === "file_upload"
    ? seed.fileUploads.some(file => file.id === targetId)
    : targetType === "opportunity"
      ? seed.opportunities.some(opportunity => opportunity.id === targetId)
      : seed.reports.some(report => report.id === targetId)

  if (!exists)
    throw createError({ statusCode: 404, statusMessage: "Queue target was not found." })
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
  if (payload.action === "review_evidence" && ![
    "file_upload",
    "opportunity",
    "privacy_request",
    "report"
  ].includes(payload.targetType)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Evidence review is not available for this queue target type.",
    })
  }

  await assertQueueTargetExists(event, session, payload.targetType, payload.targetId)
  const createdAt = new Date().toISOString()
  const metadata = payload.action === "assign"
    ? { assignedAdminUserId: await assertAssignableAdmin(event, session, payload.assignedAdminUserId || session.id) }
    : payload.action === "escalate"
      ? { escalationQueue: payload.escalationQueue || defaultAdminEscalationQueueForTarget(payload.targetType) }
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
