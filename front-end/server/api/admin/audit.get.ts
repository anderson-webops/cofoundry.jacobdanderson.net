import { requireAdminSession } from "../../utils/admin"
import { listPersistedAdminActions } from "../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:audit",
    windowMs: 60 * 1000,
  })

  return { actions: await listPersistedAdminActions(event) }
})
