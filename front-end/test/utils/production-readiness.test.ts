import type { ProductionReadinessInput } from "../../server/utils/production-readiness"
import type { EnvironmentSnapshot } from "../../shared/utils/environment"
import { describe, expect, it } from "vitest"
import { buildProductionReadinessSnapshot as buildProductionReadinessSnapshotBase } from "../../server/utils/production-readiness"

const generatedAt = "2026-06-12T12:00:00.000Z"
const healthyDeploymentMetadata = {
  commitSha: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
  deployedAt: generatedAt,
  release: "v1.1.78",
}

function buildProductionReadinessSnapshot(input: Omit<ProductionReadinessInput, "deploymentMetadata"> & Partial<Pick<ProductionReadinessInput, "deploymentMetadata">>) {
  return buildProductionReadinessSnapshotBase({
    deploymentMetadata: healthyDeploymentMetadata,
    ...input,
  })
}

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
  contractEnvelopeEvents: [],
  emailSuppressions: [],
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
  trustVerificationEvents: [],
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
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })

    expect(snapshot.overallStatus).toBe("pass")
    expect(snapshot.deployment).toEqual(healthyDeploymentMetadata)
    expect(snapshot.score).toBe(100)
    expect(snapshot.counts.failedChecks).toBe(0)
    expect(snapshot.counts.warningChecks).toBe(0)
    expect(snapshot.groups.flatMap(group => group.checks).find(check => check.id === "deployment-identity")).toMatchObject({
      status: "pass",
      summary: "v1.1.78",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "backup-worker-provisioning")).toMatchObject({
      status: "pass",
      title: "Backup worker schedule",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "stripe-cutover-provisioning")).toMatchObject({
      status: "info",
      summary: "Stripe intentionally disabled",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "mail-provisioning")).toMatchObject({
      command: "CONTACT_SMTP_HOST=<smtp-host> CONTACT_FROM_EMAIL=support@cofoundry.dev CONTACT_TO_EMAIL=contacts@jacobdanderson.net\nCOFOUNDRY_MAIL_SMOKE_TO_EMAIL=contacts@jacobdanderson.net\nsystemctl start cofoundry-operations-mail-smoke.service",
      status: "pass",
      summary: "sent smoke, 0 days old",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "operations-unit-installer")).toMatchObject({
      command: "sudo deploy/systemd/install-operations-units.sh --dry-run\nsudo deploy/systemd/install-operations-units.sh",
      docsPath: "deploy/systemd/README.md",
      status: "pass",
      summary: "Worker telemetry current",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "monitoring-heartbeat-provisioning")).toMatchObject({
      command: "systemctl start cofoundry-operations-heartbeat.service\n# Direct fallback: npm run operations:heartbeat -- --metadata schedule=hourly",
      status: "pass",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "alert-webhook-provisioning")).toMatchObject({
      command: "COFOUNDRY_ALERT_WEBHOOK_URL=<server-only-webhook-url>\nsystemctl start cofoundry-operations-alert-smoke.service",
      status: "pass",
    })
    expect(snapshot.cutoverPhases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "durable-mock-baseline",
        status: "pass",
        summary: "Active production path",
      }),
      expect.objectContaining({
        id: "outbound-email-provider",
        status: "pass",
      }),
      expect.objectContaining({
        id: "operations-automation",
        status: "pass",
      }),
      expect.objectContaining({
        id: "supabase-persistence-cutover",
        status: "info",
        summary: "Not enabled",
      }),
      expect.objectContaining({
        id: "stripe-billing-cutover",
        status: "info",
        summary: "Not enabled",
      }),
    ]))
  })

  it("warns hosted operators when release or commit metadata is missing", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      deploymentMetadata: {
        commitSha: "",
        deployedAt: "",
        release: "",
      },
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })
    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("warn")
    expect(checkById.get("deployment-identity")).toMatchObject({
      status: "warn",
      summary: "No release metadata",
    })
    expect(snapshot.cutoverPhases.find(phase => phase.id === "durable-mock-baseline")).toMatchObject({
      status: "warn",
      summary: "Active production path",
    })
  })

  it("warns when OAuth provider markers are configured before live auth cutover", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOAuthProviderConfigured: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })
    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("warn")
    expect(checkById.get("external-auth-provider")).toMatchObject({
      status: "warn",
      summary: "Provider marker configured before Supabase auth cutover",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "external-auth-provider-provisioning")).toMatchObject({
      status: "warn",
      title: "External auth provider cutover",
    })
    expect(snapshot.cutoverPhases.find(phase => phase.id === "external-auth-cutover")).toMatchObject({
      status: "warn",
      summary: "Provider marker configured",
    })
  })

  it("passes OAuth provider readiness in Supabase mode after callback smoke evidence", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot({
        backendMode: "supabase",
        supabaseAnonKey: "anon-key",
        supabaseUrl: "https://cofoundry.supabase.co",
      }),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOAuthProviderConfigured: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        operationalEvents: [
          {
            actor_user_id: "user_olivia",
            created_at: generatedAt,
            event_type: "auth.oauth.signed_in",
            id: "event_oauth_smoke",
            metadata: { provider: "github" },
            severity: "info",
            source: "auth.oauth",
            target_id: "user_olivia",
            target_type: "user",
          },
          ...healthyOperations.operationalEvents,
        ],
      },
      privacyRequests: [],
    })
    const checkById = new Map(snapshot.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(snapshot.overallStatus).toBe("pass")
    expect(checkById.get("external-auth-provider")).toMatchObject({
      status: "pass",
      summary: "Successful OAuth callback 0 days old",
    })
    expect(snapshot.provisioningTasks.find(task => task.id === "external-auth-provider-provisioning")).toMatchObject({
      status: "pass",
      title: "External auth provider cutover",
    })
    expect(snapshot.cutoverPhases.find(phase => phase.id === "external-auth-cutover")).toMatchObject({
      status: "pass",
      summary: "Provider marker configured",
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
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: {
        backupRuns: [],
        fileUploads: [],
        mode: "mock",
        notificationDeliveries: [],
        operationalEvents: [],
        trustVerificationEvents: [],
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
        id: "operations-unit-installer",
        status: "warn",
      }),
      expect.objectContaining({
        id: "restore-drill-provisioning",
        status: "warn",
      }),
    ]))
    expect(snapshot.cutoverPhases.find(phase => phase.id === "durable-mock-baseline")).toMatchObject({
      status: "fail",
      summary: "Active production path",
    })
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
      hasTrustVerificationProviderConfigured: false,
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
      hasTrustVerificationProviderConfigured: false,
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
      hasTrustVerificationProviderConfigured: false,
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
      hasTrustVerificationProviderConfigured: false,
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
      hasTrustVerificationProviderConfigured: false,
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

  it("tracks trust-provider evidence only after a provider is configured", () => {
    const withoutEvidence = buildProductionReadinessSnapshot({
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
      hasTrustVerificationProviderConfigured: true,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })
    const withoutEvidenceCheckById = new Map(withoutEvidence.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withoutEvidence.overallStatus).toBe("warn")
    expect(withoutEvidenceCheckById.get("trust-verification-evidence")).toMatchObject({
      status: "warn",
      summary: "Provider configured, no rows",
    })

    const withEvidence = buildProductionReadinessSnapshot({
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
      hasTrustVerificationProviderConfigured: true,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        trustVerificationEvents: [{
          created_at: generatedAt,
          id: "trust_event_healthy",
          occurred_at: generatedAt,
          provider: "persona",
          status: "verified",
          target_id: "profile_user_olivia",
          target_type: "profile",
          verification_type: "government_id",
        }],
      },
      privacyRequests: [],
    })
    const withEvidenceCheckById = new Map(withEvidence.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withEvidence.overallStatus).toBe("pass")
    expect(withEvidenceCheckById.get("trust-verification-evidence")).toMatchObject({
      status: "pass",
      summary: "1 verified, 0 manual review, latest 0 days old",
    })
    expect(withEvidence.provisioningTasks.find(task => task.id === "trust-verification-provisioning")).toMatchObject({
      status: "pass",
      title: "Trust verification provider evidence",
    })
    expect(withoutEvidence.cutoverPhases.find(phase => phase.id === "trust-and-agreement-providers")).toMatchObject({
      status: "warn",
      summary: "Provider marker configured",
    })
    expect(withEvidence.cutoverPhases.find(phase => phase.id === "trust-and-agreement-providers")).toMatchObject({
      status: "pass",
      summary: "Provider marker configured",
    })
    expect(withEvidence.counts.operationsRows).toBe(healthyOperations.backupRuns.length + healthyOperations.fileUploads.length + healthyOperations.notificationDeliveries.length + healthyOperations.operationalEvents.length + 1)
  })

  it("requires processed Stripe webhook evidence only when Stripe billing mode is enabled", () => {
    const withoutWebhook = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot({
        billingMode: "stripe",
        stripePriceProMonthly: "price_pro",
        stripePriceTeamMonthly: "price_team",
        stripePublishableKey: "pk_test_example",
      }),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })
    const withoutWebhookCheckById = new Map(withoutWebhook.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withoutWebhook.overallStatus).toBe("warn")
    expect(withoutWebhookCheckById.get("stripe-webhook-evidence")).toMatchObject({
      status: "warn",
      summary: "Stripe mode enabled, no processed webhook",
    })
    expect(withoutWebhook.provisioningTasks.find(task => task.id === "stripe-cutover-provisioning")).toMatchObject({
      status: "warn",
      summary: "Stripe mode enabled, no processed webhook",
    })

    const withWebhook = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot({
        billingMode: "stripe",
        stripePriceProMonthly: "price_pro",
        stripePriceTeamMonthly: "price_team",
        stripePublishableKey: "pk_test_example",
      }),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        operationalEvents: [
          {
            created_at: generatedAt,
            event_type: "stripe.webhook.processed",
            id: "event_stripe_webhook",
            severity: "info",
            source: "stripe.webhook",
            target_id: "evt_123",
            target_type: "stripe_event",
          },
          ...healthyOperations.operationalEvents,
        ],
      },
      privacyRequests: [],
    })
    const withWebhookCheckById = new Map(withWebhook.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withWebhook.overallStatus).toBe("pass")
    expect(withWebhookCheckById.get("stripe-webhook-evidence")).toMatchObject({
      status: "pass",
      summary: "Last processed webhook 0 days old",
    })
    expect(withWebhook.provisioningTasks.find(task => task.id === "stripe-cutover-provisioning")).toMatchObject({
      status: "pass",
      summary: "Last processed webhook 0 days old",
    })
    expect(withoutWebhook.cutoverPhases.find(phase => phase.id === "stripe-billing-cutover")).toMatchObject({
      status: "warn",
      summary: "Stripe mode active",
    })
    expect(withWebhook.cutoverPhases.find(phase => phase.id === "stripe-billing-cutover")).toMatchObject({
      status: "pass",
      summary: "Stripe mode active",
    })
  })

  it("tracks contract-envelope provider evidence only after a provider is configured", () => {
    const withoutEvidence = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasContractEnvelopeProviderConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })
    const withoutEvidenceCheckById = new Map(withoutEvidence.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withoutEvidence.overallStatus).toBe("warn")
    expect(withoutEvidenceCheckById.get("contract-envelope-evidence")).toMatchObject({
      status: "warn",
      summary: "Provider configured, no rows",
    })

    const withEvidence = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasContractEnvelopeProviderConfigured: true,
      hasDurableLocalDataDir: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        contractEnvelopeEvents: [{
          completed_pdf_sha256: "a".repeat(64),
          contract_id: "contract_ledgerloop",
          contract_version_id: "version_1",
          created_at: generatedAt,
          id: "contract_provider_event_1",
          occurred_at: generatedAt,
          provider: "docusign",
          provider_envelope_id: "envelope_123",
          signed_by_user_ids: ["user_olivia", "user_malik"],
          status: "completed",
        }],
      },
      privacyRequests: [],
    })
    const withEvidenceCheckById = new Map(withEvidence.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withEvidence.overallStatus).toBe("pass")
    expect(withEvidenceCheckById.get("contract-envelope-evidence")).toMatchObject({
      status: "pass",
      summary: "1 completed, 0 declined/voided/failed, latest 0 days old",
    })
    expect(withEvidence.provisioningTasks.find(task => task.id === "contract-envelope-provisioning")).toMatchObject({
      status: "pass",
      title: "Contract envelope provider evidence",
    })
    expect(withoutEvidence.cutoverPhases.find(phase => phase.id === "trust-and-agreement-providers")).toMatchObject({
      status: "warn",
      summary: "Provider marker configured",
    })
    expect(withEvidence.cutoverPhases.find(phase => phase.id === "trust-and-agreement-providers")).toMatchObject({
      status: "pass",
      summary: "Provider marker configured",
    })
  })

  it("tracks email suppression provider evidence only after a provider is configured", () => {
    const withoutEvidence = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasEmailSuppressionProviderConfigured: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: healthyOperations,
      privacyRequests: [],
    })
    const withoutEvidenceCheckById = new Map(withoutEvidence.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withoutEvidence.overallStatus).toBe("warn")
    expect(withoutEvidenceCheckById.get("email-suppression-evidence")).toMatchObject({
      status: "warn",
      summary: "Provider configured, no rows",
    })

    const withEvidence = buildProductionReadinessSnapshot({
      accessRequests: [],
      adminPosture: healthyAdminPosture,
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
      hasAlertWebhookConfigured: true,
      hasDurableLocalDataDir: true,
      hasEmailSuppressionProviderConfigured: true,
      hasOperationsWorkerToken: true,
      hasSessionSigningSecret: true,
      hasTrustVerificationProviderConfigured: false,
      isLocalDevelopment: false,
      operations: {
        ...healthyOperations,
        emailSuppressions: [{
          category: "all",
          created_at: generatedAt,
          email: "suppressed@example.com",
          id: "email_suppression_1",
          provider: "postmark",
          reason: "complaint",
          source_event_id: "provider_suppression_event_1",
          suppressed_at: generatedAt,
        }],
      },
      privacyRequests: [],
    })
    const withEvidenceCheckById = new Map(withEvidence.groups.flatMap(group => group.checks).map(check => [check.id, check]))

    expect(withEvidence.overallStatus).toBe("pass")
    expect(withEvidenceCheckById.get("email-suppression-evidence")).toMatchObject({
      status: "pass",
      summary: "complaint from postmark, 0 days old",
    })
    expect(withEvidence.provisioningTasks.find(task => task.id === "email-suppression-provisioning")).toMatchObject({
      status: "pass",
      title: "Email suppression provider evidence",
    })
    expect(withoutEvidence.cutoverPhases.find(phase => phase.id === "outbound-email-provider")).toMatchObject({
      status: "warn",
      summary: "Mail transport configured",
    })
    expect(withEvidence.cutoverPhases.find(phase => phase.id === "outbound-email-provider")).toMatchObject({
      status: "pass",
      summary: "Mail transport configured",
    })
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
      hasTrustVerificationProviderConfigured: false,
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
    expect(snapshot.cutoverPhases.find(phase => phase.id === "supabase-persistence-cutover")).toMatchObject({
      status: "warn",
      summary: "Supabase mode active",
    })
  })
})
