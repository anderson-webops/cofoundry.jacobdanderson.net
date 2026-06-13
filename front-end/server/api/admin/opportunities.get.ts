import { requireAdminSession } from "../../utils/admin"
import { listAdminOpportunityWorkspaceSlice } from "../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:opportunities",
    windowMs: 60 * 1000,
  })

  const slice = await listAdminOpportunityWorkspaceSlice(event)

  return {
    mode: isSupabaseEnabled(event) ? "supabase" : "mock",
    ...slice,
  }
})
