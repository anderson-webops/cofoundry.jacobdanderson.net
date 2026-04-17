import { assertAccountAccessEnabled, getMockSessionByUserId, writeSession } from "~/server/utils/auth"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  assertAccountAccessEnabled()
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
