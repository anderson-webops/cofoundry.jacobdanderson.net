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

export interface ProductionReadinessProvisioningTask {
  action: string
  command: string
  detail: string
  docsPath: string
  id: string
  status: ProductionReadinessStatus
  summary: string
  title: string
}

export interface ProductionReadinessOperationsRows {
  backupRuns: Array<Record<string, unknown>>
  contractEnvelopeEvents?: Array<Record<string, unknown>>
  emailSuppressions?: Array<Record<string, unknown>>
  fileUploads: Array<Record<string, unknown>>
  mode: string
  notificationDeliveries: Array<Record<string, unknown>>
  operationalEvents: Array<Record<string, unknown>>
  trustVerificationEvents: Array<Record<string, unknown>>
}

export interface ProductionReadinessAdminPosture {
  activeAdminCount: number
  activeInvestorAdminCount: number
  hasBootstrapAuditEvidence: boolean
  latestBootstrapAuditAt: string | null
}

export interface ProductionReadinessInput {
  accessRequests: AccessRequest[]
  adminPosture: ProductionReadinessAdminPosture
  contactMailConfigured: boolean
  environment: EnvironmentSnapshot
  environmentValidationErrors: string[]
  generatedAt: string
  hasAlertWebhookConfigured: boolean
  hasContractEnvelopeProviderConfigured?: boolean
  hasDurableLocalDataDir: boolean
  hasOperationsWorkerToken: boolean
  hasSessionSigningSecret: boolean
  hasTrustVerificationProviderConfigured: boolean
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
  provisioningTasks: ProductionReadinessProvisioningTask[]
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

function rowContainsAny(row: Record<string, unknown>, fields: string[], values: string[]) {
  const haystack = fields
    .map(field => String(row[field] || "").toLowerCase())
    .join(" ")

  return values.some(value => haystack.includes(value))
}

function latestMatchingEvent(rows: Array<Record<string, unknown>>, matcher: (row: Record<string, unknown>) => boolean) {
  return latestRow(rows.filter(matcher), ["created_at"])
}

function isAlertSmokeEvent(row: Record<string, unknown>) {
  const eventType = String(row.event_type || "").toLowerCase()
  return eventType.includes("alert_test") || eventType.includes("alert.test")
}

function isDigestDelivery(row: Record<string, unknown>) {
  const eventType = String(row.event_type || "digest.unread").toLowerCase()
  return eventType === "digest.unread" || eventType.startsWith("digest.")
}

function isMailSmokeDelivery(row: Record<string, unknown>) {
  return String(row.event_type || "").toLowerCase() === "mail.smoke"
}

function isStripeWebhookProcessedEvent(row: Record<string, unknown>) {
  return String(row.source || "").toLowerCase() === "stripe.webhook"
    && String(row.event_type || "").toLowerCase() === "stripe.webhook.processed"
}

function isCompletedContractEnvelopeEvent(row: Record<string, unknown>) {
  return String(row.status || "").toLowerCase() === "completed"
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

function task(
  id: string,
  title: string,
  status: ProductionReadinessStatus,
  summary: string,
  detail: string,
  action: string,
  command: string,
  docsPath = "docs/operations-runbook.md",
): ProductionReadinessProvisioningTask {
  return { action, command, detail, docsPath, id, status, summary, title }
}

function buildProvisioningTasks(input: ProductionReadinessInput, checkById: Map<string, ProductionReadinessCheck>) {
  const { public: publicEnvironment } = input.environment
  const mockMode = publicEnvironment.backendMode !== "supabase"
  const stripeMode = publicEnvironment.billingMode === "stripe"
  const environmentCheck = checkById.get("environment-validation")
  const stripeWebhookCheck = checkById.get("stripe-webhook-evidence")
  const stripeCutoverStatus = !stripeMode
    ? "info"
    : environmentCheck?.status === "fail"
      ? "fail"
      : stripeWebhookCheck?.status || "warn"

  return [
    task(
      "session-secret-provisioning",
      "Session signing secret",
      checkById.get("session-signing-secret")?.status || "warn",
      input.hasSessionSigningSecret ? "Secret present" : "Secret missing",
      "Required before hosted sign-in, admin access, and invite-created local accounts are safe.",
      "Inject a deployment-specific value through the host secret store.",
      "SESSION_SIGNING_SECRET=<vault-managed-random-secret>",
    ),
    task(
      "local-data-dir-provisioning",
      "Durable local store",
      mockMode ? checkById.get("local-durable-store")?.status || "warn" : "info",
      mockMode
        ? input.hasDurableLocalDataDir ? "External data directory configured" : "Default .data path in use"
        : "Supabase mode stores primary data in the database",
      "Mock/access-request mode persists invites, accounts, admin audit overlays, privacy requests, file metadata, and operations telemetry on disk.",
      mockMode
        ? "Mount a durable, backed-up host path and point CoFoundry at it before relying on mock/access-request production mode."
        : "Keep the local directory for operational scratch data only after Supabase cutover.",
      "COFOUNDRY_LOCAL_DATA_DIR=/var/lib/cofoundry",
    ),
    task(
      "mail-provisioning",
      "Contact and digest mail",
      checkById.get("mail-transport")?.status || "warn",
      checkById.get("mail-transport")?.summary || (input.contactMailConfigured ? "Mail transport configured" : "Mail transport missing"),
      "Contact forms and notification digests need SMTP or sendmail so users and operators receive messages.",
      "Configure CONTACT_* SMTP/sendmail values, then run a worker-authenticated smoke test to prove delivery.",
      "CONTACT_SMTP_HOST=<smtp-host> CONTACT_FROM_EMAIL=support@cofoundry.dev CONTACT_TO_EMAIL=contacts@jacobdanderson.net\nnpm run operations:mail-smoke -- --to-email contacts@jacobdanderson.net",
    ),
    task(
      "worker-token-provisioning",
      "Operations worker token",
      checkById.get("operations-worker-token")?.status || "warn",
      input.hasOperationsWorkerToken ? "Worker token configured" : "Worker token missing",
      "Backup, file scanner, digest, restore-drill, and monitoring reporters need a shared worker token.",
      "Inject COFOUNDRY_OPERATIONS_TOKEN and use it from every server-side worker/timer.",
      "COFOUNDRY_OPERATIONS_TOKEN=<vault-managed-worker-token>",
    ),
    task(
      "backup-worker-provisioning",
      "Backup worker schedule",
      checkById.get("backup-recency")?.status || "warn",
      checkById.get("backup-recency")?.summary || "Backup state unknown",
      "The admin console should show recent backup rows produced by the real host backup command.",
      "Install a timer that wraps the host backup command with the checked-in operations worker.",
      "npm run operations:backup -- --provider server-backup --artifact-uri <artifact-uri> -- <backup command>",
    ),
    task(
      "file-scanner-provisioning",
      "File scanner worker",
      checkById.get("file-scanning")?.status || "warn",
      checkById.get("file-scanning")?.summary || "Scanner state unknown",
      "Private file uploads should be scanned and reported before operators rely on uploaded evidence.",
      "Configure the approved scanner command and schedule the checked-in scanner worker.",
      "COFOUNDRY_FILE_SCANNER_COMMAND=\"clamscan --no-summary\" npm run operations:scan -- --limit 25",
    ),
    task(
      "contract-envelope-provisioning",
      "Contract envelope provider evidence",
      checkById.get("contract-envelope-evidence")?.status || "info",
      checkById.get("contract-envelope-evidence")?.summary || "No provider configured",
      "Dedicated e-signature or PDF providers should report envelope completion evidence before operators rely on provider-backed agreement packets.",
      input.hasContractEnvelopeProviderConfigured
        ? "Send a provider smoke or real completed envelope result through the checked-in contract-envelope endpoint and confirm readiness evidence passes."
        : "Choose an e-signature/PDF provider only if launch policy requires more than typed signatures plus CoFoundry certificates.",
      "COFOUNDRY_CONTRACT_ENVELOPE_PROVIDER=<provider-name>\nnpm run operations:worker -- contract-envelope --contract-id <contract-id> --contract-version-id <version-id> --provider-envelope-id <provider-envelope-id> --status completed --provider <provider-name> --completed-pdf-sha256 <64-char-sha256>",
    ),
    task(
      "trust-verification-provisioning",
      "Trust verification provider evidence",
      checkById.get("trust-verification-evidence")?.status || "info",
      checkById.get("trust-verification-evidence")?.summary || "No provider configured",
      "Identity, phone, social/OAuth, work-domain, and opportunity-ownership providers should report evidence without automatically granting member-facing badges.",
      input.hasTrustVerificationProviderConfigured
        ? "Send a provider smoke or real provider result through the checked-in trust-verification endpoint and confirm it appears in admin operations."
        : "Choose provider(s) only when the product policy is ready, then wire callbacks through the worker-authenticated endpoint.",
      "COFOUNDRY_TRUST_VERIFICATION_PROVIDER=<provider-name>\nnpm run operations:trust-verification -- --target-type profile --target-id <profile-id> --verification-type government_id --status manual_review --provider <provider-name> --source-event-id <provider-event-id>",
    ),
    task(
      "digest-worker-provisioning",
      "Notification digest worker",
      checkById.get("notification-digests")?.status || "warn",
      checkById.get("notification-digests")?.summary || "Digest state unknown",
      "Scheduled digest rows prove the inbox notification path is running.",
      "Install the digest timer after SMTP and member notification preferences are verified.",
      "npm run operations:digest -- --dry-run --max-users 100",
    ),
    task(
      "restore-drill-provisioning",
      "Restore drill evidence",
      checkById.get("restore-drill")?.status || "warn",
      checkById.get("restore-drill")?.summary || "Restore drill state unknown",
      "Backups are not production evidence until a restore command has succeeded and reported telemetry.",
      "Run the restore drill wrapper against a staging or verification command and keep the procedure in the server runbook.",
      "npm run operations:restore-drill -- --id restore-YYYYMMDD -- <restore verification command>",
    ),
    task(
      "monitoring-heartbeat-provisioning",
      "Monitoring heartbeat",
      checkById.get("monitoring-heartbeat")?.status || "warn",
      checkById.get("monitoring-heartbeat")?.summary || "Monitoring state unknown",
      "The readiness view should show a recent heartbeat or alert event from uptime/log monitoring.",
      "Wire the monitor or alert destination to report both heartbeat and failure events through the operations reporter.",
      "npm run operations:event -- --source uptime-monitor --event-type monitoring.heartbeat --severity info",
    ),
    task(
      "alert-webhook-provisioning",
      "Alert webhook destination",
      checkById.get("alert-webhook-destination")?.status || "warn",
      checkById.get("alert-webhook-destination")?.summary || "Alert webhook state unknown",
      "Worker-reported warning and error events should reach an external destination when operators are not watching the admin console.",
      "Configure the server-only alert webhook env, then run an alert smoke event from the production host.",
      "COFOUNDRY_ALERT_WEBHOOK_URL=<server-only-webhook-url> npm run operations:event -- --source uptime-monitor --event-type monitoring.alert_test --severity warning --metadata purpose=alert-webhook-smoke",
    ),
    task(
      "first-admin-bootstrap-provisioning",
      "First-admin bootstrap",
      publicEnvironment.backendMode === "supabase"
        ? checkById.get("admin-bootstrap-audit")?.status || "warn"
        : "info",
      publicEnvironment.backendMode === "supabase"
        ? checkById.get("admin-bootstrap-audit")?.summary || "Bootstrap audit state unknown"
        : "Required at Supabase cutover",
      "Supabase-backed production should have an auditable first-admin promotion before operators rely on the console.",
      "Run the bootstrap script from a server environment with Vault-injected Supabase service-role credentials.",
      "BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin",
      "docs/server-ai-admin-bootstrap-prompt.md",
    ),
    task(
      "stripe-cutover-provisioning",
      "Stripe cutover",
      stripeCutoverStatus,
      stripeMode ? stripeWebhookCheck?.summary || "Stripe mode enabled" : "Stripe intentionally disabled",
      "Live billing should stay disabled until products, prices, webhook signature validation, and customer portal settings are verified.",
      stripeMode
        ? "Confirm Stripe webhook delivery, customer portal setup, and Supabase subscription reconciliation before public checkout."
        : "Keep billing in mock/operator-managed mode until the Stripe account and webhook setup are ready.",
      "NUXT_PUBLIC_BILLING_MODE=stripe STRIPE_SECRET_KEY=<vault-managed-key> STRIPE_WEBHOOK_SECRET=<vault-managed-secret>",
      "README.md#billing-notes",
    ),
  ]
}

export function buildProductionReadinessSnapshot(input: ProductionReadinessInput): ProductionReadinessPayload {
  const nowTime = new Date(input.generatedAt).getTime()
  const { public: publicEnvironment } = input.environment
  const stripeMode = publicEnvironment.billingMode === "stripe"
  const accessQueue = openAccessQueueState(input.accessRequests, nowTime)
  const privacyQueue = openPrivacyQueueState(input.privacyRequests, nowTime)
  const latestBackup = latestRow(input.operations.backupRuns, ["started_at", "created_at"])
  const latestBackupTime = newestTime(input.operations.backupRuns, ["completed_at", "started_at", "created_at"])
  const backupDaysOld = daysSince(latestBackupTime, nowTime)
  const digestDeliveries = input.operations.notificationDeliveries.filter(isDigestDelivery)
  const latestNotificationDeliveryTime = newestTime(digestDeliveries, ["created_at", "delivered_at"])
  const notificationDaysOld = daysSince(latestNotificationDeliveryTime, nowTime)
  const mailSmokeDeliveries = input.operations.notificationDeliveries.filter(isMailSmokeDelivery)
  const latestMailSmoke = latestRow(mailSmokeDeliveries, ["delivered_at", "created_at"])
  const latestSuccessfulMailSmoke = latestRow(mailSmokeDeliveries.filter(row => String(row.status || "") === "sent"), ["delivered_at", "created_at"])
  const latestFailedMailSmoke = latestRow(mailSmokeDeliveries.filter(row => String(row.status || "") === "failed"), ["delivered_at", "created_at"])
  const latestMailSmokeTime = newestTime(latestMailSmoke ? [latestMailSmoke] : [], ["delivered_at", "created_at"])
  const latestSuccessfulMailSmokeTime = newestTime(latestSuccessfulMailSmoke ? [latestSuccessfulMailSmoke] : [], ["delivered_at", "created_at"])
  const latestFailedMailSmokeTime = newestTime(latestFailedMailSmoke ? [latestFailedMailSmoke] : [], ["delivered_at", "created_at"])
  const mailSmokeDaysOld = daysSince(latestSuccessfulMailSmokeTime, nowTime)
  const latestMailSmokeStatus = String(latestMailSmoke?.status || "")
  const hasNewerMailSmokeFailure = latestFailedMailSmokeTime !== null && (latestSuccessfulMailSmokeTime === null || latestFailedMailSmokeTime >= latestSuccessfulMailSmokeTime)
  const failedOrFlaggedScans = countRows(input.operations.fileUploads, "scan_status", ["failed", "flagged"])
  const pendingScans = countRows(input.operations.fileUploads, "scan_status", ["pending"])
  const contractEnvelopeEvents = input.operations.contractEnvelopeEvents || []
  const completedContractEnvelopeEvents = countRows(contractEnvelopeEvents, "status", ["completed"])
  const attentionContractEnvelopeEvents = countRows(contractEnvelopeEvents, "status", ["declined", "failed", "voided"])
  const latestCompletedContractEnvelope = latestMatchingEvent(contractEnvelopeEvents, isCompletedContractEnvelopeEvent)
  const latestCompletedContractEnvelopeTime = newestTime(latestCompletedContractEnvelope ? [latestCompletedContractEnvelope] : [], ["occurred_at", "created_at"])
  const contractEnvelopeDaysOld = daysSince(latestCompletedContractEnvelopeTime, nowTime)
  let contractEnvelopeStatus: ProductionReadinessStatus = "info"
  if (input.hasContractEnvelopeProviderConfigured) {
    contractEnvelopeStatus = !latestCompletedContractEnvelope || (contractEnvelopeDaysOld !== null && contractEnvelopeDaysOld > 30)
      ? "warn"
      : "pass"
  }
  const contractEnvelopeSummary = contractEnvelopeEvents.length
    ? `${completedContractEnvelopeEvents} completed, ${attentionContractEnvelopeEvents} declined/voided/failed${contractEnvelopeDaysOld === null ? "" : `, latest ${contractEnvelopeDaysOld} day${contractEnvelopeDaysOld === 1 ? "" : "s"} old`}`
    : input.hasContractEnvelopeProviderConfigured ? "Provider configured, no rows" : "No provider configured"
  const trustVerificationEvents = input.operations.trustVerificationEvents || []
  const latestTrustVerification = latestRow(trustVerificationEvents, ["occurred_at", "created_at"])
  const latestTrustVerificationTime = newestTime(latestTrustVerification ? [latestTrustVerification] : [], ["occurred_at", "created_at"])
  const trustVerificationDaysOld = daysSince(latestTrustVerificationTime, nowTime)
  const verifiedTrustVerificationEvents = countRows(trustVerificationEvents, "status", ["verified"])
  const reviewTrustVerificationEvents = countRows(trustVerificationEvents, "status", ["manual_review"])
  let trustVerificationStatus: ProductionReadinessStatus = "info"
  if (input.hasTrustVerificationProviderConfigured) {
    trustVerificationStatus = !trustVerificationEvents.length || (trustVerificationDaysOld !== null && trustVerificationDaysOld > 30)
      ? "warn"
      : "pass"
  }
  const latestStripeWebhookEvent = latestMatchingEvent(input.operations.operationalEvents, isStripeWebhookProcessedEvent)
  const latestStripeWebhookTime = newestTime(latestStripeWebhookEvent ? [latestStripeWebhookEvent] : [], ["created_at"])
  const stripeWebhookDaysOld = daysSince(latestStripeWebhookTime, nowTime)
  let stripeWebhookStatus: ProductionReadinessStatus = "info"
  if (stripeMode) {
    stripeWebhookStatus = !latestStripeWebhookEvent || (stripeWebhookDaysOld !== null && stripeWebhookDaysOld > 30)
      ? "warn"
      : "pass"
  }
  const stripeWebhookSummary = stripeMode
    ? latestStripeWebhookEvent
      ? `Last processed webhook${stripeWebhookDaysOld === null ? "" : ` ${stripeWebhookDaysOld} day${stripeWebhookDaysOld === 1 ? "" : "s"} old`}`
      : "Stripe mode enabled, no processed webhook"
    : "Stripe intentionally disabled"
  const attentionEvents = input.operations.operationalEvents.filter(row => !isAlertSmokeEvent(row))
  const errorEvents = countRows(attentionEvents, "severity", ["error"])
  const warningEvents = countRows(attentionEvents, "severity", ["warning"])
  const latestRestoreDrill = latestMatchingEvent(input.operations.operationalEvents, row =>
    rowContainsAny(row, ["event_type", "source", "target_type"], ["restore_drill", "restore drill"]))
  const latestRestoreDrillTime = newestTime(latestRestoreDrill ? [latestRestoreDrill] : [], ["created_at"])
  const restoreDrillDaysOld = daysSince(latestRestoreDrillTime, nowTime)
  const latestMonitoringEvent = latestMatchingEvent(input.operations.operationalEvents, row =>
    rowContainsAny(row, ["event_type", "source", "target_type"], ["monitor", "alert", "uptime"]))
  const latestMonitoringEventTime = newestTime(latestMonitoringEvent ? [latestMonitoringEvent] : [], ["created_at"])
  const monitoringEventDaysOld = daysSince(latestMonitoringEventTime, nowTime)
  const latestAlertSmokeEvent = latestMatchingEvent(input.operations.operationalEvents, isAlertSmokeEvent)
  const latestAlertSmokeTime = newestTime(latestAlertSmokeEvent ? [latestAlertSmokeEvent] : [], ["created_at"])
  const alertSmokeDaysOld = daysSince(latestAlertSmokeTime, nowTime)
  const latestBootstrapAuditTime = toTime(input.adminPosture.latestBootstrapAuditAt)
  const bootstrapAuditDaysOld = daysSince(latestBootstrapAuditTime, nowTime)
  let alertWebhookStatus: ProductionReadinessStatus = "pass"
  if (input.isLocalDevelopment)
    alertWebhookStatus = "info"
  else if (!input.hasAlertWebhookConfigured || !latestAlertSmokeEvent || (alertSmokeDaysOld !== null && alertSmokeDaysOld > 30))
    alertWebhookStatus = "warn"

  let alertWebhookSummary = "No alert webhook configured"
  if (input.hasAlertWebhookConfigured) {
    alertWebhookSummary = latestAlertSmokeEvent
      ? `Smoke event${alertSmokeDaysOld === null ? "" : ` ${alertSmokeDaysOld} day${alertSmokeDaysOld === 1 ? "" : "s"} old`}`
      : "Configured, no smoke event"
  }

  let mailTransportStatus: ProductionReadinessStatus = "pass"
  if (!input.contactMailConfigured)
    mailTransportStatus = "warn"
  else if (hasNewerMailSmokeFailure)
    mailTransportStatus = "fail"
  else if (!latestSuccessfulMailSmoke)
    mailTransportStatus = "warn"
  else if (mailSmokeDaysOld !== null && mailSmokeDaysOld > 30)
    mailTransportStatus = "warn"

  let mailTransportSummary = input.contactMailConfigured ? "Configured" : "Not configured"
  if (input.contactMailConfigured && hasNewerMailSmokeFailure) {
    const failedDaysOld = daysSince(latestFailedMailSmokeTime, nowTime)
    mailTransportSummary = `failed smoke${failedDaysOld === null ? "" : `, ${failedDaysOld} day${failedDaysOld === 1 ? "" : "s"} old`}`
  }
  else if (input.contactMailConfigured && latestSuccessfulMailSmoke) {
    mailTransportSummary = `sent smoke${mailSmokeDaysOld === null ? "" : `, ${mailSmokeDaysOld} day${mailSmokeDaysOld === 1 ? "" : "s"} old`}`
  }
  else if (input.contactMailConfigured && latestMailSmoke) {
    const latestDaysOld = daysSince(latestMailSmokeTime, nowTime)
    mailTransportSummary = `${latestMailSmokeStatus || "recorded"} smoke${latestDaysOld === null ? "" : `, ${latestDaysOld} day${latestDaysOld === 1 ? "" : "s"} old`}`
  }
  let mailTransportDetail = "Contact submissions and digests can be recorded, but users and operators will not receive outbound email."
  if (input.contactMailConfigured) {
    if (latestSuccessfulMailSmoke)
      mailTransportDetail = "Contact form, notification digest, and lifecycle email delivery have recent smoke-test evidence."
    else
      mailTransportDetail = "Mail transport is configured, but readiness still needs a recent successful worker-authenticated smoke test."
  }
  const mailTransportAction = input.contactMailConfigured
    ? "Run `npm run operations:mail-smoke -- --to-email <monitored-inbox>` and confirm the monitored inbox receives the message."
    : "Configure SMTP or sendmail CONTACT_* environment values."

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

  const adminChecks = [
    check(
      "active-admin-access",
      "Active admin access",
      input.adminPosture.activeAdminCount > 0 ? "pass" : "fail",
      `${input.adminPosture.activeAdminCount} active admin${input.adminPosture.activeAdminCount === 1 ? "" : "s"}`,
      input.adminPosture.activeAdminCount > 0
        ? `${input.adminPosture.activeInvestorAdminCount} active investor-admin account${input.adminPosture.activeInvestorAdminCount === 1 ? "" : "s"} included in the operator role set.`
        : "No active admin or investor-admin account is available. Operators could be locked out of production control surfaces.",
      "Create or reinstate a persisted operator account, then run the first-admin bootstrap path before Supabase cutover.",
    ),
    check(
      "admin-bootstrap-audit",
      "First-admin bootstrap audit",
      publicEnvironment.backendMode === "supabase"
        ? input.adminPosture.hasBootstrapAuditEvidence
          ? "pass"
          : "warn"
        : "info",
      input.adminPosture.hasBootstrapAuditEvidence
        ? `Admin role-change audit recorded${bootstrapAuditDaysOld === null ? "" : `, ${bootstrapAuditDaysOld} day${bootstrapAuditDaysOld === 1 ? "" : "s"} old`}`
        : "No admin bootstrap audit row detected",
      publicEnvironment.backendMode === "supabase"
        ? "Supabase-backed production should have an auditable first-admin promotion or admin role-change row before operators rely on the console."
        : "Mock/access-request mode can use the seeded or durable local admin state; Supabase bootstrap evidence is required at live Supabase cutover.",
      "Run `BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin` from the server environment and confirm the audit row appears in `/admin/audit`.",
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
        ? "Worker endpoints can authenticate backup, scanner, digest, trust-verification, and event reports."
        : "Worker endpoints fail closed, but scheduled operations cannot report status until this is configured.",
      "Inject COFOUNDRY_OPERATIONS_TOKEN and configure the server-side workers to use it.",
    ),
    check(
      "mail-transport",
      "Contact and digest email",
      mailTransportStatus,
      mailTransportSummary,
      mailTransportDetail,
      mailTransportAction,
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
      !digestDeliveries.length
        ? "warn"
        : notificationDaysOld !== null && notificationDaysOld > 1
          ? "warn"
          : "pass",
      digestDeliveries.length
        ? `Last digest record${notificationDaysOld === null ? "" : ` ${notificationDaysOld} day${notificationDaysOld === 1 ? "" : "s"} old`}`
        : "No digest delivery rows reported",
      "Digest rows prove that the scheduled notification path is running, even when mock mode records a skipped delivery.",
      "Schedule `/api/operations/notification-digests/run` and confirm recent rows appear in `/admin/operations`.",
    ),
    check(
      "contract-envelope-evidence",
      "Contract envelope provider evidence",
      contractEnvelopeStatus,
      contractEnvelopeSummary,
      input.hasContractEnvelopeProviderConfigured
        ? "A dedicated e-signature or PDF provider is configured and should report completed envelope evidence into the operations store."
        : "Dedicated e-signature/PDF provider callbacks are optional until launch policy requires provider-backed agreement packets.",
      input.hasContractEnvelopeProviderConfigured
        ? "Run `npm run operations:worker -- contract-envelope --contract-id <contract-id> --contract-version-id <version-id> --provider-envelope-id <provider-envelope-id> --status completed --provider <provider>` and confirm `/admin/operations` shows the row."
        : "Do not enable contract-provider callbacks until provider choice, document custody, and completed-PDF retention policy are explicit.",
    ),
    check(
      "trust-verification-evidence",
      "Trust verification provider evidence",
      trustVerificationStatus,
      trustVerificationEvents.length
        ? `${verifiedTrustVerificationEvents} verified, ${reviewTrustVerificationEvents} manual review${trustVerificationDaysOld === null ? "" : `, latest ${trustVerificationDaysOld} day${trustVerificationDaysOld === 1 ? "" : "s"} old`}`
        : input.hasTrustVerificationProviderConfigured ? "Provider configured, no rows" : "No provider configured",
      input.hasTrustVerificationProviderConfigured
        ? "Provider trust checks are reporting into the operations store as evidence for operator review and future badge policy."
        : "Trust verification provider callbacks are optional until phone, identity, domain, social/OAuth, or ownership providers are selected.",
      input.hasTrustVerificationProviderConfigured
        ? "Run `npm run operations:trust-verification -- --target-type profile --target-id <profile-id> --verification-type government_id --status manual_review --provider <provider>` and confirm `/admin/operations` shows the row."
        : "Do not enable trust-provider callbacks until provider choice, privacy posture, and badge policy are explicit.",
    ),
    check(
      "stripe-webhook-evidence",
      "Stripe webhook evidence",
      stripeWebhookStatus,
      stripeWebhookSummary,
      stripeMode
        ? "Stripe mode needs recent signed webhook evidence before checkout can be treated as reconciled."
        : "Mock billing is the active production-safe mode; Stripe webhook evidence is not required.",
      stripeMode
        ? "Trigger a Stripe checkout/subscription webhook in staging or production and confirm `/admin/operations` shows a `stripe.webhook.processed` row."
        : "Keep `NUXT_PUBLIC_BILLING_MODE=mock` until Stripe products, prices, customer portal, webhook delivery, and rollback are ready.",
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
    check(
      "restore-drill",
      "Restore drill evidence",
      !latestRestoreDrill
        ? "warn"
        : String(latestRestoreDrill.event_type || "").includes("failed")
          ? "fail"
          : restoreDrillDaysOld !== null && restoreDrillDaysOld > 30
            ? "warn"
            : "pass",
      latestRestoreDrill
        ? `${String(latestRestoreDrill.event_type || "restore drill recorded")}${restoreDrillDaysOld === null ? "" : `, ${restoreDrillDaysOld} day${restoreDrillDaysOld === 1 ? "" : "s"} old`}`
        : "No restore drill events reported",
      latestRestoreDrill
        ? "Restore drill events prove that backup artifacts or durable local stores can be restored into a checked environment."
        : "Backups are not production evidence until at least one restore drill has been reported.",
      "Run `npm run operations:restore-drill -- --id restore-YYYYMMDD -- <restore verification command>` and confirm the success event appears in `/admin/operations`.",
    ),
    check(
      "monitoring-heartbeat",
      "Monitoring and alerting heartbeat",
      !latestMonitoringEvent
        ? "warn"
        : monitoringEventDaysOld !== null && monitoringEventDaysOld > 1
          ? "warn"
          : "pass",
      latestMonitoringEvent
        ? `${String(latestMonitoringEvent.event_type || "monitoring event recorded")}${monitoringEventDaysOld === null ? "" : `, ${monitoringEventDaysOld} day${monitoringEventDaysOld === 1 ? "" : "s"} old`}`
        : "No monitoring events reported",
      latestMonitoringEvent
        ? "Monitoring or alerting events are reaching the operations telemetry store."
        : "Production operation needs proof that deploy, uptime, log, or alerting monitors can report into CoFoundry.",
      "Configure the monitor runner or alert destination to report an info heartbeat and failures through `npm run operations:event`.",
    ),
    check(
      "alert-webhook-destination",
      "Alert webhook destination",
      alertWebhookStatus,
      alertWebhookSummary,
      input.hasAlertWebhookConfigured
        ? "Server-side operations workers have an alert webhook destination for warning/error events."
        : "Warning and error events are persisted in admin operations, but they will not notify operators outside the app until a destination is configured.",
      input.hasAlertWebhookConfigured
        ? "Run `npm run operations:event -- --source uptime-monitor --event-type monitoring.alert_test --severity warning --metadata purpose=alert-webhook-smoke` from the server and confirm the external destination receives it."
        : "Set COFOUNDRY_ALERT_WEBHOOK_URL in the server-only worker env after choosing the alert destination.",
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
      checks: adminChecks,
      description: "Active operator access and audited first-admin bootstrap evidence for the admin console.",
      id: "admin-control",
      title: "Admin control plane",
    },
    {
      checks: queueChecks,
      description: "Operator queues that directly affect user trust, access, and compliance response quality.",
      id: "queues",
      title: "Operator queues",
    },
    {
      checks: workerChecks,
      description: "Worker-reported evidence for backups, scanner status, digests, contract envelopes, trust-provider callbacks, Stripe webhooks, and operational alerts.",
      id: "workers",
      title: "Worker health",
    },
  ]
  const checks = groups.flatMap(group => group.checks)
  const checkById = new Map(checks.map(item => [item.id, item]))
  const failedChecks = checks.filter(item => item.status === "fail").length
  const warningChecks = checks.filter(item => item.status === "warn").length
  const overallStatus = getOverallStatus(checks)

  return {
    counts: {
      accessRequestsOpen: accessQueue.open.length,
      failedChecks,
      operationsRows: input.operations.backupRuns.length + contractEnvelopeEvents.length + (input.operations.emailSuppressions || []).length + input.operations.fileUploads.length + input.operations.notificationDeliveries.length + input.operations.operationalEvents.length + trustVerificationEvents.length,
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
    provisioningTasks: buildProvisioningTasks(input, checkById),
    score: scoreChecks(checks),
    summary: summarize(overallStatus, failedChecks, warningChecks),
  }
}
