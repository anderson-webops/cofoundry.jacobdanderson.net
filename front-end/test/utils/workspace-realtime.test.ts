import { beforeEach, describe, expect, it } from "vitest"
import {
  clearWorkspaceRealtimeSubscribersForTests,
  emitWorkspaceRealtimeChange,
  getWorkspaceRealtimeSubscriberCount,
  subscribeWorkspaceRealtime,
} from "../../server/utils/workspace-realtime"

describe("workspace realtime hub", () => {
  beforeEach(() => {
    clearWorkspaceRealtimeSubscribersForTests()
  })

  it("delivers workspace invalidation events only to affected users", async () => {
    const userOneMessages: Array<{ data: string, event: string }> = []
    const userTwoMessages: Array<{ data: string, event: string }> = []

    const unsubscribeOne = subscribeWorkspaceRealtime("user_one", {
      push: (message) => {
        userOneMessages.push(message)
      },
    })
    subscribeWorkspaceRealtime("user_two", {
      push: (message) => {
        userTwoMessages.push(message)
      },
    })

    const delivered = await emitWorkspaceRealtimeChange(["user_one"], {
      metadata: { action: "send_message" },
      source: "workspace.collaboration",
    })

    expect(delivered).toBe(1)
    expect(userOneMessages).toHaveLength(1)
    expect(userOneMessages[0]).toMatchObject({
      event: "workspace-change",
    })
    expect(JSON.parse(userOneMessages[0]!.data)).toMatchObject({
      metadata: { action: "send_message" },
      source: "workspace.collaboration",
      userId: "user_one",
    })
    expect(userTwoMessages).toHaveLength(0)

    unsubscribeOne()
    expect(getWorkspaceRealtimeSubscriberCount("user_one")).toBe(0)
    expect(getWorkspaceRealtimeSubscriberCount("user_two")).toBe(1)
  })

  it("removes sinks that fail during delivery", async () => {
    subscribeWorkspaceRealtime("user_one", {
      push: async () => {
        throw new Error("closed")
      },
    })

    const delivered = await emitWorkspaceRealtimeChange(["user_one"], {
      source: "workspace.member",
    })

    expect(delivered).toBe(0)
    expect(getWorkspaceRealtimeSubscriberCount("user_one")).toBe(0)
  })
})
