import { evaluateAdminSecurityMutation } from "~/shared/utils/admin-authorization"
import { requireAdminSession, validateAdminUserModerationPayload } from "../../../../utils/admin"
import { listAdminSecurityUsers, persistAdminUserSecurityAction } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:user-status",
    windowMs: 60 * 1000,
  })
  const payload = validateAdminUserModerationPayload(await readBody(event))
  const targetUserId = getRouterParam(event, "id")

  if (!targetUserId)
    throw createError({ statusCode: 400, statusMessage: "A target user id is required." })

  const users = await listAdminSecurityUsers(event)
  const target = users.find(user => user.id === targetUserId)
  const mutation = { action: payload.action, kind: "change_status" as const }
  const decision = evaluateAdminSecurityMutation(users, session.id, targetUserId, mutation)
  if (!decision.allowed)
    throw createError(decision)

  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    notes: payload.notes,
    targetId: targetUserId,
    targetType: "user" as const,
    type: payload.action === "suspend"
      ? "suspend_user" as const
      : "reinstate_user" as const,
    metadata: {
      previousSuspendedAt: target?.suspendedAt,
      nextSuspendedAt: payload.action === "suspend"
        ? createdAt
        : null,
    },
  }
  const suspendedAt = payload.action === "suspend"
    ? createdAt
    : null

  await persistAdminUserSecurityAction(event, { action, mutation })

  return {
    action,
    user: {
      id: targetUserId,
      suspendedAt,
    },
  }
})
