import { assertAccountAccessEnabled, getMockSessionByUserId, writeSession } from "~/server/utils/auth"
import { assertRateLimit } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  await assertAccountAccessEnabled(event)
  assertRateLimit(event, {
    limit: 20,
    scope: "auth:oauth",
    windowMs: 5 * 60 * 1000,
  })
  const body = await readBody<{ provider: "google" | "github" }>(event)

  if (isSupabaseEnabled(event))
    throw createError({ statusCode: 501, statusMessage: "OAuth sign-in is not enabled for this deployment yet." })

  if (body.provider !== "github" && body.provider !== "google")
    throw createError({ statusCode: 400, statusMessage: "Unsupported OAuth provider." })

  const providerMap = {
    github: "user_olivia",
    google: "user_malik",
  }

  const session = getMockSessionByUserId(providerMap[body.provider])
  if (!session)
    throw createError({ statusCode: 400, statusMessage: "OAuth sign-in is unavailable in this environment." })

  writeSession(event, session)
  return { session }
})
