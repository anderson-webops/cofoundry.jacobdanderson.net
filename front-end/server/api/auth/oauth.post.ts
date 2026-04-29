import { assertAccountAccessEnabled, getMockSessionByUserId, writeSession } from "~/server/utils/auth"
import { assertRateLimit } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  assertAccountAccessEnabled()
  assertRateLimit(event, {
    limit: 20,
    scope: "auth:oauth",
    windowMs: 5 * 60 * 1000,
  })
  const body = await readBody<{ provider: "google" | "github" }>(event)

  if (isSupabaseEnabled(event))
    throw createError({ statusCode: 501, statusMessage: "OAuth sign-in is not enabled for this deployment yet." })

  const providerMap = {
    github: "user_olivia",
    google: "user_malik",
  }

  const session = getMockSessionByUserId(providerMap[body.provider])
  if (!session)
    throw createError({ statusCode: 400, statusMessage: "OAuth demo account is unavailable." })

  writeSession(event, session)
  return { session }
})
