import { assertSignInAccessEnabled, validateSignInPayload, verifyCredentials, writeSession } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  assertSignInAccessEnabled()
  const payload = validateSignInPayload(await readBody(event))
  const session = await verifyCredentials(event, payload.email, payload.password)

  writeSession(event, session)
  return { session }
})
