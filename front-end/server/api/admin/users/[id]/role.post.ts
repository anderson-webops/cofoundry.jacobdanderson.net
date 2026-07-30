import { evaluateAdminSecurityMutation } from "~/shared/utils/admin-authorization"
import { requireFullAdminSession, validateAdminUserRolePayload } from "../../../../utils/admin"
import { listAdminSecurityUsers, persistAdminUserSecurityAction } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireFullAdminSession(event)
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

  const users = await listAdminSecurityUsers(event)
  const target = users.find(user => user.id === targetUserId)
  const mutation = { kind: "change_role" as const, role: payload.role }
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
    type: "change_user_role" as const,
    metadata: {
      previousRole: target?.role,
      nextRole: payload.role,
    },
  }

  await persistAdminUserSecurityAction(event, { action, mutation })

  return {
    action,
    user: {
      id: targetUserId,
      role: payload.role,
    },
  }
})
