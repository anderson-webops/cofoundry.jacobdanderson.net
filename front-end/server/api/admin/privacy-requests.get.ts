import { defineEventHandler } from "h3"
import { requireAdminSession } from "../../utils/admin"
import { listPrivacyRequests } from "../../utils/privacy-requests"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:privacy-requests",
    windowMs: 60 * 1000,
  })

  return { requests: await listPrivacyRequests(event) }
})
