import type { AdminActionType } from "~/shared/types/domain"
import { requireAdminSession, validateAdminCommandQueueActionPayload } from "../../../utils/admin"
import { persistAdminAction } from "../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

const actionTypeByQueueAction: Record<ReturnType<typeof validateAdminCommandQueueActionPayload>["action"], AdminActionType> = {
  assign: "assign_case",
  escalate: "escalate_case",
  review_evidence: "review_evidence",
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
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    notes: payload.notes,
    targetId: payload.targetId,
    targetType: payload.targetType,
    type: actionTypeByQueueAction[payload.action],
  }

  await persistAdminAction(event, action)

  return { action }
})
