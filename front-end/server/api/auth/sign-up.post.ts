import { assertAccountAccessEnabled, createMockAccount, validateSignUpPayload } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  assertAccountAccessEnabled()
  const payload = validateSignUpPayload(await readBody(event))
  const session = await createMockAccount(event, payload)
  return { session }
})
