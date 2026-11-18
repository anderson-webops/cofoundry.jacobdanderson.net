import { defineEventHandler } from "h3"
import { clearSessionCookie, readAuthoritativeSession } from "~/server/utils/auth"
import { assertRateLimit } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 240,
    scope: "auth:session",
    windowMs: 5 * 60 * 1000,
  })
  const session = await readAuthoritativeSession(event)

  if (!session)
    clearSessionCookie(event)

  return { session }
})
