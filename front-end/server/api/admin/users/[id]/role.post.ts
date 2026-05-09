import { requireAdminSession, validateAdminUserRolePayload } from "../../../../utils/admin"
import { persistAdminAction, persistUserRole } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:user-role",
    windowMs: 60 * 1000,
  })
  const payload = validateAdminUserRolePayload(await readBody(event))
  const targetUserId = getRouterParam(event, "id")

  if (!targetUserId)
    throw createError({ statusCode: 400, statusMessage: "A target user id is required." })

  if (targetUserId === session.id && !["admin", "investor_admin"].includes(payload.role))
    throw createError({ statusCode: 400, statusMessage: "Admins cannot remove their own admin role from this surface." })

  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    notes: payload.notes,
    targetId: targetUserId,
    targetType: "user" as const,
    type: "change_user_role" as const,
  }

  await persistUserRole(event, targetUserId, payload.role)
  await persistAdminAction(event, action)

  return {
    action,
    user: {
      id: targetUserId,
      role: payload.role,
    },
  }
})
