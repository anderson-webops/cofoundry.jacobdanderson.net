import { adminPrivacyRequestStatusSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { persistAdminPrivacyRequestStatusAction, persistUserNotification } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:privacy-request-status",
    windowMs: 60 * 1000,
  })

  const requestId = getRouterParam(event, "id")
  if (!requestId)
    throw createError({ statusCode: 400, statusMessage: "A privacy request id is required." })

  const payload = adminPrivacyRequestStatusSchema.parse(await readBody(event))
  const updatedAt = new Date().toISOString()

  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt: updatedAt,
    metadata: {
      completionConfirmed: payload.status === "resolved" && payload.completionConfirmed,
    },
    notes: payload.notes,
    targetId: requestId,
    targetType: "privacy_request" as const,
    type: payload.status === "reviewed"
      ? "review_privacy_request" as const
      : "resolve_privacy_request" as const,
  }

  const persistedRequest = await persistAdminPrivacyRequestStatusAction(event, {
    action,
    completionConfirmed: payload.status === "resolved" && payload.completionConfirmed,
    expectedStatus: payload.expectedStatus,
    status: payload.status,
  })

  if (persistedRequest) {
    try {
      await persistUserNotification(event, {
        id: crypto.randomUUID(),
        userId: persistedRequest.userId,
        type: "admin",
        title: payload.status === "reviewed"
          ? "Privacy request reviewed"
          : "Privacy request resolved",
        body: payload.status === "reviewed"
          ? "An operator reviewed your privacy request and recorded the next handling note."
          : "An operator confirmed that the requested privacy action was completed and marked your request resolved. Review your account settings if you need another follow-up.",
        href: "/app/settings",
        readAt: null,
        createdAt: updatedAt,
      })
    }
    catch (error) {
      console.warn("[privacy] Request status persisted, but member notification delivery failed.", error)
    }
  }

  return {
    action,
    request: {
      id: requestId,
      resolvedAt: payload.status === "resolved"
        ? updatedAt
        : null,
      reviewedAt: payload.status === "reviewed"
        ? updatedAt
        : null,
      status: payload.status,
    },
  }
})
