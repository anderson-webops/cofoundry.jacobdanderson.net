import { defineEventHandler, readBody } from "h3"
import { emailPreferenceApplySchema } from "~/shared/utils/validation"
import { applyEmailPreferenceToken } from "../../utils/email-preferences"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 30,
    scope: "notifications:preferences:ip",
    windowMs: 60 * 1000,
  })

  const { token } = emailPreferenceApplySchema.parse(await readBody(event))

  assertRateLimit(event, {
    key: buildRateLimitKey(event, token.slice(0, 24) || "anonymous-email-preference"),
    limit: 12,
    scope: "notifications:preferences:token",
    windowMs: 60 * 1000,
  })

  const result = await applyEmailPreferenceToken(event, token)

  return {
    ok: true,
    ...result,
  }
})
