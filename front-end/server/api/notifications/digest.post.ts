import { requireAuthenticatedSession } from "../../utils/auth"
import { loadMemberWorkspaceState } from "../../utils/member-workspace"
import { sendUnreadNotificationDigest } from "../../utils/notification-delivery"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 5,
    scope: "notifications:digest",
    windowMs: 60 * 60 * 1000,
  })

  const workspace = await loadMemberWorkspaceState(event, {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  })

  const delivery = await sendUnreadNotificationDigest(event, workspace.seed, workspace.session)

  return {
    configured: delivery.configured,
    delivered: delivery.delivered,
    unreadCount: delivery.unreadCount,
  }
})
