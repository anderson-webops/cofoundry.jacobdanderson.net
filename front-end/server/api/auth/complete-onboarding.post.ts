import { completeOnboarding, requireAuthenticatedSession } from "~/server/utils/auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const currentSession = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, currentSession.id),
    limit: 10,
    scope: "auth:complete-onboarding",
    windowMs: 60 * 60 * 1000,
  })

  return {
    session: await completeOnboarding(event, currentSession),
  }
})
