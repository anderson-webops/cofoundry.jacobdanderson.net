import { validateAccessInvite } from "../../utils/access-requests"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === "string" ? query.token.trim() : ""
  const email = typeof query.email === "string" ? query.email.trim() : undefined

  assertRateLimit(event, {
    key: buildRateLimitKey(event, email || token.slice(0, 16) || "anonymous"),
    limit: 30,
    scope: "access-invite-validation",
    windowMs: 60 * 1000,
  })

  if (!token)
    return { request: null, valid: false }

  const request = await validateAccessInvite(event, token, email)

  return {
    request,
    valid: Boolean(request),
  }
})
