import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildRelationshipSnapshot } from "../../shared/utils/relationships"

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
})
