import type { H3Event } from "h3"
import type { Notification, Report, SessionUser } from "../../shared/types/domain"
import { randomUUID } from "node:crypto"
import { getReportPriority } from "../../shared/utils/formation"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"
import { listAdminSecurityUsers } from "./admin-persistence"
import { recordLocalReportSubmission } from "./local-collaboration-store"
import { loadMemberWorkspaceState } from "./member-workspace"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

function buildIdentity(session: SessionUser) {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
}

async function reloadProjectedWorkspace(event: H3Event, session: SessionUser) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  return {
    data: projectWorkspaceForSession(workspace.seed, workspace.session),
    session: workspace.session,
  }
}

export async function createMemberReport(event: H3Event, session: SessionUser, payload: {
  details: string
  reason: Report["reason"]
  targetId: string
  targetType: Report["targetType"]
}) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const visible = projectWorkspaceForSession(workspace.seed, workspace.session)

  if (payload.targetType === "profile") {
    const profile = visible.profiles.find(item => item.id === payload.targetId)
    if (!profile)
      throw createError({ statusCode: 404, statusMessage: "The reported profile is not available." })
    if (profile.userId === session.id)
      throw createError({ statusCode: 400, statusMessage: "You cannot report your own profile." })
  }
  else if (payload.targetType === "message") {
    const message = visible.messages.find(item => item.id === payload.targetId)
    if (!message)
      throw createError({ statusCode: 404, statusMessage: "The reported message is not available." })
    if (!message.senderUserId || message.senderUserId === session.id)
      throw createError({ statusCode: 400, statusMessage: "Only messages from another member can be reported." })
  }
  else {
    const opportunity = visible.opportunities.find(item => item.id === payload.targetId)
    if (!opportunity)
      throw createError({ statusCode: 404, statusMessage: "The reported opportunity is not available." })
    if (opportunity.ownerUserId === session.id)
      throw createError({ statusCode: 400, statusMessage: "You cannot report your own opportunity." })
  }

  const createdAt = new Date().toISOString()
  const report: Report = {
    id: createId("report"),
    reporterUserId: session.id,
    targetType: payload.targetType,
    targetId: payload.targetId,
    reason: payload.reason,
    priority: getReportPriority(payload.reason),
    details: payload.details,
    status: "open",
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedByUserId: null,
    createdAt,
  }
  const admins = (await listAdminSecurityUsers(event))
    .filter(user => user.role === "admin" && !user.suspendedAt && user.verifiedEmail)
  const notifications: Notification[] = admins.map(admin => ({
    id: createId("notification"),
    userId: admin.id,
    type: "admin",
    title: report.priority === "high" ? "High-priority safety report" : "New moderation report",
    body: report.details,
    href: "/admin/reports",
    readAt: null,
    createdAt,
  }))

  if (!isSupabaseEnabled(event)) {
    await recordLocalReportSubmission(report, notifications)
  }
  else {
    const adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const { error } = await adminClient.from("reports").insert({
      id: report.id,
      reporter_user_id: report.reporterUserId,
      target_type: report.targetType,
      target_id: report.targetId,
      reason: report.reason,
      priority: report.priority,
      details: report.details,
      status: report.status,
      review_notes: null,
      reviewed_at: null,
      reviewed_by_user_id: null,
      resolution_notes: null,
      resolved_at: null,
      resolved_by_user_id: null,
      created_at: report.createdAt,
    })
    if (error)
      throw error

    if (notifications.length) {
      const { error: notificationError } = await adminClient.from("notifications").insert(notifications.map(notification => ({
        id: notification.id,
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        read_at: notification.readAt,
        created_at: notification.createdAt,
      })))
      if (notificationError)
        console.warn("[reports] Report persisted, but admin notification delivery failed.", notificationError)
    }
  }

  return {
    ...await reloadProjectedWorkspace(event, session),
    report,
  }
}
