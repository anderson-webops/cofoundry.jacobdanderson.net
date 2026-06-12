import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildAdminAuditEntries, buildAdminBillingRows, buildAdminCommandQueue, buildAdminQueueSummary, buildAdminReportRows, buildAdminUserRows, filterAdminAuditEntries, filterAdminBillingRows, filterAdminReportRows, filterAdminUserRows } from "../../shared/utils/admin"

describe("admin utilities", () => {
  it("builds user rows with moderation context", () => {
    const rows = buildAdminUserRows(workspaceSeed)
    const olivia = rows.find(row => row.user.id === "user_olivia")

    expect(olivia).toBeDefined()
    expect(olivia?.subscription?.plan).toBe("pro")
    expect(olivia?.lastActiveAt).toBeTruthy()
  })

  it("filters reports by status, priority, and query", () => {
    const rows = buildAdminReportRows(workspaceSeed)
    const filtered = filterAdminReportRows(rows, {
      query: "investor",
      status: "open",
      priority: "high",
      targetType: "all",
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.report.reason).toBe("impersonation")
  })

  it("builds audit entries that resolve target labels", () => {
    const entries = buildAdminAuditEntries(workspaceSeed)
    const resolvedEntries = filterAdminAuditEntries(entries, {
      query: "arjun",
      actionType: "all",
      actorId: "all",
      targetType: "user",
    })

    expect(resolvedEntries.length).toBeGreaterThan(0)
    expect(resolvedEntries[0]?.targetLabel.toLowerCase()).toContain("arjun")
  })

  it("filters role-change audit entries", () => {
    const entries = buildAdminAuditEntries({
      ...workspaceSeed,
      adminActions: [
        {
          adminUserId: "user_ava",
          createdAt: "2026-05-09T12:00:00.000Z",
          id: "action_role_change",
          notes: "Changed Arjun role after admin review.",
          targetId: "user_arjun",
          targetType: "user",
          type: "change_user_role",
        },
        ...workspaceSeed.adminActions,
      ],
    })
    const filtered = filterAdminAuditEntries(entries, {
      actionType: "change_user_role",
      actorId: "all",
      query: "arjun",
      targetType: "user",
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.action.type).toBe("change_user_role")
  })

  it("filters privacy-request audit entries", () => {
    const entries = buildAdminAuditEntries({
      ...workspaceSeed,
      adminActions: [
        {
          adminUserId: "user_ava",
          createdAt: "2026-05-09T12:00:00.000Z",
          id: "action_privacy_review",
          notes: "Reviewed account deletion request and captured operator handling notes.",
          targetId: "privacy_request_1",
          targetType: "privacy_request",
          type: "review_privacy_request",
        },
        ...workspaceSeed.adminActions,
      ],
    })
    const filtered = filterAdminAuditEntries(entries, {
      actionType: "review_privacy_request",
      actorId: "all",
      query: "operator handling",
      targetType: "privacy_request",
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.targetLabel).toBe("Privacy request")
  })

  it("summarizes current moderation queue counts", () => {
    const summary = buildAdminQueueSummary(workspaceSeed)

    expect(summary.openReports).toBe(2)
    expect(summary.highPriorityReports).toBe(1)
    expect(summary.reviewedReports).toBe(0)
  })

  it("builds a priority-ordered command queue across admin surfaces", () => {
    const queue = buildAdminCommandQueue({
      accessRequests: [{
        adminNotes: null,
        company: "SignalDeck",
        companyStage: "mvp",
        createdAt: "2026-06-01T12:00:00.000Z",
        email: "founder@signaldeck.test",
        id: "access_stale",
        inviteAcceptedAt: null,
        inviteExpiresAt: null,
        inviteTokenIssuedAt: null,
        name: "Sam Founder",
        reviewedAt: null,
        reviewedByUserId: null,
        role: "founder",
        source: "site",
        status: "open",
        timeline: "now",
        updatedAt: "2026-06-01T12:00:00.000Z",
        useCase: "I need a serious cofounder search workflow with structured proposals.",
      }],
      generatedAt: "2026-06-12T12:00:00.000Z",
      privacyRequests: [{
        createdAt: "2026-06-10T12:00:00.000Z",
        details: "Please export my trust evidence and profile visibility data.",
        id: "privacy_export",
        resolutionNotes: null,
        resolvedAt: null,
        resolvedByUserId: null,
        reviewNotes: null,
        reviewedAt: null,
        reviewedByUserId: null,
        status: "open",
        type: "data_export",
        userId: "user_arjun",
      }],
      readinessChecks: [{
        action: "Run the scanner worker and resolve flagged files.",
        detail: "A flagged file scan is blocking launch readiness.",
        groupTitle: "Worker health",
        id: "file-scanning",
        status: "fail",
        summary: "1 failed or flagged",
        title: "File scanning",
      }],
      seed: workspaceSeed,
    })

    expect(queue[0]?.priority).toBe("critical")
    expect(queue.some(item => item.href === "/admin/reports" && item.kind === "moderation" && item.priority === "critical")).toBe(true)
    expect(queue.some(item => item.id === "readiness:file-scanning" && item.href === "/admin/operations" && item.priority === "critical")).toBe(true)
    expect(queue.some(item => item.id === "access:access_stale" && item.href === "/admin/access-requests" && item.priority === "high")).toBe(true)
    expect(queue.some(item => item.id === "privacy:privacy_export" && item.href === "/admin/privacy" && item.priority === "standard")).toBe(true)
  })

  it("filters billing rows by paid plan and query", () => {
    const rows = buildAdminBillingRows(workspaceSeed)
    const filtered = filterAdminBillingRows(rows, {
      query: "olivia",
      plan: "pro",
      status: "all",
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.subscription?.plan).toBe("pro")
  })

  it("filters users by suspension status", () => {
    const rows = buildAdminUserRows(workspaceSeed)
    const suspendedRows = filterAdminUserRows(rows, {
      query: "",
      role: "all",
      status: "suspended",
      onboarding: "all",
    })

    expect(suspendedRows).toHaveLength(0)
  })
})
