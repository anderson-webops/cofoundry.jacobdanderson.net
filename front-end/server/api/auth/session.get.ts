import { clearSessionCookie, readAuthoritativeSession } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  const session = await readAuthoritativeSession(event)

  if (!session)
    clearSessionCookie(event)

  return { session }
})
