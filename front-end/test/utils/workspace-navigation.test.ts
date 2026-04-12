import { describe, expect, it } from "vitest"
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
    expect(resolveWorkspaceRouteContext("/app/messages/conversation_123").title).toBe("Conversation")
    expect(resolveWorkspaceRouteContext("/app/proposals/proposal_123").title).toBe("Deal room")
    expect(resolveWorkspaceRouteContext("/app/contracts/contract_123").title).toBe("Agreement")
  })

  it("maps admin routes independently from member workspace routes", () => {
    const context = resolveWorkspaceRouteContext("/admin/reports")

    expect(context.areaLabel).toBe("Admin workspace")
    expect(context.title).toBe("Reports")
  })
})
