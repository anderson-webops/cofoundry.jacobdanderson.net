import type {
  AccessRequest,
  AdminAction,
  AdminActionType,
  AppRole,
  PrivacyRequest,
  Profile,
  Report,
  ReportPriority,
  ReportStatus,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  WorkspaceSeed,
} from "../types/domain"
import { getProfileByUserId, getSubscriptionByUserId, getUserById } from "./workspace"

export interface AdminUserRow {
  user: User
  profile?: Profile
  subscription?: Subscription
  openReportsCount: number
  highPriorityReportsCount: number
  lastAdminAction?: AdminAction
  lastActiveAt: string | null
}

export interface AdminUserFilters {
  query: string
  role: AppRole | "all"
  status: "all" | "active" | "suspended"
  onboarding: "all" | "complete" | "incomplete"
}

export interface AdminReportRow {
  report: Report
  reporter?: User
  reporterProfile?: Profile
  targetLabel: string
  targetContext: string
  latestAdminAction?: AdminAction
}

export interface AdminReportFilters {
  query: string
  status: ReportStatus | "all"
  priority: ReportPriority | "all"
  targetType: Report["targetType"] | "all"
}

export interface AdminAuditEntry {
  action: AdminAction
  admin?: User
  adminProfile?: Profile
  targetLabel: string
  targetContext: string
}

export interface AdminAuditFilters {
  query: string
  actionType: AdminActionType | "all"
  actorId: string | "all"
  targetType: AdminAction["targetType"] | "all"
}

export interface AdminBillingRow {
  user: User
  profile?: Profile
  subscription?: Subscription
}

export interface AdminBillingFilters {
  query: string
  plan: SubscriptionPlan | "all"
  status: SubscriptionStatus | "all"
}

export type AdminCommandQueueKind = "moderation" | "access" | "privacy" | "readiness"
export type AdminCommandQueuePriority = "critical" | "high" | "standard"
export type AdminCommandReadinessStatus = "pass" | "warn" | "fail" | "info"

export interface AdminCommandReadinessCheck {
  action: string
  detail: string
  groupTitle?: string
  id: string
  status: AdminCommandReadinessStatus
  summary: string
  title: string
}

export interface AdminCommandQueueInput {
  accessRequests?: AccessRequest[]
  generatedAt?: string
  privacyRequests?: PrivacyRequest[]
  readinessChecks?: AdminCommandReadinessCheck[]
  seed: WorkspaceSeed
}

export interface AdminCommandQueueItem {
  actionLabel: string
  createdAt: string | null
  detail: string
  href: string
  id: string
  kind: AdminCommandQueueKind
  priority: AdminCommandQueuePriority
  sourceLabel: string
  statusLabel: string
  summary: string
  title: string
}

const dayMs = 24 * 60 * 60 * 1000
const priorityRank: Record<AdminCommandQueuePriority, number> = {
  critical: 0,
  high: 1,
  standard: 2,
}

function includesQuery(values: Array<string | undefined | null>, query: string) {
  if (!query)
    return true

  const normalizedQuery = query.trim().toLowerCase()
  return values.some(value => value?.toLowerCase().includes(normalizedQuery))
}

function getLatestAdminAction(seed: WorkspaceSeed, targetType: AdminAction["targetType"], targetId: string) {
  return seed.adminActions
    .filter(action => action.targetType === targetType && action.targetId === targetId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .at(0)
}

function toTime(value?: string | null) {
  if (!value)
    return null

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function daysBetween(start: string | null, end: string | null) {
  const startTime = toTime(start)
  const endTime = toTime(end)
  if (startTime === null || endTime === null)
    return null

  return Math.max(0, Math.floor((endTime - startTime) / dayMs))
}

function formatMachineLabel(value: string) {
  return value.replaceAll("_", " ")
}

function formatAccessStatus(status: AccessRequest["status"]) {
  return {
    approved: "Approved",
    denied: "Denied",
    invited: "Invited",
    open: "Open",
  }[status]
}

function formatPrivacyStatus(status: PrivacyRequest["status"]) {
  return {
    open: "Open",
    reviewed: "Reviewed",
    resolved: "Resolved",
  }[status]
}

function readinessHref(checkId: string) {
  if (checkId.includes("access-request"))
    return "/admin/access-requests"

  if (checkId.includes("privacy-request"))
    return "/admin/privacy"

  if (["backup", "file-scanning", "notification", "operational-events"].some(value => checkId.includes(value)))
    return "/admin/operations"

  return "/admin/readiness"
}

function resolveReportTarget(seed: WorkspaceSeed, report: Report) {
  if (report.targetType === "profile") {
    const profile = seed.profiles.find(item => item.id === report.targetId)
    return {
      targetLabel: profile?.displayName || "Profile not found",
      targetContext: profile?.headline || report.targetId,
    }
  }

  if (report.targetType === "message") {
    const message = seed.messages.find(item => item.id === report.targetId)
    return {
      targetLabel: message ? "Conversation message" : "Message not found",
      targetContext: message?.body || report.targetId,
    }
  }

  const opportunity = seed.opportunities.find(item => item.id === report.targetId)
  return {
    targetLabel: opportunity?.startupName || "Opportunity not found",
    targetContext: opportunity?.oneLinePitch || report.targetId,
  }
}

function resolveAdminTarget(seed: WorkspaceSeed, action: AdminAction) {
  if (action.targetType === "user") {
    const user = getUserById(seed, action.targetId)
    const profile = getProfileByUserId(seed, action.targetId)
    return {
      targetLabel: profile?.displayName || user?.email || "User not found",
      targetContext: user?.email || action.targetId,
    }
  }

  if (action.targetType === "report") {
    const report = seed.reports.find(item => item.id === action.targetId)
    if (!report) {
      return {
        targetLabel: "Report not found",
        targetContext: action.targetId,
      }
    }

    return resolveReportTarget(seed, report)
  }

  if (action.targetType === "privacy_request") {
    return {
      targetLabel: "Privacy request",
      targetContext: action.targetId,
    }
  }

  return {
    targetLabel: action.targetType,
    targetContext: action.targetId,
  }
}

export function buildAdminUserRows(seed: WorkspaceSeed): AdminUserRow[] {
  return seed.users
    .map((user) => {
      const profile = getProfileByUserId(seed, user.id)
      const subscription = getSubscriptionByUserId(seed, user.id)
      const reports = seed.reports.filter((report) => {
        if (report.targetType === "profile")
          return report.targetId === profile?.id

        return false
      })

      return {
        user,
        profile,
        subscription,
        openReportsCount: reports.filter(report => report.status !== "resolved").length,
        highPriorityReportsCount: reports.filter(report => report.priority === "high" && report.status !== "resolved").length,
        lastAdminAction: getLatestAdminAction(seed, "user", user.id),
        lastActiveAt: profile?.trustSignals.lastActiveAt || null,
      }
    })
    .sort((left, right) => {
      if (Number(Boolean(right.user.suspendedAt)) !== Number(Boolean(left.user.suspendedAt)))
        return Number(Boolean(right.user.suspendedAt)) - Number(Boolean(left.user.suspendedAt))

      if (right.openReportsCount !== left.openReportsCount)
        return right.openReportsCount - left.openReportsCount

      return new Date(right.user.createdAt).getTime() - new Date(left.user.createdAt).getTime()
    })
}

export function filterAdminUserRows(rows: AdminUserRow[], filters: AdminUserFilters) {
  return rows.filter((row) => {
    if (filters.role !== "all" && row.user.role !== filters.role)
      return false

    if (filters.status === "active" && row.user.suspendedAt)
      return false

    if (filters.status === "suspended" && !row.user.suspendedAt)
      return false

    if (filters.onboarding === "complete" && !row.user.onboardingCompleted)
      return false

    if (filters.onboarding === "incomplete" && row.user.onboardingCompleted)
      return false

    return includesQuery([
      row.profile?.displayName,
      row.user.email,
      row.profile?.headline,
      row.profile?.location,
      row.subscription?.plan,
    ], filters.query)
  })
}

export function buildAdminReportRows(seed: WorkspaceSeed): AdminReportRow[] {
  return seed.reports
    .map((report) => {
      const reporter = getUserById(seed, report.reporterUserId)
      const reporterProfile = getProfileByUserId(seed, report.reporterUserId)
      const target = resolveReportTarget(seed, report)

      return {
        report,
        reporter,
        reporterProfile,
        targetLabel: target.targetLabel,
        targetContext: target.targetContext,
        latestAdminAction: getLatestAdminAction(seed, "report", report.id),
      }
    })
    .sort((left, right) => new Date(right.report.createdAt).getTime() - new Date(left.report.createdAt).getTime())
}

export function filterAdminReportRows(rows: AdminReportRow[], filters: AdminReportFilters) {
  return rows.filter((row) => {
    if (filters.status !== "all" && row.report.status !== filters.status)
      return false

    if (filters.priority !== "all" && row.report.priority !== filters.priority)
      return false

    if (filters.targetType !== "all" && row.report.targetType !== filters.targetType)
      return false

    return includesQuery([
      row.report.details,
      row.targetLabel,
      row.targetContext,
      row.reporter?.email,
      row.reporterProfile?.displayName,
    ], filters.query)
  })
}

export function buildAdminAuditEntries(seed: WorkspaceSeed): AdminAuditEntry[] {
  return seed.adminActions
    .map((action) => {
      const admin = getUserById(seed, action.adminUserId)
      const adminProfile = getProfileByUserId(seed, action.adminUserId)
      const target = resolveAdminTarget(seed, action)

      return {
        action,
        admin,
        adminProfile,
        targetLabel: target.targetLabel,
        targetContext: target.targetContext,
      }
    })
    .sort((left, right) => new Date(right.action.createdAt).getTime() - new Date(left.action.createdAt).getTime())
}

export function filterAdminAuditEntries(entries: AdminAuditEntry[], filters: AdminAuditFilters) {
  return entries.filter((entry) => {
    if (filters.actionType !== "all" && entry.action.type !== filters.actionType)
      return false

    if (filters.actorId !== "all" && entry.action.adminUserId !== filters.actorId)
      return false

    if (filters.targetType !== "all" && entry.action.targetType !== filters.targetType)
      return false

    return includesQuery([
      entry.admin?.email,
      entry.adminProfile?.displayName,
      entry.targetLabel,
      entry.targetContext,
      entry.action.notes,
    ], filters.query)
  })
}

export function buildAdminBillingRows(seed: WorkspaceSeed): AdminBillingRow[] {
  return seed.users
    .map((user) => {
      return {
        user,
        profile: getProfileByUserId(seed, user.id),
        subscription: getSubscriptionByUserId(seed, user.id),
      }
    })
    .sort((left, right) => {
      const leftPaid = left.subscription?.plan === "free" ? 0 : 1
      const rightPaid = right.subscription?.plan === "free" ? 0 : 1

      if (rightPaid !== leftPaid)
        return rightPaid - leftPaid

      return new Date(right.user.createdAt).getTime() - new Date(left.user.createdAt).getTime()
    })
}

export function filterAdminBillingRows(rows: AdminBillingRow[], filters: AdminBillingFilters) {
  return rows.filter((row) => {
    const subscription = row.subscription

    if (filters.plan !== "all" && subscription?.plan !== filters.plan)
      return false

    if (filters.status !== "all" && subscription?.status !== filters.status)
      return false

    return includesQuery([
      row.profile?.displayName,
      row.user.email,
      subscription?.plan,
      subscription?.status,
      subscription?.stripeCustomerId,
      subscription?.stripeSubscriptionId,
    ], filters.query)
  })
}

export function buildAdminQueueSummary(seed: WorkspaceSeed) {
  const openReports = seed.reports.filter(report => report.status === "open")
  const reviewedReports = seed.reports.filter(report => report.status === "reviewed")
  const suspendedUsers = seed.users.filter(user => Boolean(user.suspendedAt))
  const recentActions = seed.adminActions.filter((action) => {
    return Date.now() - new Date(action.createdAt).getTime() <= 1000 * 60 * 60 * 24 * 7
  })

  return {
    openReports: openReports.length,
    highPriorityReports: openReports.filter(report => report.priority === "high").length,
    reviewedReports: reviewedReports.length,
    suspendedUsers: suspendedUsers.length,
    actionsLast7Days: recentActions.length,
  }
}

export function sortAdminCommandQueueItems(items: AdminCommandQueueItem[]) {
  return [...items].sort((left, right) => {
    const priorityDiff = priorityRank[left.priority] - priorityRank[right.priority]
    if (priorityDiff !== 0)
      return priorityDiff

    const rightTime = toTime(right.createdAt) || 0
    const leftTime = toTime(left.createdAt) || 0
    if (rightTime !== leftTime)
      return rightTime - leftTime

    return left.title.localeCompare(right.title)
  })
}

export function buildAdminCommandQueue(input: AdminCommandQueueInput) {
  const generatedAt = input.generatedAt || new Date().toISOString()
  const reportItems: AdminCommandQueueItem[] = buildAdminReportRows(input.seed)
    .filter(row => row.report.status !== "resolved")
    .map((row) => {
      const isOpen = row.report.status === "open"
      const priority: AdminCommandQueuePriority = row.report.priority === "high" && isOpen
        ? "critical"
        : row.report.priority === "high" || isOpen
          ? "high"
          : "standard"

      return {
        actionLabel: "Review report",
        createdAt: row.report.createdAt,
        detail: row.report.details,
        href: "/admin/reports",
        id: `report:${row.report.id}`,
        kind: "moderation",
        priority,
        sourceLabel: row.reporterProfile?.displayName || row.reporter?.email || row.report.reporterUserId,
        statusLabel: `${row.report.priority} priority · ${row.report.status}`,
        summary: `${formatMachineLabel(row.report.reason)} on ${row.targetLabel}`,
        title: "Moderation report",
      }
    })

  const accessItems: AdminCommandQueueItem[] = (input.accessRequests || [])
    .filter((request) => {
      if (request.status === "open" || request.status === "approved")
        return true

      return request.status === "invited" && !request.inviteAcceptedAt && Boolean(toTime(request.inviteExpiresAt) && toTime(request.inviteExpiresAt)! < toTime(generatedAt)!)
    })
    .map((request) => {
      const ageDays = daysBetween(request.createdAt, generatedAt)
      const inviteExpired = request.status === "invited" && !request.inviteAcceptedAt && Boolean(toTime(request.inviteExpiresAt) && toTime(request.inviteExpiresAt)! < toTime(generatedAt)!)
      const stale = request.status === "open" && ageDays !== null && ageDays > 7
      const priority: AdminCommandQueuePriority = inviteExpired || stale || request.status === "approved" ? "high" : "standard"

      return {
        actionLabel: request.status === "approved" ? "Issue invite" : "Review access",
        createdAt: request.createdAt,
        detail: request.useCase,
        href: "/admin/access-requests",
        id: `access:${request.id}`,
        kind: "access",
        priority,
        sourceLabel: request.company || request.email,
        statusLabel: inviteExpired ? "Invite expired" : formatAccessStatus(request.status),
        summary: `${request.name} · ${formatMachineLabel(request.role)} · ${formatMachineLabel(request.timeline)}`,
        title: request.status === "approved" ? "Approved access request needs invite" : "Access request",
      }
    })

  const privacyItems: AdminCommandQueueItem[] = (input.privacyRequests || [])
    .filter(request => request.status !== "resolved")
    .map((request) => {
      const ageDays = daysBetween(request.createdAt, generatedAt)
      const priority: AdminCommandQueuePriority = ageDays !== null && ageDays > 3 ? "high" : "standard"

      return {
        actionLabel: "Review privacy request",
        createdAt: request.createdAt,
        detail: request.details,
        href: "/admin/privacy",
        id: `privacy:${request.id}`,
        kind: "privacy",
        priority,
        sourceLabel: request.userId,
        statusLabel: formatPrivacyStatus(request.status),
        summary: formatMachineLabel(request.type),
        title: "Privacy or trust review request",
      }
    })

  const readinessItems: AdminCommandQueueItem[] = (input.readinessChecks || [])
    .filter(check => check.status === "fail" || check.status === "warn")
    .map((check) => {
      return {
        actionLabel: "Open surface",
        createdAt: generatedAt,
        detail: check.action,
        href: readinessHref(check.id),
        id: `readiness:${check.id}`,
        kind: "readiness",
        priority: check.status === "fail" ? "critical" : "high",
        sourceLabel: check.groupTitle || "Readiness",
        statusLabel: check.status === "fail" ? "Failing check" : "Warning check",
        summary: check.summary,
        title: check.title,
      }
    })

  return sortAdminCommandQueueItems([...reportItems, ...accessItems, ...privacyItems, ...readinessItems])
}
