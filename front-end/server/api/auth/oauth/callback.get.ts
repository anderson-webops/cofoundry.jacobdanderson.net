import { getQuery, sendRedirect } from "h3"
import { completeSupabaseOAuthCallback } from "~/server/utils/auth"
import { normalizeOAuthProvider } from "~/shared/utils/oauth-providers"
import { assertRateLimit } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 60,
    scope: "auth:oauth-callback",
    windowMs: 5 * 60 * 1000,
  })

  const query = getQuery(event)
  const code = typeof query.code === "string"
    ? query.code
    : ""
  const error = typeof query.error === "string"
    ? query.error
    : ""
  const provider = normalizeOAuthProvider(query.provider)

  if (error || !code) {
    const redirectUrl = await completeSupabaseOAuthCallback(event, "", provider)
    return sendRedirect(event, redirectUrl)
  }

  const redirectUrl = await completeSupabaseOAuthCallback(event, code, provider)
  return sendRedirect(event, redirectUrl)
})
