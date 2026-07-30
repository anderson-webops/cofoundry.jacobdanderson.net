import type { H3Event } from "h3"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { persistAdminAction, persistAdminReportStatusAction, persistAdminUserSecurityAction, persistOpportunityVerificationAction, persistUserNotification } from "../../server/utils/admin-persistence"
import { clearLocalAdminAuditStoreForTests, mergeLocalAdminAuditState, readLocalAdminAuditStore } from "../../server/utils/local-admin-audit"
import { workspaceSeed } from "../../shared/data/seed"

let dataDirectory: string

describe("local admin audit store", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-admin-audit-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    process.env.COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT = "5"
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        backendMode: "mock",
      },
    }))
    await clearLocalAdminAuditStoreForTests()
  })

  afterEach(async () => {
    await clearLocalAdminAuditStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    delete process.env.COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT
    vi.unstubAllGlobals()
  })

  it("persists mock-mode admin actions and overlays workspace state", async () => {
    const targetUserId = workspaceSeed.users.find(user => user.role === "collaborator")?.id || workspaceSeed.users[0]!.id
    const reportId = workspaceSeed.reports[0]!.id
    const opportunityId = workspaceSeed.opportunities[0]!.id
    const createdAt = "2026-06-12T18:00:00.000Z"

    await persistAdminUserSecurityAction({} as H3Event, {
      action: {
        adminUserId: "user_ava",
        createdAt,
        id: "admin_action_role",
        notes: "Promoted after a documented privileged-access review.",
        targetId: targetUserId,
        targetType: "user",
        type: "change_user_role",
      },
      mutation: {
        kind: "change_role",
        role: "admin",
      },
    })
    await persistAdminUserSecurityAction({} as H3Event, {
      action: {
        adminUserId: "user_ava",
        createdAt,
        id: "admin_action_suspend",
        notes: "Suspended after a documented account-security review.",
        targetId: targetUserId,
        targetType: "user",
        type: "suspend_user",
      },
      mutation: {
        action: "suspend",
        kind: "change_status",
      },
    })
    await persistAdminReportStatusAction({} as H3Event, {
      action: {
        adminUserId: "user_ava",
        createdAt,
        id: "admin_action_report",
        notes: "Reviewed report in local production mode.",
        targetId: reportId,
        targetType: "report",
        type: "review_report",
      },
      expectedStatus: "open",
      status: "reviewed",
    })
    const opportunity = workspaceSeed.opportunities.find(item => item.id === opportunityId)!
    await persistOpportunityVerificationAction({} as H3Event, {
      action: {
        adminUserId: "user_ava",
        createdAt,
        id: "admin_action_opportunity",
        notes: "Reviewed opportunity ownership proof in local production mode.",
        targetId: opportunityId,
        targetType: "opportunity",
        type: "review_evidence",
      },
      expectedUpdatedAt: opportunity.updatedAt,
      status: "domain_verified",
    })
    await persistAdminAction({} as H3Event, {
      adminUserId: "user_ava",
      createdAt,
      id: "admin_action_local",
      notes: "Suspended account after review.",
      targetId: targetUserId,
      targetType: "readiness_check",
      type: "assign_case",
    })
    await persistUserNotification({} as H3Event, {
      body: "An operator reviewed your request.",
      createdAt,
      href: "/app/settings",
      id: "notification_local",
      readAt: null,
      title: "Admin review complete",
      type: "admin",
      userId: targetUserId,
    })

    const mergedSeed = await mergeLocalAdminAuditState(structuredClone(workspaceSeed))

    expect(mergedSeed.adminActions[0]).toMatchObject({
      id: "admin_action_local",
      targetId: targetUserId,
      type: "assign_case",
    })
    expect(mergedSeed.users.find(user => user.id === targetUserId)).toMatchObject({
      role: "admin",
      suspendedAt: createdAt,
      verifiedEmail: true,
    })
    expect(mergedSeed.profiles.find(profile => profile.userId === targetUserId)?.verificationBadges).toMatchObject({
      emailVerified: true,
    })
    expect(mergedSeed.reports.find(report => report.id === reportId)).toMatchObject({
      reviewNotes: "Reviewed report in local production mode.",
      reviewedAt: createdAt,
      reviewedByUserId: "user_ava",
      status: "reviewed",
    })
    expect(mergedSeed.opportunities.find(opportunity => opportunity.id === opportunityId)).toMatchObject({
      updatedAt: createdAt,
      verificationStatus: "domain_verified",
    })
    expect(mergedSeed.notifications[0]).toMatchObject({
      id: "notification_local",
      userId: targetUserId,
    })
  })

  it("enforces local admin audit retention", async () => {
    for (let index = 0; index < 10; index += 1) {
      await persistAdminAction({} as H3Event, {
        adminUserId: "user_ava",
        createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        id: `admin_action_${index}`,
        notes: `Retention action ${index}.`,
        targetId: "user_target",
        targetType: "readiness_check",
        type: "assign_case",
      })
    }

    const store = await readLocalAdminAuditStore()

    expect(store.actions).toHaveLength(5)
    expect(store.actions[0]?.id).toBe("admin_action_9")
  }, 15_000)

  it("rejects queue actions from a suspended local admin", async () => {
    const replacementAdminId = workspaceSeed.users.find(user => user.role === "collaborator")!.id
    await persistAdminUserSecurityAction({} as H3Event, {
      action: {
        adminUserId: "user_ava",
        createdAt: "2026-06-12T17:58:00.000Z",
        id: "admin_action_promote_replacement",
        notes: "Promoted after a documented privileged-access review.",
        targetId: replacementAdminId,
        targetType: "user",
        type: "change_user_role",
      },
      mutation: {
        kind: "change_role",
        role: "admin",
      },
    })
    await persistAdminUserSecurityAction({} as H3Event, {
      action: {
        adminUserId: replacementAdminId,
        createdAt: "2026-06-12T18:00:00.000Z",
        id: "admin_action_suspend_original",
        notes: "Suspended after a documented account-security review.",
        targetId: "user_ava",
        targetType: "user",
        type: "suspend_user",
      },
      mutation: {
        action: "suspend",
        kind: "change_status",
      },
    })

    await expect(persistAdminAction({} as H3Event, {
      adminUserId: "user_ava",
      createdAt: "2026-06-12T18:01:00.000Z",
      id: "admin_action_suspended",
      notes: "Attempted a queue action after account suspension.",
      targetId: "readiness-check",
      targetType: "readiness_check",
      type: "assign_case",
    })).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
