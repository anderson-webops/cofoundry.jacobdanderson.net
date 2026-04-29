import { assertAccountAccessEnabled, createMockAccount, validateSignUpPayload } from "~/server/utils/auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertAccountAccessEnabled()
  const payload = validateSignUpPayload(await readBody(event))
  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 5,
    scope: "auth:sign-up",
    windowMs: 60 * 60 * 1000,
  })
  const session = await createMockAccount(event, payload)
  return { session }
})
