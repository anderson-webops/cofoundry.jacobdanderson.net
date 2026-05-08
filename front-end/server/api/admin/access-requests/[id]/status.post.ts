import { adminAccessRequestStatusSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { updateLocalAccessRequestStatus } from "../../../../utils/local-access-requests"
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
  const request = await updateLocalAccessRequestStatus(requestId, {
    adminNotes: payload.notes,
    reviewedByUserId: session.id,
    status: payload.status,
  })

  if (!request)
    throw createError({ statusCode: 404, statusMessage: "Access request was not found." })

  return { request }
})
