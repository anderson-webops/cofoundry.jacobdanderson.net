import { defineEventHandler, readBody } from "h3"
import { accessInviteValidationSchema } from "~/shared/utils/validation"
import { validateAccessInvite } from "../../utils/access-requests"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 60,
    scope: "access-invite-validation:ip",
    windowMs: 60 * 1000,
  })

  const { email, token } = accessInviteValidationSchema.parse(await readBody(event))

  assertRateLimit(event, {
    key: buildRateLimitKey(event, email || token.slice(0, 16)),
    limit: 30,
    scope: "access-invite-validation:token",
    windowMs: 60 * 1000,
  })

  const request = await validateAccessInvite(event, token, email)

  return {
    request: request
      ? {
          email: request.email,
          name: request.name,
        }
      : null,
    valid: Boolean(request),
  }
})
