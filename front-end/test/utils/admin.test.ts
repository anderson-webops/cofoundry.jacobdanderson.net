import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildAdminAuditEntries, buildAdminQueueSummary, buildAdminReportRows, buildAdminUserRows, filterAdminAuditEntries, filterAdminReportRows, filterAdminUserRows } from "../../shared/utils/admin"

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

  it("summarizes current moderation queue counts", () => {
    const summary = buildAdminQueueSummary(workspaceSeed)

    expect(summary.openReports).toBe(2)
    expect(summary.highPriorityReports).toBe(1)
    expect(summary.reviewedReports).toBe(0)
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
