import { createError, defineEventHandler, readBody, setResponseStatus } from "h3"
import { evaluatePublicIntakeQuality } from "~/shared/utils/intake-quality"
import { accessRequestSchema } from "~/shared/utils/validation"
import { createAccessRequest } from "../utils/access-requests"
import { isContactMailConfigured, sendContactMessage } from "../utils/contact"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  assertRateLimit(event, {
    limit: 20,
    scope: "access-requests:ip",
    windowMs: 60 * 60 * 1000,
  })

  const payload = accessRequestSchema.parse(await readBody(event))

  if (payload.website) {
    setResponseStatus(event, 202)
    return { success: true }
  }

  const quality = evaluatePublicIntakeQuality({
    email: payload.email,
    kind: "access_request",
    message: [
      payload.company || "",
      payload.useCase,
      payload.role,
      payload.companyStage,
      payload.timeline,
    ].join(" "),
    name: payload.name,
    subject: "Workspace access request",
  })

  if (!quality.accepted) {
    throw createError({
      data: {
        issues: quality.issues.map(issue => issue.code),
        message: quality.message,
      },
      statusCode: 400,
      statusMessage: "Access request needs more specific details",
    })
  }

  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 4,
    scope: "access-requests:account",
    windowMs: 60 * 60 * 1000,
  })

  const { created } = await createAccessRequest(event, payload)
  let notified = false
  let notificationError: string | null = null

  if (created && isContactMailConfigured()) {
    try {
      await sendContactMessage({
        company: payload.company || "",
        email: payload.email,
        message: [
          payload.useCase,
          "",
          `Role: ${payload.role}`,
          `Stage: ${payload.companyStage}`,
          `Timeline: ${payload.timeline}`,
          `Source: ${payload.source || "site"}`,
        ].join("\n"),
        name: payload.name,
        subject: "Workspace access request",
        website: "",
      }, event)
      notified = true
    }
    catch (error) {
      notificationError = error instanceof Error
        ? error.message
        : "Notification delivery failed."
    }
  }

  if (notificationError) {
    console.error("CoFoundry access request notification failed:", notificationError)
  }

  setResponseStatus(event, 202)
  return {
    notified,
    success: true,
  }
})
