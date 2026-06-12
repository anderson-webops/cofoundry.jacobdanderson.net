import { requireAdminSession } from "../../utils/admin"
import { readAdminOperationsRows } from "../../utils/admin-operations"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "admin:operations",
    windowMs: 60 * 1000,
  })

  return readAdminOperationsRows(event)
})
