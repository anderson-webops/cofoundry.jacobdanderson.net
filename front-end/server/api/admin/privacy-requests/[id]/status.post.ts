import { adminReportStatusSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { persistAdminAction, persistPrivacyRequestStatus, persistUserNotification } from "../../../../utils/admin-persistence"
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

  const payload = adminReportStatusSchema.parse(await readBody(event))
  const updatedAt = new Date().toISOString()

  const persistedRequest = await persistPrivacyRequestStatus(event, {
    adminUserId: session.id,
    notes: payload.notes,
    requestId,
    status: payload.status,
    timestamp: updatedAt,
  })

  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt: updatedAt,
    notes: payload.notes,
    targetId: requestId,
    targetType: "privacy_request" as const,
    type: payload.status === "reviewed" ? "review_privacy_request" as const : "resolve_privacy_request" as const,
  }

  await persistAdminAction(event, action)

  if (persistedRequest) {
    await persistUserNotification(event, {
      id: crypto.randomUUID(),
      userId: persistedRequest.userId,
      type: "admin",
      title: payload.status === "reviewed" ? "Privacy request reviewed" : "Privacy request resolved",
      body: payload.status === "reviewed"
        ? "An operator reviewed your privacy request and recorded the next handling note."
        : "An operator marked your privacy request resolved. Review your account settings if you need another follow-up.",
      href: "/app/settings",
      readAt: null,
      createdAt: updatedAt,
    })
  }

  return {
    action,
    request: {
      id: requestId,
      resolvedAt: payload.status === "resolved" ? updatedAt : null,
      reviewedAt: payload.status === "reviewed" ? updatedAt : null,
      status: payload.status,
    },
  }
})
