import { requireAuthenticatedSession } from "../../../utils/auth"
import { markInboxNotificationRead } from "../../../utils/collaboration-workflow"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const notificationId = getRouterParam(event, "id")

  if (!notificationId)
    throw createError({ statusCode: 400, statusMessage: "A notification id is required." })

  return markInboxNotificationRead(event, session, notificationId)
})
