import { applyEmailPreferenceToken } from "../../utils/email-preferences"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event)
  const token = body?.token?.trim() || ""

  assertRateLimit(event, {
    key: buildRateLimitKey(event, token.slice(0, 24) || "anonymous-email-preference"),
    limit: 12,
    scope: "notifications:preferences",
    windowMs: 60 * 1000,
  })

  if (!token)
    throw createError({ statusCode: 400, statusMessage: "An email preference token is required." })

  const result = await applyEmailPreferenceToken(event, token)

  return {
    ok: true,
    ...result,
  }
})
