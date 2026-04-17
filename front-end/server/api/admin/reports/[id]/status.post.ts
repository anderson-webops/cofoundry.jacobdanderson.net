import { requireAdminSession, validateAdminReportStatusPayload } from "../../../../utils/admin"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const payload = validateAdminReportStatusPayload(await readBody(event))
  const reportId = getRouterParam(event, "id")

  if (!reportId)
    throw createError({ statusCode: 400, statusMessage: "A target report id is required." })

  const createdAt = new Date().toISOString()

  return {
    action: {
      id: crypto.randomUUID(),
      adminUserId: session.id,
      createdAt,
      notes: payload.notes,
      targetId: reportId,
      targetType: "report" as const,
      type: payload.status === "reviewed" ? "review_report" as const : "resolve_report" as const,
    },
    report: {
      id: reportId,
      reviewedAt: payload.status === "reviewed" ? createdAt : null,
      resolvedAt: payload.status === "resolved" ? createdAt : null,
    },
  }
})
