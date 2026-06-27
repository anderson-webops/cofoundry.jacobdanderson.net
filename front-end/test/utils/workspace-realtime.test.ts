import { beforeEach, describe, expect, it } from "vitest"
import {
  clearWorkspaceRealtimeSubscribersForTests,
  deliverWorkspaceRealtimeEnvelope,
  emitWorkspaceRealtimeChange,
  emitWorkspaceTypingPresence,
  getWorkspaceRealtimeSubscriberCount,
  safePushWorkspaceRealtimeSink,
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

  it("marks closed stream sinks without surfacing write failures", async () => {
    const state = { closed: false }
    const failed = await safePushWorkspaceRealtimeSink({
      push: async () => {
        throw new Error("WritableStream is closed")
      },
    }, {
      data: JSON.stringify({ userId: "user_one" }),
      event: "heartbeat",
    }, state)

    expect(failed).toBe(false)
    expect(state.closed).toBe(true)

    let writeCount = 0
    const skipped = await safePushWorkspaceRealtimeSink({
      push: () => {
        writeCount += 1
      },
    }, {
      data: JSON.stringify({ userId: "user_one" }),
      event: "heartbeat",
    }, state)

    expect(skipped).toBe(false)
    expect(writeCount).toBe(0)
  })

  it("delivers typing presence without persisting workspace state", async () => {
    const messages: Array<{ data: string, event: string }> = []
    subscribeWorkspaceRealtime("user_recipient", {
      push: (message) => {
        messages.push(message)
      },
    })

    const delivered = await emitWorkspaceTypingPresence(["user_recipient"], {
      conversationId: "conversation_1",
      isTyping: true,
      userId: "user_sender",
    })

    expect(delivered).toBe(1)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      event: "typing",
    })
    expect(JSON.parse(messages[0]!.data)).toMatchObject({
      conversationId: "conversation_1",
      isTyping: true,
      userId: "user_sender",
    })
  })

  it("delivers fanout envelopes to local subscribers", async () => {
    const messages: Array<{ data: string, event: string, id?: string }> = []
    subscribeWorkspaceRealtime("user_recipient", {
      push: (message) => {
        messages.push(message)
      },
    })

    const delivered = await deliverWorkspaceRealtimeEnvelope({
      createdAt: "2026-06-15T00:00:00.000Z",
      eventType: "workspace-change",
      idScope: "workspace.collaboration",
      messages: [{
        message: {
          data: JSON.stringify({
            createdAt: "2026-06-15T00:00:00.000Z",
            metadata: { action: "accept_intro" },
            source: "workspace.collaboration",
            userId: "user_recipient",
          }),
          event: "workspace-change",
          id: "2026-06-15T00:00:00.000Z:user_recipient:workspace.collaboration",
          retry: 5000,
        },
        userId: "user_recipient",
      }],
      sourceInstanceId: "instance_a",
      version: 1,
    })

    expect(delivered).toBe(1)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      event: "workspace-change",
      id: "2026-06-15T00:00:00.000Z:user_recipient:workspace.collaboration",
    })
  })

  it("dedupes fanout envelopes that loop back to the same instance", async () => {
    const messages: Array<{ data: string, event: string, id?: string }> = []
    const envelope = {
      createdAt: "2026-06-15T00:00:00.000Z",
      eventType: "typing",
      idScope: "typing:conversation_1:user_sender",
      messages: [{
        message: {
          data: JSON.stringify({
            conversationId: "conversation_1",
            createdAt: "2026-06-15T00:00:00.000Z",
            isTyping: true,
            userId: "user_sender",
          }),
          event: "typing",
          id: "2026-06-15T00:00:00.000Z:user_recipient:typing:conversation_1:user_sender",
          retry: 5000,
        },
        userId: "user_recipient",
      }],
      sourceInstanceId: "instance_a",
      version: 1,
    }

    subscribeWorkspaceRealtime("user_recipient", {
      push: (message) => {
        messages.push(message)
      },
    })

    expect(await deliverWorkspaceRealtimeEnvelope(envelope)).toBe(1)
    expect(await deliverWorkspaceRealtimeEnvelope(envelope)).toBe(0)
    expect(messages).toHaveLength(1)
  })
})
