import { assertSignInAccessEnabled, getSessionForEmail, validateSignInPayload, verifyCredentials, writeSession } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  assertSignInAccessEnabled()
  const payload = validateSignInPayload(await readBody(event))
  const userId = await verifyCredentials(event, payload.email, payload.password)
  const session = getSessionForEmail(payload.email)

  if (!session || session.id !== userId)
    throw createError({ statusCode: 401, statusMessage: "Unable to load account session." })

  writeSession(event, session)
  return { session }
})
