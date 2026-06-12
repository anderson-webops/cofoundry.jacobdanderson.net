import type { H3Event } from "h3"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { persistAdminAction, persistReportStatus, persistUserNotification, persistUserRole, persistUserSuspension } from "../../server/utils/admin-persistence"
import { clearLocalAdminAuditStoreForTests, mergeLocalAdminAuditState, readLocalAdminAuditStore } from "../../server/utils/local-admin-audit"
import { workspaceSeed } from "../../shared/data/seed"

let dataDirectory: string

describe("local admin audit store", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-admin-audit-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    process.env.COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT = "50"
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
    const createdAt = "2026-06-12T18:00:00.000Z"

    await persistUserSuspension({} as H3Event, targetUserId, createdAt)
    await persistUserRole({} as H3Event, targetUserId, "admin")
    await persistReportStatus({} as H3Event, {
      adminUserId: "user_ava",
      notes: "Reviewed report in local production mode.",
      reportId,
      status: "reviewed",
      timestamp: createdAt,
    })
    await persistAdminAction({} as H3Event, {
      adminUserId: "user_ava",
      createdAt,
      id: "admin_action_local",
      notes: "Suspended account after review.",
      targetId: targetUserId,
      targetType: "user",
      type: "suspend_user",
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
      type: "suspend_user",
    })
    expect(mergedSeed.users.find(user => user.id === targetUserId)).toMatchObject({
      role: "admin",
      suspendedAt: createdAt,
    })
    expect(mergedSeed.reports.find(report => report.id === reportId)).toMatchObject({
      reviewNotes: "Reviewed report in local production mode.",
      reviewedAt: createdAt,
      reviewedByUserId: "user_ava",
      status: "reviewed",
    })
    expect(mergedSeed.notifications[0]).toMatchObject({
      id: "notification_local",
      userId: targetUserId,
    })
  })

  it("enforces local admin audit retention", async () => {
    for (let index = 0; index < 55; index += 1) {
      await persistAdminAction({} as H3Event, {
        adminUserId: "user_ava",
        createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        id: `admin_action_${index}`,
        notes: `Retention action ${index}.`,
        targetId: "user_target",
        targetType: "user",
        type: "warn_user",
      })
    }

    const store = await readLocalAdminAuditStore()

    expect(store.actions).toHaveLength(50)
    expect(store.actions[0]?.id).toBe("admin_action_54")
  }, 15_000)
})
