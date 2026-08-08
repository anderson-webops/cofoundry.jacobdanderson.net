import { describe, expect, it } from "vitest"
import { adminNavigation } from "../../shared/constants/app"
import { resolveWorkspaceRouteContext } from "../../shared/utils/workspace-navigation"

describe("workspace route context", () => {
  it("maps overview routes to a clear workspace label", () => {
    expect(resolveWorkspaceRouteContext("/app")).toEqual({
      areaLabel: "Workspace",
      title: "Overview",
      description: "See what needs attention now across discovery, intros, proposals, and agreements.",
    })
  })

  it("maps nested workspace routes to the correct detail context", () => {
    expect(resolveWorkspaceRouteContext("/app/activation").title).toBe("Activation")
    expect(resolveWorkspaceRouteContext("/app/inbox").title).toBe("Inbox")
    expect(resolveWorkspaceRouteContext("/app/messages/conversation_123").title).toBe("Conversation")
    expect(resolveWorkspaceRouteContext("/app/relationships/match_123").title).toBe("Relationship")
    expect(resolveWorkspaceRouteContext("/app/proposals/proposal_123").title).toBe("Deal room")
    expect(resolveWorkspaceRouteContext("/app/contracts/contract_123").title).toBe("Agreement")
    expect(resolveWorkspaceRouteContext("/app/legal").title).toBe("Legal review")
  })

  it("maps admin routes independently from member workspace routes", () => {
    const context = resolveWorkspaceRouteContext("/admin/reports")

    expect(context.areaLabel).toBe("Admin workspace")
    expect(context.title).toBe("Reports")
  })

  it("keeps every admin navigation route out of the generic fallback context", () => {
    const expectedTitles: Record<string, string> = {
      "/admin": "Overview",
      "/admin/access-requests": "Access requests",
      "/admin/analytics": "Analytics",
      "/admin/audit": "Audit log",
      "/admin/billing": "Billing",
      "/admin/evidence": "Evidence",
      "/admin/operations": "Operations",
      "/admin/privacy": "Privacy",
      "/admin/queue": "Command queue",
      "/admin/readiness": "Launch readiness",
      "/admin/reports": "Reports",
      "/admin/users": "Users",
    }

    expect(Object.keys(expectedTitles).sort()).toEqual(adminNavigation.map(item => item.to).sort())

    for (const item of adminNavigation) {
      const context = resolveWorkspaceRouteContext(item.to)

      expect(context.areaLabel).toBe("Admin workspace")
      expect(context.title).toBe(expectedTitles[item.to])
    }
  })
})
