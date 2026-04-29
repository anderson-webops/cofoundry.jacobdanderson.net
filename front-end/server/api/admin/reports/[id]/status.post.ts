import { requireAdminSession, validateAdminReportStatusPayload } from "../../../../utils/admin"
import { persistAdminAction, persistReportStatus } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:report-status",
    windowMs: 60 * 1000,
  })
  const payload = validateAdminReportStatusPayload(await readBody(event))
  const reportId = getRouterParam(event, "id")

  if (!reportId)
    throw createError({ statusCode: 400, statusMessage: "A target report id is required." })

  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    notes: payload.notes,
    targetId: reportId,
    targetType: "report" as const,
    type: payload.status === "reviewed" ? "review_report" as const : "resolve_report" as const,
  }

  await persistReportStatus(event, {
    adminUserId: session.id,
    notes: payload.notes,
    reportId,
    status: payload.status,
    timestamp: createdAt,
  })
  await persistAdminAction(event, action)

  return {
    action,
    report: {
      id: reportId,
      reviewedAt: payload.status === "reviewed" ? createdAt : null,
      resolvedAt: payload.status === "resolved" ? createdAt : null,
    },
  }
})
