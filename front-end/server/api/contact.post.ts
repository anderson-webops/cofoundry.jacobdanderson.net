import { createError, defineEventHandler, readBody, setResponseStatus } from "h3"

import { evaluatePublicIntakeQuality } from "~/shared/utils/intake-quality"
import { contactSchema } from "~/shared/utils/validation"

import { isContactMailConfigured, sendContactMessage } from "../utils/contact"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 20,
    scope: "contact:ip",
    windowMs: 10 * 60 * 1000,
  })

  const payload = contactSchema.parse(await readBody(event))

  if (payload.website) {
    setResponseStatus(event, 202)
    return { success: true }
  }

  const quality = evaluatePublicIntakeQuality({
    email: payload.email,
    kind: "contact",
    message: [
      payload.company || "",
      payload.subject,
      payload.message,
    ].join(" "),
    name: payload.name,
    subject: payload.subject,
  })

  if (!quality.accepted) {
    throw createError({
      data: {
        issues: quality.issues.map(issue => issue.code),
        message: quality.message,
      },
      statusCode: 400,
      statusMessage: "Contact submission needs more specific details",
    })
  }

  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 5,
    scope: "contact:account",
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
