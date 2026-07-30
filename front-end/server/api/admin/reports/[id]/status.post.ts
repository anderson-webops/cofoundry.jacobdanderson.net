import { requireAdminSession, validateAdminReportStatusPayload } from "../../../../utils/admin"
import { persistAdminReportStatusAction } from "../../../../utils/admin-persistence"
import { emitLifecycleNotificationEvent } from "../../../../utils/lifecycle-notification-events"
import { loadMemberWorkspaceState } from "../../../../utils/member-workspace"
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

  const report = await persistAdminReportStatusAction(event, {
    action,
    expectedStatus: payload.expectedStatus,
    status: payload.status,
  })
  if (report?.reporterUserId) {
    try {
      const workspace = await loadMemberWorkspaceState(event, {
        id: session.id,
        email: session.email,
        name: session.name,
        onboardingCompleted: session.onboardingCompleted,
        role: session.role,
        subscriptionPlan: session.subscriptionPlan,
      })

      await emitLifecycleNotificationEvent(event, workspace.seed, {
        eventType: "report.reviewed",
        metadata: {
          action: action.type,
          adminUserId: session.id,
          status: payload.status,
        },
        targetId: reportId,
        targetType: "report",
        userId: report.reporterUserId,
      }, {
        source: "admin.reports",
      })
    }
    catch (error) {
      console.warn("[reports] Report status persisted, but lifecycle notification delivery failed.", error)
    }
  }

  return {
    action,
    report: {
      id: reportId,
      reviewedAt: payload.status === "reviewed" ? createdAt : null,
      resolvedAt: payload.status === "resolved" ? createdAt : null,
    },
  }
})
