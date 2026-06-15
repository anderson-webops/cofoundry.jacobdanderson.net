import type { AccessRequest, PrivacyRequest } from "~/shared/types/domain"
import type { DeploymentMetadata, EnvironmentSnapshot } from "~/shared/utils/environment"

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

export interface ProductionReadinessCutoverPhase {
  action: string
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
  deploymentMetadata: DeploymentMetadata
  environment: EnvironmentSnapshot
  environmentValidationErrors: string[]
  expectsMultiInstanceRuntime?: boolean
  generatedAt: string
  hasAlertWebhookConfigured: boolean
  hasContractEnvelopeProviderConfigured?: boolean
  hasDurableLocalDataDir: boolean
  hasEmailSuppressionProviderConfigured?: boolean
  hasOAuthProviderConfigured?: boolean
  hasOperationsWorkerToken: boolean
  hasRealtimeFanoutConfigured?: boolean
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
  cutoverPhases: ProductionReadinessCutoverPhase[]
  deployment: DeploymentMetadata
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

function isOAuthSignInEvent(row: Record<string, unknown>) {
  return String(row.source || "").toLowerCase() === "auth.oauth"
    && String(row.event_type || "").toLowerCase() === "auth.oauth.signed_in"
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

function shortCommit(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value
}

function deploymentSummary(metadata: DeploymentMetadata) {
  if (metadata.release)
    return metadata.release

  if (metadata.commitSha)
    return shortCommit(metadata.commitSha)

  return "No release metadata"
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

function phase(
  id: string,
  title: string,
  status: ProductionReadinessStatus,
  summary: string,
  detail: string,
  action: string,
  docsPath = "docs/server-ai-production-cutover-prompt.md",
): ProductionReadinessCutoverPhase {
  return { action, detail, docsPath, id, status, summary, title }
}

function aggregateStatus(checks: Array<ProductionReadinessCheck | undefined>): ProductionReadinessStatus {
  const presentChecks = checks.filter((item): item is ProductionReadinessCheck => Boolean(item))
  if (!presentChecks.length)
    return "info"

  if (presentChecks.some(item => item.status === "fail"))
    return "fail"

  if (presentChecks.some(item => item.status === "warn"))
    return "warn"

  if (presentChecks.some(item => item.status === "pass"))
    return "pass"

  return "info"
}

function buildProvisioningTasks(input: ProductionReadinessInput, checkById: Map<string, ProductionReadinessCheck>) {
  const { public: publicEnvironment } = input.environment
  const mockMode = publicEnvironment.backendMode !== "supabase"
  const stripeMode = publicEnvironment.billingMode === "stripe"
  const environmentCheck = checkById.get("environment-validation")
  const stripeWebhookCheck = checkById.get("stripe-webhook-evidence")
  const operationsUnitChecks = [
    checkById.get("operations-worker-token"),
    checkById.get("backup-recency"),
    checkById.get("file-scanning"),
    checkById.get("notification-digests"),
    checkById.get("restore-drill"),
    checkById.get("monitoring-heartbeat"),
  ].filter((check): check is ProductionReadinessCheck => Boolean(check))
  const operationsUnitStatus: ProductionReadinessStatus = operationsUnitChecks.some(check => check.status === "fail")
    ? "fail"
    : operationsUnitChecks.some(check => check.status === "warn")
      ? "warn"
      : "pass"
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
      "CONTACT_SMTP_HOST=<smtp-host> CONTACT_FROM_EMAIL=support@cofoundry.dev CONTACT_TO_EMAIL=contacts@jacobdanderson.net\nCOFOUNDRY_MAIL_SMOKE_TO_EMAIL=contacts@jacobdanderson.net\nsystemctl start cofoundry-operations-mail-smoke.service",
    ),
    task(
      "email-suppression-provisioning",
      "Email suppression provider evidence",
      checkById.get("email-suppression-evidence")?.status || "info",
      checkById.get("email-suppression-evidence")?.summary || "No provider configured",
      "Mail providers should report bounces, complaints, unsubscribes, and manual suppressions before real optional notifications are scheduled.",
      input.hasEmailSuppressionProviderConfigured
        ? "Send a provider smoke or real suppression event through the checked-in suppression endpoint and confirm readiness evidence passes."
        : "Choose and wire suppression callbacks only after the outbound mail provider is selected.",
      "COFOUNDRY_EMAIL_SUPPRESSION_PROVIDER=<provider-name>\nnpm run operations:worker -- email-suppression --email <recipient@example.com> --reason complaint --category all --provider <provider-name> --source-event-id <provider-event-id>",
    ),
    task(
      "external-auth-provider-provisioning",
      "External auth provider cutover",
      checkById.get("external-auth-provider")?.status || "info",
      checkById.get("external-auth-provider")?.summary || "No provider configured",
      "OAuth and external identity providers should stay disabled until Supabase persistence, callback handling, account linking, role rehydration, and rollback are verified.",
      input.hasOAuthProviderConfigured
        ? "Run a staging provider sign-in smoke and confirm the successful OAuth callback appears in readiness evidence."
        : "Leave OAuth provider markers unset until the identity provider and callback flow are ready for a deliberate cutover.",
      "COFOUNDRY_OAUTH_PROVIDER=<provider-name>\n# Verify /auth/sign-in provider flow and confirm auth.oauth.signed_in telemetry.",
      "docs/server-ai-production-cutover-prompt.md",
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
      "realtime-fanout-provisioning",
      "Workspace realtime fanout",
      checkById.get("realtime-fanout")?.status || "info",
      checkById.get("realtime-fanout")?.summary || "Single-instance realtime",
      "Process-local SSE is enough for one Node process, but horizontally scaled app servers need a relay so messages, typing, proposal changes, and inbox refresh events reach clients connected to another instance.",
      input.expectsMultiInstanceRuntime || input.hasRealtimeFanoutConfigured
        ? "Configure a server-side realtime relay URL and have the relay POST signed envelopes back to each instance's operations ingress."
        : "Keep this unset until the deployment actually runs more than one app instance.",
      "COFOUNDRY_EXPECT_MULTI_INSTANCE=true\nCOFOUNDRY_REALTIME_FANOUT_URL=https://<relay-or-internal-router>/cofoundry/realtime\n# Relay posts to each app instance: POST /api/operations/realtime-events with COFOUNDRY_OPERATIONS_TOKEN",
    ),
    task(
      "operations-unit-installer",
      "Operations unit installer",
      operationsUnitStatus,
      operationsUnitStatus === "pass" ? "Worker telemetry current" : "Install or verify worker timers",
      "The checked-in systemd installer reduces drift across backup, digest, scanner, heartbeat, alert-smoke, mail-smoke, and restore-drill worker units.",
      "Run the installer in dry-run mode first, review the generated commands and env file, then install or tune the units on the host.",
      "sudo deploy/systemd/install-operations-units.sh --dry-run\nsudo deploy/systemd/install-operations-units.sh",
      "deploy/systemd/README.md",
    ),
    task(
      "backup-worker-provisioning",
      "Backup worker schedule",
      checkById.get("backup-recency")?.status || "warn",
      checkById.get("backup-recency")?.summary || "Backup state unknown",
      "The admin console should show recent backup rows produced by the real host backup command.",
      "Install a timer that wraps the host backup command with the checked-in operations worker.",
      "COFOUNDRY_BACKUP_COMMAND=\"<backup command>\"\nsystemctl start cofoundry-operations-backup.service\n# Direct fallback: npm run operations:backup -- --provider server-backup --artifact-uri <artifact-uri> -- <backup command>",
    ),
    task(
      "file-scanner-provisioning",
      "File scanner worker",
      checkById.get("file-scanning")?.status || "warn",
      checkById.get("file-scanning")?.summary || "Scanner state unknown",
      "Private file uploads should be scanned and reported before operators rely on uploaded evidence.",
      "Configure the approved scanner command and schedule the checked-in scanner worker.",
      "COFOUNDRY_FILE_SCANNER_COMMAND=\"clamscan --no-summary\"\nsystemctl start cofoundry-operations-scan.service\n# Direct fallback: npm run operations:scan -- --limit 25",
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
      "COFOUNDRY_DIGEST_DRY_RUN=true\nsystemctl start cofoundry-operations-digest.service\n# Direct fallback: npm run operations:digest -- --dry-run --max-users 100",
    ),
    task(
      "restore-drill-provisioning",
      "Restore drill evidence",
      checkById.get("restore-drill")?.status || "warn",
      checkById.get("restore-drill")?.summary || "Restore drill state unknown",
      "Backups are not production evidence until a restore command has succeeded and reported telemetry.",
      "Run the restore drill wrapper against a staging or verification command and keep the procedure in the server runbook.",
      "COFOUNDRY_RESTORE_DRILL_COMMAND=\"<restore verification command>\"\nsystemctl start cofoundry-operations-restore-drill.service\n# Enable the timer only after manual success: sudo deploy/systemd/install-operations-units.sh --enable-restore-drill",
    ),
    task(
      "monitoring-heartbeat-provisioning",
      "Monitoring heartbeat",
      checkById.get("monitoring-heartbeat")?.status || "warn",
      checkById.get("monitoring-heartbeat")?.summary || "Monitoring state unknown",
      "The readiness view should show a recent heartbeat or alert event from uptime/log monitoring.",
      "Schedule the canonical heartbeat worker and keep failure events wired through the operations reporter.",
      "systemctl start cofoundry-operations-heartbeat.service\n# Direct fallback: npm run operations:heartbeat -- --metadata schedule=hourly",
    ),
    task(
      "alert-webhook-provisioning",
      "Alert webhook destination",
      checkById.get("alert-webhook-destination")?.status || "warn",
      checkById.get("alert-webhook-destination")?.summary || "Alert webhook state unknown",
      "Worker-reported warning and error events should reach an external destination when operators are not watching the admin console.",
      "Configure the server-only alert webhook env, then run an alert smoke event from the production host.",
      "COFOUNDRY_ALERT_WEBHOOK_URL=<server-only-webhook-url>\nsystemctl start cofoundry-operations-alert-smoke.service",
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

function buildCutoverPhases(input: ProductionReadinessInput, checkById: Map<string, ProductionReadinessCheck>) {
  const { public: publicEnvironment } = input.environment
  const mockMode = publicEnvironment.backendMode !== "supabase"
  const stripeMode = publicEnvironment.billingMode === "stripe"
  const emailProviderStatus = aggregateStatus([
    checkById.get("mail-transport"),
    input.hasEmailSuppressionProviderConfigured ? checkById.get("email-suppression-evidence") : undefined,
  ])
  const operationsAutomationStatus = aggregateStatus([
    checkById.get("operations-worker-token"),
    checkById.get("backup-recency"),
    checkById.get("file-scanning"),
    checkById.get("notification-digests"),
    checkById.get("restore-drill"),
    checkById.get("monitoring-heartbeat"),
    checkById.get("alert-webhook-destination"),
  ])
  const realtimeScalingStatus = input.expectsMultiInstanceRuntime || input.hasRealtimeFanoutConfigured
    ? checkById.get("realtime-fanout")?.status || "warn"
    : "info"
  const supabaseCutoverStatus = publicEnvironment.backendMode === "supabase"
    ? aggregateStatus([
        checkById.get("environment-validation"),
        checkById.get("active-admin-access"),
        checkById.get("admin-bootstrap-audit"),
      ])
    : "info"
  const externalAuthStatus = input.hasOAuthProviderConfigured
    ? checkById.get("external-auth-provider")?.status || "warn"
    : "info"
  const trustAndAgreementStatus = input.hasTrustVerificationProviderConfigured || input.hasContractEnvelopeProviderConfigured
    ? aggregateStatus([
        input.hasTrustVerificationProviderConfigured ? checkById.get("trust-verification-evidence") : undefined,
        input.hasContractEnvelopeProviderConfigured ? checkById.get("contract-envelope-evidence") : undefined,
      ])
    : "info"
  const stripeCutoverStatus = stripeMode
    ? aggregateStatus([
        checkById.get("environment-validation"),
        checkById.get("stripe-webhook-evidence"),
      ])
    : "info"

  return [
    phase(
      "durable-mock-baseline",
      "Durable mock/access-request baseline",
      mockMode
        ? aggregateStatus([
            checkById.get("environment-validation"),
            checkById.get("launch-mode"),
            checkById.get("public-app-url"),
            checkById.get("deployment-identity"),
            checkById.get("session-signing-secret"),
            checkById.get("local-durable-store"),
            checkById.get("operations-worker-token"),
            checkById.get("realtime-fanout"),
            checkById.get("active-admin-access"),
          ])
        : "pass",
      mockMode ? "Active production path" : "Completed before live persistence",
      "This is the current safe public posture: marketing/discovery pages, access requests, invited local accounts, durable local state, and admin operations without live Supabase or Stripe.",
      mockMode
        ? "Resolve baseline failures and warnings before increasing traffic or enabling provider cutovers."
        : "Keep the local mock/access-request rollback path documented even after Supabase cutover.",
    ),
    phase(
      "outbound-email-provider",
      "Outbound email provider",
      emailProviderStatus,
      input.contactMailConfigured ? "Mail transport configured" : "Mail transport not configured",
      "Contact, access-request, digest, lifecycle, and support workflows need provider-backed delivery plus suppression handling before real optional sends are scheduled.",
      input.contactMailConfigured
        ? "Keep recent mail-smoke evidence current and wire suppression callbacks before enabling scheduled real digests."
        : "Choose the transactional email provider, configure server-only credentials, and run the mail-smoke worker.",
      "docs/operations-runbook.md",
    ),
    phase(
      "operations-automation",
      "Operations automation",
      operationsAutomationStatus,
      operationsAutomationStatus === "pass" ? "Workers reporting" : "Worker evidence incomplete",
      "Backups, scanner results, digest runs, restore drills, monitoring heartbeats, and alert delivery need fresh worker-reported evidence.",
      "Run or tune the checked-in systemd installer, then verify current rows in `/admin/operations` and `/admin/readiness`.",
      "deploy/systemd/README.md",
    ),
    phase(
      "workspace-realtime-scaling",
      "Workspace realtime scaling",
      realtimeScalingStatus,
      input.hasRealtimeFanoutConfigured
        ? "Fanout bridge configured"
        : input.expectsMultiInstanceRuntime ? "Multi-instance expected, fanout missing" : "Single-instance default",
      "The in-app realtime layer is process-local unless a server-side relay is configured. Multi-instance production should not rely on sticky clients seeing only same-process events.",
      input.expectsMultiInstanceRuntime || input.hasRealtimeFanoutConfigured
        ? "Wire the relay to receive CoFoundry envelopes and POST them to every app instance's `/api/operations/realtime-events` endpoint with the worker token."
        : "No action is required while the production app runs as a single Node process.",
      "docs/operations-runbook.md",
    ),
    phase(
      "supabase-persistence-cutover",
      "Supabase persistence cutover",
      supabaseCutoverStatus,
      publicEnvironment.backendMode === "supabase" ? "Supabase mode active" : "Not enabled",
      "Live persistence should wait for migrations, Vault-injected Supabase secrets, ownership/RLS checks, and first-admin bootstrap evidence.",
      publicEnvironment.backendMode === "supabase"
        ? "Resolve any Supabase-mode readiness warnings before relying on live persisted accounts."
        : "Keep `NUXT_PUBLIC_BACKEND_MODE=mock` until staging proves Supabase migrations, auth, admin bootstrap, and rollback.",
    ),
    phase(
      "external-auth-cutover",
      "External auth cutover",
      externalAuthStatus,
      input.hasOAuthProviderConfigured ? "Provider marker configured" : "Not enabled",
      "OAuth buttons and provider account linking should appear only after Supabase mode and a successful provider callback smoke test.",
      input.hasOAuthProviderConfigured
        ? "Confirm `/admin/operations` records `auth.oauth.signed_in` and readiness passes before public provider sign-in."
        : "Leave OAuth provider markers unset until Supabase auth and provider callback URLs are smoke-tested.",
    ),
    phase(
      "trust-and-agreement-providers",
      "Trust and agreement providers",
      trustAndAgreementStatus,
      input.hasTrustVerificationProviderConfigured || input.hasContractEnvelopeProviderConfigured ? "Provider marker configured" : "Not enabled",
      "Identity, domain, ownership, e-signature, and PDF provider callbacks should create evidence without automatically granting member-facing claims.",
      input.hasTrustVerificationProviderConfigured || input.hasContractEnvelopeProviderConfigured
        ? "Send provider smoke rows through the checked-in operations endpoints and confirm admin evidence before exposing provider-backed claims."
        : "Choose providers only after privacy, badge, document custody, and completed-PDF retention policy are explicit.",
    ),
    phase(
      "stripe-billing-cutover",
      "Stripe billing cutover",
      stripeCutoverStatus,
      stripeMode ? "Stripe mode active" : "Not enabled",
      "Live billing should wait for products, prices, signed webhooks, subscription reconciliation, customer portal configuration, and rollback.",
      stripeMode
        ? "Trigger a signed checkout/subscription webhook and confirm readiness evidence before exposing checkout broadly."
        : "Keep `NUXT_PUBLIC_BILLING_MODE=mock` until the Stripe account and webhook path are proven in staging.",
    ),
  ]
}

export function buildProductionReadinessSnapshot(input: ProductionReadinessInput): ProductionReadinessPayload {
  const nowTime = new Date(input.generatedAt).getTime()
  const { public: publicEnvironment } = input.environment
  const hasDeploymentIdentity = Boolean(input.deploymentMetadata.release || input.deploymentMetadata.commitSha)
  const deploymentIdentityStatus: ProductionReadinessStatus = hasDeploymentIdentity ? "pass" : input.isLocalDevelopment ? "info" : "warn"
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
  const emailSuppressions = input.operations.emailSuppressions || []
  const latestEmailSuppression = latestRow(emailSuppressions, ["suppressed_at", "created_at"])
  const latestEmailSuppressionTime = newestTime(latestEmailSuppression ? [latestEmailSuppression] : [], ["suppressed_at", "created_at"])
  const emailSuppressionDaysOld = daysSince(latestEmailSuppressionTime, nowTime)
  let emailSuppressionStatus: ProductionReadinessStatus = "info"
  if (input.hasEmailSuppressionProviderConfigured) {
    emailSuppressionStatus = !latestEmailSuppression || (emailSuppressionDaysOld !== null && emailSuppressionDaysOld > 30)
      ? "warn"
      : "pass"
  }
  const emailSuppressionSummary = latestEmailSuppression
    ? `${String(latestEmailSuppression.reason || "suppression")} from ${String(latestEmailSuppression.provider || "provider")}${emailSuppressionDaysOld === null ? "" : `, ${emailSuppressionDaysOld} day${emailSuppressionDaysOld === 1 ? "" : "s"} old`}`
    : input.hasEmailSuppressionProviderConfigured ? "Provider configured, no rows" : "No provider configured"
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
  const latestOAuthSignInEvent = latestMatchingEvent(input.operations.operationalEvents, isOAuthSignInEvent)
  const latestOAuthSignInTime = newestTime(latestOAuthSignInEvent ? [latestOAuthSignInEvent] : [], ["created_at"])
  const oauthSignInDaysOld = daysSince(latestOAuthSignInTime, nowTime)
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
    ? "Run `systemctl start cofoundry-operations-mail-smoke.service`, or `npm run operations:mail-smoke -- --to-email <monitored-inbox>` before unit templates are installed, and confirm the monitored inbox receives the message."
    : "Configure SMTP or sendmail CONTACT_* environment values."
  let externalAuthProviderStatus: ProductionReadinessStatus = "info"
  if (input.hasOAuthProviderConfigured) {
    externalAuthProviderStatus = publicEnvironment.backendMode !== "supabase" || !latestOAuthSignInEvent || (oauthSignInDaysOld !== null && oauthSignInDaysOld > 30)
      ? "warn"
      : "pass"
  }
  const externalAuthProviderSummary = input.hasOAuthProviderConfigured
    ? publicEnvironment.backendMode !== "supabase"
      ? "Provider marker configured before Supabase auth cutover"
      : latestOAuthSignInEvent
        ? `Successful OAuth callback${oauthSignInDaysOld === null ? "" : ` ${oauthSignInDaysOld} day${oauthSignInDaysOld === 1 ? "" : "s"} old`}`
        : "Provider configured, no successful OAuth callback"
    : "No provider configured"
  const externalAuthProviderDetail = input.hasOAuthProviderConfigured
    ? publicEnvironment.backendMode !== "supabase"
      ? "OAuth provider env markers are present while the deployment remains in mock/access-request mode, so users should not see or rely on live provider sign-in."
      : "OAuth provider env markers are present. Readiness expects a recent successful callback because provider app configuration, callback URLs, account linking, and role rehydration can only be proven by a smoke sign-in."
    : "CoFoundry keeps live OAuth disabled until a deliberate provider cutover. Email/password, invited local accounts, and operator-mediated access remain the supported production path until then."
  const realtimeFanoutStatus: ProductionReadinessStatus = input.hasRealtimeFanoutConfigured
    ? "pass"
    : input.expectsMultiInstanceRuntime ? "warn" : "info"
  const realtimeFanoutSummary = input.hasRealtimeFanoutConfigured
    ? "Fanout URL configured"
    : input.expectsMultiInstanceRuntime ? "Multi-instance expected, fanout missing" : "Process-local SSE"
  const realtimeFanoutDetail = input.hasRealtimeFanoutConfigured
    ? "Workspace invalidation and typing envelopes can be published to a server-side relay for delivery across app instances."
    : input.expectsMultiInstanceRuntime
      ? "This deployment declares more than one app instance, but realtime events remain process-local. Connected clients on other instances may wait for polling fallback instead of receiving push updates."
      : "Single-process deployments can use process-local SSE plus polling fallback without an external relay."
  const realtimeFanoutAction = input.hasRealtimeFanoutConfigured
    ? "Run a relay smoke that POSTs a signed envelope into `/api/operations/realtime-events` on each instance, then confirm a connected workspace client receives it."
    : input.expectsMultiInstanceRuntime
      ? "Set COFOUNDRY_REALTIME_FANOUT_URL to a server-side relay and have that relay POST signed envelopes to each app instance."
      : "Set COFOUNDRY_EXPECT_MULTI_INSTANCE=true only when the host actually runs multiple app instances."

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
    check(
      "realtime-fanout",
      "Workspace realtime fanout",
      realtimeFanoutStatus,
      realtimeFanoutSummary,
      realtimeFanoutDetail,
      realtimeFanoutAction,
    ),
    check(
      "deployment-identity",
      "Deployment identity",
      deploymentIdentityStatus,
      deploymentSummary(input.deploymentMetadata),
      hasDeploymentIdentity
        ? `Release ${input.deploymentMetadata.release || "not set"}${input.deploymentMetadata.commitSha ? `, commit ${shortCommit(input.deploymentMetadata.commitSha)}` : ""}${input.deploymentMetadata.deployedAt ? `, deployed ${input.deploymentMetadata.deployedAt}` : ""}.`
        : "Hosted operation should expose a release tag or commit SHA so operators can confirm what code is running during incidents and rollbacks.",
      "Set COFOUNDRY_RELEASE and COFOUNDRY_COMMIT_SHA from the deploy pipeline or host unit environment.",
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
      "external-auth-provider",
      "External auth provider",
      externalAuthProviderStatus,
      externalAuthProviderSummary,
      externalAuthProviderDetail,
      input.hasOAuthProviderConfigured
        ? "Unset OAuth provider markers for mock/access-request production, or run a staging provider sign-in smoke and confirm `auth.oauth.signed_in` telemetry before public cutover."
        : "Keep OAuth provider markers unset until live auth-provider cutover is explicitly authorized.",
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
      "email-suppression-evidence",
      "Email suppression provider evidence",
      emailSuppressionStatus,
      emailSuppressionSummary,
      input.hasEmailSuppressionProviderConfigured
        ? "The outbound mail provider should report suppression events so optional digests and workflow emails skip bounced, complained, unsubscribed, or manually suppressed recipients."
        : "Suppression-provider callbacks are optional until a real outbound mail provider is selected.",
      input.hasEmailSuppressionProviderConfigured
        ? "Run `npm run operations:worker -- email-suppression --email <recipient@example.com> --reason complaint --category all --provider <provider>` and confirm `/admin/operations` shows the row."
        : "Do not schedule real optional sends until provider suppression callbacks and preference links have been smoke-tested.",
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
      "Schedule `npm run operations:heartbeat -- --metadata schedule=hourly` and keep monitor failure events wired through `npm run operations:event`.",
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
        ? "Run `systemctl start cofoundry-operations-alert-smoke.service`, or `npm run operations:alert-smoke -- --metadata runbook=manual` before unit templates are installed, and confirm the external destination receives it."
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
      description: "Worker-reported evidence for backups, scanner status, digests, email suppressions, contract envelopes, trust-provider callbacks, Stripe webhooks, and operational alerts.",
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
      operationsRows: input.operations.backupRuns.length + contractEnvelopeEvents.length + emailSuppressions.length + input.operations.fileUploads.length + input.operations.notificationDeliveries.length + input.operations.operationalEvents.length + trustVerificationEvents.length,
      privacyRequestsOpen: privacyQueue.open.length,
      warningChecks,
    },
    cutoverPhases: buildCutoverPhases(input, checkById),
    deployment: input.deploymentMetadata,
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
