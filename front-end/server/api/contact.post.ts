import { createError, setResponseStatus } from "h3"

import { contactSchema } from "~/shared/utils/validation"

import { isContactMailConfigured, sendContactMessage } from "../utils/contact"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const payload = contactSchema.parse(await readBody(event))

  if (payload.website) {
    setResponseStatus(event, 202)
    return { success: true }
  }

  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 5,
    scope: "contact",
    windowMs: 10 * 60 * 1000,
  })

  if (!isContactMailConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: "Contact form is not configured",
      data: {
        message: "The contact form is not configured on the server yet.",
      },
    })
  }

  try {
    await sendContactMessage(payload, event)
    setResponseStatus(event, 202)
    return { success: true }
  }
  catch (error) {
    console.error("CoFoundry contact form email failed:", error)
    throw createError({
      statusCode: 502,
      statusMessage: "Contact delivery failed",
      data: {
        message: "The message could not be sent right now. Please try again later.",
      },
    })
  }
})
