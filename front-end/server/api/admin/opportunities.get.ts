import { defineEventHandler } from "h3"
import { requireOpportunityReviewerSession } from "../../utils/admin"
import { listAdminOpportunityWorkspaceSlice } from "../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  const session = await requireOpportunityReviewerSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:opportunities",
    windowMs: 60 * 1000,
  })

  const slice = await listAdminOpportunityWorkspaceSlice(event)
  if (session.role === "investor_admin") {
    const profileByUserId = new Map(slice.profiles.map(profile => [profile.userId, profile]))

    return {
      mode: isSupabaseEnabled(event)
        ? "supabase"
        : "mock",
      opportunities: slice.opportunities,
      owners: slice.users.map(user => ({
        displayName: profileByUserId.get(user.id)?.displayName || user.id,
        email: user.email,
        id: user.id,
        verifiedEmail: user.verifiedEmail,
      })),
      profiles: [],
      users: [],
    }
  }

  return {
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
    ...slice,
  }
})
