import type { H3Event } from "h3"
import type { InvestmentApplication, Notification, Report, SessionUser } from "../../shared/types/domain"
import { randomUUID } from "node:crypto"
import { getReportPriority } from "../../shared/utils/formation"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"
import { listAdminSecurityUsers } from "./admin-persistence"
import { recordLocalInvestmentApplication, recordLocalReportSubmission } from "./local-collaboration-store"
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

export async function createMemberInvestmentApplication(event: H3Event, session: SessionUser, payload: {
  deckLink: string
  opportunityId: string
  raiseAmount: string
  reason: string
  teamSummary: string
  traction: string
}) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const opportunity = workspace.seed.opportunities.find(item => item.id === payload.opportunityId)
  if (!opportunity || opportunity.ownerUserId !== session.id)
    throw createError({ statusCode: 404, statusMessage: "Choose one of your own startup opportunities." })
  if (!opportunity.isOpen)
    throw createError({ statusCode: 409, statusMessage: "Investment applications require an open opportunity." })
  if (workspace.seed.investmentApplications.some(application =>
    application.applicantUserId === session.id
    && application.opportunityId === payload.opportunityId
    && !["declined"].includes(application.status),
  )) {
    throw createError({ statusCode: 409, statusMessage: "An active investment application already exists for this opportunity." })
  }

  const application: InvestmentApplication = {
    id: createId("investment_application"),
    opportunityId: payload.opportunityId,
    applicantUserId: session.id,
    status: "submitted",
    raiseAmount: payload.raiseAmount,
    traction: payload.traction,
    deckLink: payload.deckLink,
    teamSummary: payload.teamSummary,
    reason: payload.reason,
    createdAt: new Date().toISOString(),
  }

  if (!isSupabaseEnabled(event)) {
    await recordLocalInvestmentApplication(application)
  }
  else {
    const adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const { error } = await adminClient.rpc("cofoundry_submit_investment_application", {
      p_applicant_user_id: application.applicantUserId,
      p_created_at: application.createdAt,
      p_deck_link: application.deckLink,
      p_id: application.id,
      p_opportunity_id: application.opportunityId,
      p_raise_amount: application.raiseAmount,
      p_reason: application.reason,
      p_team_summary: application.teamSummary,
      p_traction: application.traction,
    })
    if (error) {
      const duplicate = error.message.includes("active investment application")
      const closed = error.message.includes("open opportunity")
      const ownership = error.message.includes("own startup opportunities")
      throw createError({
        statusCode: duplicate || closed ? 409 : ownership ? 404 : 400,
        statusMessage: duplicate
          ? "An active investment application already exists for this opportunity."
          : closed
            ? "Investment applications require an open opportunity."
            : ownership
              ? "Choose one of your own startup opportunities."
              : "The investment application could not be submitted.",
      })
    }
  }

  return {
    application,
    ...await reloadProjectedWorkspace(event, session),
  }
}
