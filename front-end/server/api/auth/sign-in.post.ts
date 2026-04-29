import { assertSignInAccessEnabled, validateSignInPayload, verifyCredentials, writeSession } from "~/server/utils/auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertSignInAccessEnabled()
  const payload = validateSignInPayload(await readBody(event))
  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 10,
    scope: "auth:sign-in",
    windowMs: 5 * 60 * 1000,
  })
  const session = await verifyCredentials(event, payload.email, payload.password)

  writeSession(event, session)
  return { session }
})
