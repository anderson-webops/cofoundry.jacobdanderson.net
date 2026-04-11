import { requireAdminSession, validateAdminUserModerationPayload } from "../../../../utils/admin"

export default defineEventHandler(async (event) => {
  const session = requireAdminSession(event)
  const payload = validateAdminUserModerationPayload(await readBody(event))
  const targetUserId = getRouterParam(event, "id")

  if (!targetUserId)
    throw createError({ statusCode: 400, statusMessage: "A target user id is required." })

  const createdAt = new Date().toISOString()

  return {
    action: {
      id: crypto.randomUUID(),
      adminUserId: session.id,
      createdAt,
      notes: payload.notes,
      targetId: targetUserId,
      targetType: "user" as const,
      type: payload.action === "suspend" ? "suspend_user" as const : "reinstate_user" as const,
    },
    user: {
      id: targetUserId,
      suspendedAt: payload.action === "suspend" ? createdAt : null,
    },
  }
})
