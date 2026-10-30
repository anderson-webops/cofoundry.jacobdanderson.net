import type { AccessRequest } from "~/shared/types/domain"
import { listAccessRequests } from "../../utils/access-requests"
import { requireAdminSession } from "../../utils/admin"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:access-requests",
    windowMs: 60 * 1000,
  })

  return {
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
    requests: await listAccessRequests(event) as AccessRequest[],
    warning: null,
  }
})
