import type { EnvironmentSnapshot } from "../../shared/utils/environment"
import { describe, expect, it } from "vitest"
import { buildProductionReadinessSnapshot } from "../../server/utils/production-readiness"

const generatedAt = "2026-06-12T12:00:00.000Z"

function environmentSnapshot(overrides: Partial<EnvironmentSnapshot["public"]> = {}): EnvironmentSnapshot {
  return {
    public: {
      appUrl: "https://cofoundry.example",
      backendMode: "mock",
      billingMode: "mock",
      enableDemoAccess: false,
      featureInvestmentModule: false,
      stripePriceProMonthly: "",
      stripePriceTeamMonthly: "",
      stripePublishableKey: "",
      supabaseAnonKey: "",
      supabaseUrl: "",
      supportEmail: "support@cofoundry.dev",
      ...overrides,
    },
    secret: {
      operationsWorkerToken: "worker-secret",
      sessionSigningSecret: "session-secret",
      stripeSecretKey: "",
      stripeWebhookSecret: "",
      supabaseServiceRoleKey: "",
    },
  }
}

const healthyOperations = {
  backupRuns: [{
    completed_at: generatedAt,
    created_at: generatedAt,
    id: "backup_healthy",
    started_at: generatedAt,
    status: "succeeded",
  }],
  fileUploads: [{
    created_at: generatedAt,
    id: "upload_clean",
    scan_status: "clean",
    status: "uploaded",
    updated_at: generatedAt,
  }],
  mode: "mock",
  notificationDeliveries: [{
    created_at: generatedAt,
    event_type: "digest.unread",
    id: "delivery_healthy",
    notification_count: 1,
    status: "sent",
  }, {
    created_at: generatedAt,
    delivered_at: generatedAt,
    event_type: "mail.smoke",
    id: "delivery_mail_smoke",
    notification_count: 0,
    status: "sent",
  }],
  operationalEvents: [
    {
      created_at: generatedAt,
      event_type: "worker.heartbeat",
      id: "event_healthy",
      severity: "info",
      source: "operations-worker",
    },
    {
      created_at: generatedAt,
      event_type: "restore_drill_succeeded",
      id: "event_restore_drill",
      severity: "info",
      source: "restore-drill-worker",
      target_type: "restore_drill",
    },
    {
      created_at: generatedAt,
      event_type: "monitoring.heartbeat",
      id: "event_monitoring",
      severity: "info",
      source: "uptime-monitor",
    },
    {
      created_at: generatedAt,
      event_type: "monitoring.alert_test",
      id: "event_alert_smoke",
      severity: "warning",
      source: "uptime-monitor",
    },
  ],
}

const healthyAdminPosture = {
  activeAdminCount: 1,
  activeInvestorAdminCount: 0,
  hasBootstrapAuditEvidence: true,
  latestBootstrapAuditAt: generatedAt,
}

describe("production readiness snapshot", () => {
  it("passes when deployment, secret, queue, and worker evidence is healthy", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })

    expect(snapshot.overallStatus).toBe("pass")
    expect(snapshot.score).toBe(100)
    expect(snapshot.counts.failedChecks).toBe(0)
    expect(snapshot.counts.warningChecks).toBe(0)
    expect(snapshot.provisioningTasks.find(task => task.id === "backup-worker-provisioning")).toMatchObject({
      status: "pass",
      title: "Backup worker schedule",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "stripe-cutover-provisioning")).toMatchObject({
      status: "info",
      summary: "Stripe intentionally disabled",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "mail-provisioning")).toMatchObject({
      status: "pass",
      summary: "sent smoke, 0 days old",
    })
  })

  it("fails hosted production readiness when required launch controls are missing", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: {
        activeAdminCount: 0,
        activeInvestorAdminCount: 0,
        hasBootstrapAuditEvidence: false,
        latestBootstrapAuditAt: null,
      },
      contactMailConfigured: false,
      environment: environmentSnapshot({ appUrl: "" }),
      environmentValidationErrors: ["NUXT_PUBLIC_APP_URL must be configured."],
      generatedAt,
      hasAlertWebhookConfigured: false,
      hasDurableLocalDataDir: false,
      hasOperationsWorkerToken: false,
      hasSessionSigningSecret: false,
      isLocalDevelopment: false,
      operations: {
        backupRuns: [],
        fileUploads: [],
        mode: "mock",
        notificationDeliveries: [],
        operationalEvents: [],
      },
      privacyRequests: [],
    })

    const failedCheckIds = snapshot.groups.flatMap(group => group.checks).filter(check => check.status === "fail").map(check => check.id)
    const warningCheckIds = snapshot.groups.flatMap(group => group.checks).filter(check => check.status === "warn").map(check => check.id)

    expect(snapshot.overallStatus).toBe("fail")
    expect(failedCheckIds).toEqual(expect.arrayContaining(["environment-validation", "public-app-url", "session-signing-secret", "active-admin-access"]))
    expect(warningCheckIds).toEqual(expect.arrayContaining(["mail-transport", "operations-worker-token", "local-durable-store", "backup-recency", "notification-digests", "restore-drill", "monitoring-heartbeat", "alert-webhook-destination"]))
    expect(snapshot.provisioningTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: "SESSION_SIGNING_SECRET=<vault-managed-random-secret>",
        id: "session-secret-provisioning",
        status: "fail",
      }),
      expect.objectContaining({
        id: "worker-token-provisioning",
        status: "warn",
      }),
      expect.objectContaining({
        id: "restore-drill-provisioning",
        status: "warn",
      }),
    ]))
  })

  it("warns on stale operator queues and fails flagged file scans", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [{
        adminNotes: null,
        company: "LedgerLoop",
        companyStage: "prototype",
        createdAt: "2026-05-01T00:00:00.000Z",
        email: "founder@example.com",
        id: "access_stale",
        inviteAcceptedAt: null,
        inviteExpiresAt: null,
        inviteTokenIssuedAt: null,
        name: "Founder",
        reviewedAt: null,
        reviewedByUserId: null,
        role: "founder",
        source: "test",
        status: "open",
        timeline: "30_days",
        updatedAt: "2026-05-01T00:00:00.000Z",
        useCase: "I need a founder matching workspace for a serious collaborator search.",
      }],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        fileUploads: [{
          created_at: generatedAt,
          id: "upload_flagged",
          scan_status: "flagged",
          status: "blocked",
          updated_at: generatedAt,
        }],
      },
      privacyRequests: [{
        createdAt: "2026-05-30T00:00:00.000Z",
        details: "Please review a trust evidence package and privacy concern for this workspace.",
        id: "privacy_stale",
        resolutionNotes: null,
        resolvedAt: null,
        resolvedByUserId: null,
        reviewNotes: null,
        reviewedAt: null,
        reviewedByUserId: null,
        status: "open",
        type: "safety_privacy",
        userId: "user_founder",
      }],
    })

    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("fail")
    expect(checkById.get("access-request-queue")?.status).toBe("warn")
    expect(checkById.get("privacy-request-queue")?.status).toBe("warn")
    expect(checkById.get("file-scanning")?.status).toBe("fail")
  })

  it("warns when restore drills and monitoring heartbeats are stale or missing", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        operationalEvents: [{
          created_at: generatedAt,
          event_type: "worker.heartbeat",
          id: "event_worker_only",
          severity: "info",
          source: "operations-worker",
        }],
      },
      privacyRequests: [],
    })
    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("warn")
    expect(checkById.get("restore-drill")?.status).toBe("warn")
    expect(checkById.get("monitoring-heartbeat")?.status).toBe("warn")
    expect(checkById.get("alert-webhook-destination")?.status).toBe("warn")
  })

  it("requires recent successful mail smoke evidence when mail is configured", () => {
    const withoutSmoke = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        notificationDeliveries: healthyOperations.notificationDeliveries.filter(row => row.event_type !== "mail.smoke"),
      },
      privacyRequests: [],
    })
    const withoutSmokeCheckById = new Map(withoutSmoke.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withoutSmoke.overallStatus).toBe("warn")
    expect(withoutSmokeCheckById.get("mail-transport")?.status).toBe("warn")

    const failedSmoke = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        notificationDeliveries: healthyOperations.notificationDeliveries.map(row => row.event_type === "mail.smoke"
          ? { ...row, status: "failed" }
          : row),
      },
      privacyRequests: [],
    })
    const failedSmokeCheckById = new Map(failedSmoke.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(failedSmoke.overallStatus).toBe("fail")
    expect(failedSmokeCheckById.get("mail-transport")?.status).toBe("fail")
  })

  it("fails when the latest restore drill failed", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        operationalEvents: [
          {
            created_at: "2026-06-01T12:00:00.000Z",
            event_type: "restore_drill_succeeded",
            id: "event_restore_old",
            severity: "info",
            source: "restore-drill-worker",
            target_type: "restore_drill",
          },
          {
            created_at: generatedAt,
            event_type: "restore_drill_failed",
            id: "event_restore_failed",
            severity: "error",
            source: "restore-drill-worker",
            target_type: "restore_drill",
          },
          {
            created_at: generatedAt,
            event_type: "monitoring.heartbeat",
            id: "event_monitoring",
            severity: "info",
            source: "uptime-monitor",
          },
          {
            created_at: generatedAt,
            event_type: "monitoring.alert_test",
            id: "event_alert_smoke",
            severity: "warning",
            source: "uptime-monitor",
          },
        ],
      },
      privacyRequests: [],
    })
    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("fail")
    expect(checkById.get("restore-drill")?.status).toBe("fail")
  })

  it("warns in Supabase mode until first-admin bootstrap evidence exists", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: {
        activeAdminCount: 1,
        activeInvestorAdminCount: 0,
        hasBootstrapAuditEvidence: false,
        latestBootstrapAuditAt: null,
      },
      contactMailConfigured: true,
      environment: environmentSnapshot({
        backendMode: "supabase",
        supabaseAnonKey: "anon-key",
        supabaseUrl: "https://supabase.example",
      }),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: false,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        mode: "supabase",
      },
      privacyRequests: [],
    })
    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("warn")
    expect(checkById.get("active-admin-access")?.status).toBe("pass")
    expect(checkById.get("admin-bootstrap-audit")?.status).toBe("warn")
    expect(snapshot.provisioningTasks.find(task => task.id === "first-admin-bootstrap-provisioning")).toMatchObject({
      command: "BOOTSTRAP_ADMIN_EMAIL=operator@example.com npm run -w back-end bootstrap-admin",
      docsPath: "docs/server-ai-admin-bootstrap-prompt.md",
      status: "warn",
    })
  })
})
