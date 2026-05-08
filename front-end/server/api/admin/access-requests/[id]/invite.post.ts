import { adminAccessInviteSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { resolveServerAppUrl } from "../../../../utils/app-url"
import { createLocalAccessInvite } from "../../../../utils/local-access-requests"
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
  const invite = await createLocalAccessInvite(requestId, {
    adminNotes: payload.notes,
    appUrl: resolveServerAppUrl(event),
    reviewedByUserId: session.id,
  })

  if (!invite)
    throw createError({ statusCode: 404, statusMessage: "Access request was not found." })

  return invite
})
