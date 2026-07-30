import { assertAccountAccessEnabled, createMockAccount, validateSignUpPayload } from "~/server/utils/auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 20,
    scope: "auth:sign-up:ip",
    windowMs: 60 * 60 * 1000,
  })
  const payload = validateSignUpPayload(await readBody(event))
  await assertAccountAccessEnabled(event, payload.inviteToken, payload.email)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 5,
    scope: "auth:sign-up:account",
    windowMs: 60 * 60 * 1000,
  })
  const session = await createMockAccount(event, payload)
  return {
    pendingVerification: !session,
    session,
  }
})
