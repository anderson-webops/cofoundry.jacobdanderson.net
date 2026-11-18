import { createError, defineEventHandler, getRouterParam } from "h3"
import { requireAuthenticatedSession } from "../../../../utils/auth"
import { markInboxNotificationRead } from "../../../../utils/collaboration-workflow"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 240,
    scope: "inbox:read",
    windowMs: 60 * 1000,
  })
  const notificationId = getRouterParam(event, "id")

  if (!notificationId)
    throw createError({ statusCode: 400, statusMessage: "A notification id is required." })

  return markInboxNotificationRead(event, session, notificationId)
})
