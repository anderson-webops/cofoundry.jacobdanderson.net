import { assertAccountAccessEnabled, beginSupabaseOAuthSignIn, getMockSessionByUserId, writeSession } from "~/server/utils/auth"
import { normalizeOAuthProvider } from "~/shared/utils/oauth-providers"
import { oauthSignInSchema } from "~/shared/utils/validation"
import { assertRateLimit } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  await assertAccountAccessEnabled(event)
  assertRateLimit(event, {
    limit: 20,
    scope: "auth:oauth",
    windowMs: 5 * 60 * 1000,
  })
  const body = oauthSignInSchema.parse(await readBody(event))
  const provider = normalizeOAuthProvider(body.provider)

  if (!provider)
    throw createError({ statusCode: 400, statusMessage: "Unsupported OAuth provider." })

  if (isSupabaseEnabled(event)) {
    const redirectUrl = await beginSupabaseOAuthSignIn(event, provider)
    return { redirectUrl }
  }

  const providerMap = {
    github: "user_olivia",
    google: "user_malik",
  }

  const session = getMockSessionByUserId(providerMap[provider])
  if (!session)
    throw createError({ statusCode: 400, statusMessage: "OAuth sign-in is unavailable in this environment." })

  writeSession(event, session)
  return { session }
})
