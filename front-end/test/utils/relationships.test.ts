import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import {
  buildRelationshipSnapshot,
  getRelationshipHrefForContract,
  getRelationshipHrefForConversation,
  getRelationshipHrefForProposal,
} from "../../shared/utils/relationships"

describe("relationship snapshots", () => {
  it("aggregates the participant relationship workspace from one match id", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_olivia", "match_olivia_malik")

    expect(snapshot?.counterpartProfile.userId).toBe("user_malik")
    expect(snapshot?.conversationId).toBe("conversation_olivia_malik")
    expect(snapshot?.latestMessages.length).toBeGreaterThan(0)
    expect(snapshot?.nextActions.length).toBeGreaterThan(0)
  })

  it("rejects non-participants", () => {
    expect(buildRelationshipSnapshot(workspaceSeed, "user_sofia", "match_olivia_malik")).toBeNull()
  })

  it("maps conversation, proposal, and contract records back to the same relationship workspace", () => {
    expect(getRelationshipHrefForConversation(workspaceSeed, "user_olivia", "conversation_olivia_malik")).toBe("/app/relationships/match_olivia_malik")
    expect(getRelationshipHrefForProposal(workspaceSeed, "user_malik", "proposal_ledgerloop_cto")).toBe("/app/relationships/match_olivia_malik")
    expect(getRelationshipHrefForContract(workspaceSeed, "user_olivia", "contract_ledgerloop")).toBe("/app/relationships/match_olivia_malik")
  })

  it("does not expose relationship hrefs to non-participants", () => {
    expect(getRelationshipHrefForConversation(workspaceSeed, "user_sofia", "conversation_olivia_malik")).toBeNull()
    expect(getRelationshipHrefForProposal(workspaceSeed, "user_sofia", "proposal_ledgerloop_cto")).toBeNull()
    expect(getRelationshipHrefForContract(workspaceSeed, "user_sofia", "contract_ledgerloop")).toBeNull()
  })

  it("prioritizes relationship actions that require the current member", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_malik", "match_olivia_malik")

    expect(snapshot?.nextActions.map(action => action.id)).toContain("proposal:proposal_ledgerloop_cto")
    expect(snapshot?.nextActions.map(action => action.id)).toContain("contract:contract_ledgerloop")
  })
})
