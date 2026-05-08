import { setResponseStatus } from "h3"
import { accessRequestSchema } from "~/shared/utils/validation"
import { isContactMailConfigured, sendContactMessage } from "../utils/contact"
import { createLocalAccessRequest } from "../utils/local-access-requests"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const payload = accessRequestSchema.parse(await readBody(event))

  if (payload.website) {
    setResponseStatus(event, 202)
    return { success: true }
  }

  assertRateLimit(event, {
    key: buildRateLimitKey(event, payload.email),
    limit: 4,
    scope: "access-requests",
    windowMs: 60 * 60 * 1000,
  })

  const request = await createLocalAccessRequest(payload)
  let notified = false
  let notificationError: string | null = null

  if (isContactMailConfigured()) {
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
      notificationError = error instanceof Error ? error.message : "Notification delivery failed."
    }
  }

  if (notificationError) {
    console.error("CoFoundry access request notification failed:", notificationError)
  }

  setResponseStatus(event, 202)
  return {
    notified,
    request,
    success: true,
  }
})
