import { requireAdminSession, validateAdminUserEmailVerificationPayload } from "../../../../utils/admin"
import { persistAdminAction, persistUserEmailVerification } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:user-email-verification",
    windowMs: 60 * 1000,
  })
  const payload = validateAdminUserEmailVerificationPayload(await readBody(event))
  const targetUserId = getRouterParam(event, "id")

  if (!targetUserId)
    throw createError({ statusCode: 400, statusMessage: "A target user id is required." })

  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    notes: payload.notes,
    targetId: targetUserId,
    targetType: "user" as const,
    type: "verify_email" as const,
  }

  await persistUserEmailVerification(event, targetUserId, true)
  await persistAdminAction(event, action)

  return {
    action,
    user: {
      id: targetUserId,
      verifiedEmail: true,
    },
  }
})
