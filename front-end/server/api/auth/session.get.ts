import { clearSessionCookie, readSession } from "~/server/utils/auth"

export default defineEventHandler((event) => {
  const session = readSession(event)

  if (!session)
    clearSessionCookie(event)

  return { session }
})
