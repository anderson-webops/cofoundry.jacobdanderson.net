import type { AccessRequest } from "~/shared/types/domain"
import { requireAdminSession } from "../../utils/admin"
import { listLocalAccessRequests } from "../../utils/local-access-requests"
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

  if (isSupabaseEnabled(event)) {
    return {
      mode: "supabase",
      requests: [] as AccessRequest[],
      warning: "Access-request persistence is currently local-only. Add the Supabase table before enabling this queue in Supabase mode.",
    }
  }

  return {
    mode: "mock",
    requests: await listLocalAccessRequests(),
    warning: null,
  }
})
