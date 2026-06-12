import type { AccessRequest, PrivacyRequest } from "~/shared/types/domain"
import type { EnvironmentSnapshot } from "~/shared/utils/environment"

export type ProductionReadinessStatus = "pass" | "warn" | "fail" | "info"

export interface ProductionReadinessCheck {
  action: string
  detail: string
  id: string
  status: ProductionReadinessStatus
  summary: string
  title: string
}

export interface ProductionReadinessGroup {
  checks: ProductionReadinessCheck[]
  description: string
  id: string
  title: string
}

export interface ProductionReadinessOperationsRows {
  backupRuns: Array<Record<string, unknown>>
  fileUploads: Array<Record<string, unknown>>
  mode: string
  notificationDeliveries: Array<Record<string, unknown>>
  operationalEvents: Array<Record<string, unknown>>
}

export interface ProductionReadinessInput {
  accessRequests: AccessRequest[]
  contactMailConfigured: boolean
  environment: EnvironmentSnapshot
  environmentValidationErrors: string[]
  generatedAt: string
  hasDurableLocalDataDir: boolean
  hasOperationsWorkerToken: boolean
  hasSessionSigningSecret: boolean
  isLocalDevelopment: boolean
  operations: ProductionReadinessOperationsRows
  privacyRequests: PrivacyRequest[]
}

export interface ProductionReadinessPayload {
  counts: {
    accessRequestsOpen: number
    failedChecks: number
    operationsRows: number
    privacyRequestsOpen: number
    warningChecks: number
  }
  generatedAt: string
  groups: ProductionReadinessGroup[]
  mode: {
    backend: string
    billing: string
    operations: string
  }
  overallStatus: Exclude<ProductionReadinessStatus, "info">
  score: number
  summary: string
}

const dayMs = 24 * 60 * 60 * 1000
const statusWeight: Record<ProductionReadinessStatus, number> = {
  fail: 0,
  info: 1,
  pass: 1,
  warn: 0.5,
}

function check(
  id: string,
  title: string,
  status: ProductionReadinessStatus,
  summary: string,
  detail: string,
  action: string,
): ProductionReadinessCheck {
  return { action, detail, id, status, summary, title }
}

function toTime(value: unknown) {
  if (typeof value !== "string")
    return null

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function newestTime(rows: Array<Record<string, unknown>>, fields: string[]) {
  return rows.reduce<number | null>((latest, row) => {
    const rowTime = fields.reduce<number | null>((result, field) => result ?? toTime(row[field]), null)
    if (rowTime === null)
      return latest

    return latest === null || rowTime > latest ? rowTime : latest
  }, null)
}

function daysSince(time: number | null, nowTime: number) {
  if (time === null)
    return null

  return Math.max(0, Math.floor((nowTime - time) / dayMs))
}

function countRows(rows: Array<Record<string, unknown>>, field: string, values: string[]) {
  const allowed = new Set(values)
  return rows.filter(row => allowed.has(String(row[field] || ""))).length
}

function latestRow(rows: Array<Record<string, unknown>>, fields: string[]) {
  return [...rows].sort((left, right) => {
    const rightTime = newestTime([right], fields) || 0
    const leftTime = newestTime([left], fields) || 0
    return rightTime - leftTime
  }).at(0)
}

function isLocalhostUrl(value: string) {
  try {
    const url = new URL(value)
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  }
  catch {
    return false
  }
}

function openAccessQueueState(accessRequests: AccessRequest[], nowTime: number) {
  const open = accessRequests.filter(request => request.status === "open")
  const stale = open.filter((request) => {
    const createdAt = toTime(request.createdAt)
    return createdAt !== null && nowTime - createdAt > 7 * dayMs
  })
  const expiredInvites = accessRequests.filter((request) => {
    if (request.status !== "invited" || request.inviteAcceptedAt)
      return false

    const expiresAt = toTime(request.inviteExpiresAt)
    return expiresAt !== null && expiresAt < nowTime
  })

  return { expiredInvites, open, stale }
}

function openPrivacyQueueState(privacyRequests: PrivacyRequest[], nowTime: number) {
  const open = privacyRequests.filter(request => request.status !== "resolved")
  const stale = open.filter((request) => {
    const createdAt = toTime(request.createdAt)
    return createdAt !== null && nowTime - createdAt > 3 * dayMs
  })

  return { open, stale }
}

function getOverallStatus(checks: ProductionReadinessCheck[]): Exclude<ProductionReadinessStatus, "info"> {
  if (checks.some(item => item.status === "fail"))
    return "fail"

  if (checks.some(item => item.status === "warn"))
    return "warn"

  return "pass"
}

function scoreChecks(checks: ProductionReadinessCheck[]) {
  const scoredChecks = checks.filter(item => item.status !== "info")
  if (!scoredChecks.length)
    return 100

  const score = scoredChecks.reduce((total, item) => total + statusWeight[item.status], 0) / scoredChecks.length
  return Math.round(score * 100)
}

function summarize(overallStatus: Exclude<ProductionReadinessStatus, "info">, failedChecks: number, warningChecks: number) {
  if (overallStatus === "fail")
    return `${failedChecks} launch-critical item${failedChecks === 1 ? " needs" : "s need"} resolution before treating this deployment as production-ready.`

  if (overallStatus === "warn")
    return `${warningChecks} operational item${warningChecks === 1 ? " should" : "s should"} be tightened, but no hard readiness failures are currently detected.`

  return "No launch-critical readiness failures or warnings are currently detected."
}

export function buildProductionReadinessSnapshot(input: ProductionReadinessInput): ProductionReadinessPayload {
  const nowTime = new Date(input.generatedAt).getTime()
  const { public: publicEnvironment } = input.environment
  const accessQueue = openAccessQueueState(input.accessRequests, nowTime)
  const privacyQueue = openPrivacyQueueState(input.privacyRequests, nowTime)
  const latestBackup = latestRow(input.operations.backupRuns, ["started_at", "created_at"])
  const latestBackupTime = newestTime(input.operations.backupRuns, ["completed_at", "started_at", "created_at"])
  const backupDaysOld = daysSince(latestBackupTime, nowTime)
  const latestNotificationDeliveryTime = newestTime(input.operations.notificationDeliveries, ["created_at", "delivered_at"])
  const notificationDaysOld = daysSince(latestNotificationDeliveryTime, nowTime)
  const failedOrFlaggedScans = countRows(input.operations.fileUploads, "scan_status", ["failed", "flagged"])
  const pendingScans = countRows(input.operations.fileUploads, "scan_status", ["pending"])
  const errorEvents = countRows(input.operations.operationalEvents, "severity", ["error"])
  const warningEvents = countRows(input.operations.operationalEvents, "severity", ["warning"])

  const deploymentChecks = [
    check(
      "environment-validation",
      "Environment contract",
      input.environmentValidationErrors.length ? "fail" : "pass",
      input.environmentValidationErrors.length
        ? `${input.environmentValidationErrors.length} required environment value${input.environmentValidationErrors.length === 1 ? "" : "s"} missing or invalid.`
        : "Configured public and server-only environment values satisfy the current mode contract.",
      input.environmentValidationErrors.join(" ") || "The current backend and billing modes can start without missing required secrets.",
      "Resolve each listed environment error before switching this deployment into a live mode.",
    ),
    check(
      "launch-mode",
      "Launch mode",
      !input.isLocalDevelopment && publicEnvironment.enableDemoAccess
        ? "warn"
        : "pass",
      `${publicEnvironment.backendMode} backend / ${publicEnvironment.billingMode} billing`,
      publicEnvironment.backendMode === "mock" && publicEnvironment.billingMode === "mock"
        ? "The public deployment remains in the intended marketing/access-request shell unless demo access is deliberately enabled."
        : "At least one live service mode is enabled; the environment contract check must remain green.",
      "Keep Supabase and Stripe disabled until their provisioning, migrations, worker jobs, and rollback paths are verified.",
    ),
    check(
      "public-app-url",
      "Public app URL",
      input.isLocalDevelopment
        ? "info"
        : !publicEnvironment.appUrl || isLocalhostUrl(publicEnvironment.appUrl)
            ? "fail"
            : "pass",
      publicEnvironment.appUrl || "No public URL configured",
      input.isLocalDevelopment
        ? "Local development may use localhost defaults."
        : "Production emails, invite links, canonical URLs, and operator handoffs need a stable public origin.",
      "Set NUXT_PUBLIC_APP_URL to the deployed HTTPS origin.",
    ),
  ]

  const securityChecks = [
    check(
      "session-signing-secret",
      "Session signing secret",
      input.hasSessionSigningSecret ? "pass" : input.isLocalDevelopment ? "info" : "fail",
      input.hasSessionSigningSecret ? "Configured" : "Missing",
      input.hasSessionSigningSecret
        ? "Session cookies can be signed with a deployment-specific secret."
        : "Hosted sign-in, admin access, and invite-created local accounts cannot safely create sessions without this secret.",
      "Inject SESSION_SIGNING_SECRET from the server secret store.",
    ),
    check(
      "operations-worker-token",
      "Operations worker token",
      input.hasOperationsWorkerToken ? "pass" : "warn",
      input.hasOperationsWorkerToken ? "Configured" : "Missing",
      input.hasOperationsWorkerToken
        ? "Worker endpoints can authenticate backup, scanner, digest, and event reports."
        : "Worker endpoints fail closed, but scheduled operations cannot report status until this is configured.",
      "Inject COFOUNDRY_OPERATIONS_TOKEN and configure the server-side workers to use it.",
    ),
    check(
      "mail-transport",
      "Contact and digest email",
      input.contactMailConfigured ? "pass" : "warn",
      input.contactMailConfigured ? "Configured" : "Not configured",
      input.contactMailConfigured
        ? "Contact form and notification digest delivery have a configured mail transport."
        : "Contact submissions and digests can be recorded, but users and operators will not receive outbound email.",
      "Configure SMTP or sendmail CONTACT_* environment values.",
    ),
    check(
      "local-durable-store",
      "Mock-mode durable store",
      publicEnvironment.backendMode === "supabase"
        ? "info"
        : input.hasDurableLocalDataDir
          ? "pass"
          : "warn",
      input.hasDurableLocalDataDir ? "External data directory configured" : "Using default local .data path",
      publicEnvironment.backendMode === "supabase"
        ? "Supabase mode should persist operational queues in the database."
        : "Mock/access-request mode stores access requests, invites, privacy requests, accounts, and telemetry on the server filesystem.",
      "Set COFOUNDRY_LOCAL_DATA_DIR to a durable, backed-up host path before relying on mock/access-request mode in production.",
    ),
  ]

  const queueChecks = [
    check(
      "access-request-queue",
      "Access request queue",
      accessQueue.stale.length || accessQueue.expiredInvites.length || accessQueue.open.length > 10 ? "warn" : "pass",
      `${accessQueue.open.length} open, ${accessQueue.expiredInvites.length} expired invite${accessQueue.expiredInvites.length === 1 ? "" : "s"}`,
      accessQueue.stale.length
        ? `${accessQueue.stale.length} open access request${accessQueue.stale.length === 1 ? "" : "s"} are older than 7 days.`
        : "The access queue has no stale open requests by the current threshold.",
      "Review `/admin/access-requests`, resolve stale requests, and reissue or close expired invites.",
    ),
    check(
      "privacy-request-queue",
      "Privacy and trust review queue",
      privacyQueue.stale.length || privacyQueue.open.length > 10 ? "warn" : "pass",
      `${privacyQueue.open.length} unresolved request${privacyQueue.open.length === 1 ? "" : "s"}`,
      privacyQueue.stale.length
        ? `${privacyQueue.stale.length} privacy or trust-review request${privacyQueue.stale.length === 1 ? "" : "s"} are older than 3 days.`
        : "The privacy and trust-review queue has no stale unresolved requests by the current threshold.",
      "Review `/admin/privacy` and add operator notes for each reviewed or resolved request.",
    ),
  ]

  const workerChecks = [
    check(
      "backup-recency",
      "Backup recency",
      !input.operations.backupRuns.length
        ? "warn"
        : latestBackup?.status === "failed"
          ? "fail"
          : backupDaysOld !== null && backupDaysOld > 2
            ? "warn"
            : "pass",
      input.operations.backupRuns.length
        ? `${String(latestBackup?.status || "recorded")} backup${backupDaysOld === null ? "" : `, ${backupDaysOld} day${backupDaysOld === 1 ? "" : "s"} old`}`
        : "No backup rows reported",
      "Public operation needs evidence that database/local-store backups are running and restorable.",
      "Configure the backup worker to report `/api/operations/backup-runs` after each run and schedule restore drills.",
    ),
    check(
      "file-scanning",
      "File scanning",
      failedOrFlaggedScans ? "fail" : pendingScans ? "warn" : "pass",
      `${pendingScans} pending, ${failedOrFlaggedScans} failed or flagged`,
      failedOrFlaggedScans
        ? "At least one uploaded file has a failed or flagged scanner result."
        : pendingScans
          ? "One or more uploaded files are waiting for scanner confirmation."
          : "No uploaded files are currently waiting on scanner action.",
      "Run the scanner worker, report results through `/api/operations/file-scans/:id`, and review flagged files.",
    ),
    check(
      "notification-digests",
      "Notification digest worker",
      !input.operations.notificationDeliveries.length
        ? "warn"
        : notificationDaysOld !== null && notificationDaysOld > 1
          ? "warn"
          : "pass",
      input.operations.notificationDeliveries.length
        ? `Last digest record${notificationDaysOld === null ? "" : ` ${notificationDaysOld} day${notificationDaysOld === 1 ? "" : "s"} old`}`
        : "No digest delivery rows reported",
      "Digest rows prove that the scheduled notification path is running, even when mock mode records a skipped delivery.",
      "Schedule `/api/operations/notification-digests/run` and confirm recent rows appear in `/admin/operations`.",
    ),
    check(
      "operational-events",
      "Operational events",
      errorEvents ? "fail" : warningEvents ? "warn" : "pass",
      `${errorEvents} error, ${warningEvents} warning`,
      errorEvents
        ? "Recent operational events include errors that should be reviewed before launch."
        : warningEvents
          ? "Recent operational events include warnings that need operator review."
          : "No warning or error operational events are currently in the reviewed telemetry window.",
      "Review `/admin/operations`, fix the underlying worker or service issue, and add a follow-up event after resolution.",
    ),
  ]

  const groups: ProductionReadinessGroup[] = [
    {
      checks: deploymentChecks,
      description: "Mode, environment, and public-origin checks that affect whether the deployment starts and links correctly.",
      id: "deployment",
      title: "Deployment posture",
    },
    {
      checks: securityChecks,
      description: "Secrets, mail, and local persistence expectations that keep the production-facing shell safe.",
      id: "security",
      title: "Secrets and persistence",
    },
    {
      checks: queueChecks,
      description: "Operator queues that directly affect user trust, access, and compliance response quality.",
      id: "queues",
      title: "Operator queues",
    },
    {
      checks: workerChecks,
      description: "Worker-reported evidence for backups, scanner status, digests, and operational alerts.",
      id: "workers",
      title: "Worker health",
    },
  ]
  const checks = groups.flatMap(group => group.checks)
  const failedChecks = checks.filter(item => item.status === "fail").length
  const warningChecks = checks.filter(item => item.status === "warn").length
  const overallStatus = getOverallStatus(checks)

  return {
    counts: {
      accessRequestsOpen: accessQueue.open.length,
      failedChecks,
      operationsRows: input.operations.backupRuns.length + input.operations.fileUploads.length + input.operations.notificationDeliveries.length + input.operations.operationalEvents.length,
      privacyRequestsOpen: privacyQueue.open.length,
      warningChecks,
    },
    generatedAt: input.generatedAt,
    groups,
    mode: {
      backend: publicEnvironment.backendMode,
      billing: publicEnvironment.billingMode,
      operations: input.operations.mode,
    },
    overallStatus,
    score: scoreChecks(checks),
    summary: summarize(overallStatus, failedChecks, warningChecks),
  }
}
