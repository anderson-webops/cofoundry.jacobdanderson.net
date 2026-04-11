import { contactSchema } from "~/shared/utils/validation"

export default defineEventHandler(async (event) => {
  const payload = contactSchema.parse(await readBody(event))

  return {
    success: true,
    receivedAt: new Date().toISOString(),
    payload,
  }
})
