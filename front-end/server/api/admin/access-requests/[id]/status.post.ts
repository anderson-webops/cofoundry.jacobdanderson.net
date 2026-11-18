import { createError, defineEventHandler, getRouterParam, readBody } from "h3"
import { adminAccessRequestStatusSchema } from "~/shared/utils/validation"
import { updateAccessRequestStatus } from "../../../../utils/access-requests"
import { requireAdminSession } from "../../../../utils/admin"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:access-request-status",
    windowMs: 60 * 1000,
  })

  const requestId = getRouterParam(event, "id")
  if (!requestId)
    throw createError({ statusCode: 400, statusMessage: "An access request id is required." })

  const payload = adminAccessRequestStatusSchema.parse(await readBody(event))
  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    metadata: {
      nextStatus: payload.status,
    },
    notes: payload.notes,
    targetId: requestId,
    targetType: "access_request" as const,
    type: "update_access_request" as const,
  }
  const request = await updateAccessRequestStatus(event, requestId, {
    action,
    expectedUpdatedAt: payload.expectedUpdatedAt,
    status: payload.status,
  })

  if (!request)
    throw createError({ statusCode: 404, statusMessage: "Access request was not found." })

  return { action, request }
})
