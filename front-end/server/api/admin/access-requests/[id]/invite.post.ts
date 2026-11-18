import { createError, defineEventHandler, getRouterParam, readBody } from "h3"
import { adminAccessInviteSchema } from "~/shared/utils/validation"
import { createAccessInvite } from "../../../../utils/access-requests"
import { requireAdminSession } from "../../../../utils/admin"
import { resolveServerAppUrl } from "../../../../utils/app-url"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "admin:access-request-invite",
    windowMs: 60 * 1000,
  })

  const requestId = getRouterParam(event, "id")
  if (!requestId)
    throw createError({ statusCode: 400, statusMessage: "An access request id is required." })

  const payload = adminAccessInviteSchema.parse(await readBody(event))
  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    metadata: {
      nextStatus: "invited",
    },
    notes: payload.notes,
    targetId: requestId,
    targetType: "access_request" as const,
    type: "issue_access_invite" as const,
  }
  const invite = await createAccessInvite(event, requestId, {
    action,
    appUrl: resolveServerAppUrl(event),
    expectedUpdatedAt: payload.expectedUpdatedAt,
  })

  if (!invite)
    throw createError({ statusCode: 404, statusMessage: "Access request was not found." })

  return {
    ...invite,
    action,
  }
})
