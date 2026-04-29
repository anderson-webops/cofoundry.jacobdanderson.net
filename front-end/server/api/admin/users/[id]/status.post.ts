import { requireAdminSession, validateAdminUserModerationPayload } from "../../../../utils/admin"
import { persistAdminAction, persistUserSuspension } from "../../../../utils/admin-persistence"
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

  if (payload.action === "suspend" && targetUserId === session.id)
    throw createError({ statusCode: 400, statusMessage: "Admins cannot suspend their own account." })

  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    notes: payload.notes,
    targetId: targetUserId,
    targetType: "user" as const,
    type: payload.action === "suspend" ? "suspend_user" as const : "reinstate_user" as const,
  }
  const suspendedAt = payload.action === "suspend" ? createdAt : null

  await persistUserSuspension(event, targetUserId, suspendedAt)
  await persistAdminAction(event, action)

  return {
    action,
    user: {
      id: targetUserId,
      suspendedAt,
    },
  }
})
