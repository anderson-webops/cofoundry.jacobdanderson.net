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
    id: "delivery_healthy",
    notification_count: 1,
    status: "sent",
  }],
  operationalEvents: [{
    created_at: generatedAt,
    event_type: "worker.heartbeat",
    id: "event_healthy",
    severity: "info",
  }],
}

describe("production readiness snapshot", () => {
  it("passes when deployment, secret, queue, and worker evidence is healthy", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
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
  })

  it("fails hosted production readiness when required launch controls are missing", () => {
    const snapshot = buildProductionReadinessSnapshot({
      accessRequests: [],
      contactMailConfigured: false,
      environment: environmentSnapshot({ appUrl: "" }),
      environmentValidationErrors: ["NUXT_PUBLIC_APP_URL must be configured."],
      generatedAt,
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
    expect(failedCheckIds).toEqual(expect.arrayContaining(["environment-validation", "public-app-url", "session-signing-secret"]))
    expect(warningCheckIds).toEqual(expect.arrayContaining(["mail-transport", "operations-worker-token", "local-durable-store", "backup-recency", "notification-digests"]))
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
      contactMailConfigured: true,
      environment: environmentSnapshot(),
      environmentValidationErrors: [],
      generatedAt,
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
})
