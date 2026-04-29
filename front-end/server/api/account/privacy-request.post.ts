import { privacyRequestSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../../utils/auth"
import { persistPrivacyRequest } from "../../utils/privacy-requests"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 5,
    scope: "account:privacy-request",
    windowMs: 60 * 60 * 1000,
  })

  const payload = privacyRequestSchema.parse(await readBody(event))
  const request = await persistPrivacyRequest(event, session, payload)

  return { request }
})
