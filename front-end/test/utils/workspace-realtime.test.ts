import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearWorkspaceRealtimeSubscribersForTests,
  deliverWorkspaceRealtimeEnvelope,
  emitWorkspaceRealtimeChange,
  emitWorkspaceTypingPresence,
  getWorkspaceRealtimeSubscriberCount,
  resolveWorkspaceRealtimeFanoutDestination,
  safePushWorkspaceRealtimeSink,
  subscribeWorkspaceRealtime,
} from "../../server/utils/workspace-realtime"

describe("workspace realtime hub", () => {
  beforeEach(() => {
    clearWorkspaceRealtimeSubscribersForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it("drops a realtime sink that never settles instead of blocking a workspace write", async () => {
    vi.useFakeTimers()
    const close = vi.fn()
    subscribeWorkspaceRealtime("user_one", {
      close,
      push: () => new Promise<void>(() => {}),
    })

    const delivery = emitWorkspaceRealtimeChange(["user_one"], {
      source: "workspace.member",
    })
    await vi.advanceTimersByTimeAsync(1_000)

    expect(await delivery).toBe(0)
    expect(close).toHaveBeenCalledOnce()
    expect(getWorkspaceRealtimeSubscriberCount("user_one")).toBe(0)
  })

  it("caps long-lived realtime connections per account", () => {
    const subscriptions = Array.from({ length: 5 }, () => subscribeWorkspaceRealtime("user_one", {
      push: () => {},
    }))

    expect(getWorkspaceRealtimeSubscriberCount("user_one")).toBe(5)
    expect(() => subscribeWorkspaceRealtime("user_one", {
      push: () => {},
    })).toThrow(/capacity/)

    subscriptions.forEach(unsubscribe => unsubscribe())
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
      messages: [
        {
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
        }
      ],
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
      messages: [
        {
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
        }
      ],
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

  it("rejects oversized or partially malformed worker fanout envelopes", async () => {
    const baseMessage = {
      message: {
        data: JSON.stringify({ userId: "user_recipient" }),
        event: "workspace-change" as const,
        id: "message-id",
        retry: 5000,
      },
      userId: "user_recipient",
    }
    const baseEnvelope = {
      createdAt: "2026-06-15T00:00:00.000Z",
      eventType: "workspace-change" as const,
      idScope: "workspace.collaboration",
      sourceInstanceId: "instance_a",
      version: 1 as const,
    }

    expect(await deliverWorkspaceRealtimeEnvelope({
      ...baseEnvelope,
      messages: Array.from({ length: 501 }).fill(baseMessage),
    })).toBe(0)

    expect(await deliverWorkspaceRealtimeEnvelope({
      ...baseEnvelope,
      messages: [
        baseMessage,
        {
          ...baseMessage,
          userId: "",
        },
      ],
    })).toBe(0)
  })

  it("keeps the operations token on same-origin fanout and uses a separate cross-origin token", () => {
    expect(resolveWorkspaceRealtimeFanoutDestination({
      COFOUNDRY_OPERATIONS_TOKEN: "same-origin-operations-token-at-least-32",
      COFOUNDRY_REALTIME_FANOUT_URL: "https://cofoundry.example/api/operations/realtime-events",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    })).toMatchObject({
      token: "same-origin-operations-token-at-least-32",
    })

    expect(resolveWorkspaceRealtimeFanoutDestination({
      COFOUNDRY_OPERATIONS_TOKEN: "operations-token-that-must-not-leak",
      COFOUNDRY_REALTIME_FANOUT_TOKEN: "cross-origin-realtime-token-at-least-32",
      COFOUNDRY_REALTIME_FANOUT_URL: "https://relay.example/events",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    })).toMatchObject({
      token: "cross-origin-realtime-token-at-least-32",
    })
  })

  it("rejects insecure or unauthenticated realtime fanout destinations", () => {
    expect(() => resolveWorkspaceRealtimeFanoutDestination({
      COFOUNDRY_OPERATIONS_TOKEN: "operations-token-that-must-not-leak",
      COFOUNDRY_REALTIME_FANOUT_URL: "https://relay.example/events",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    })).toThrow(/distinct COFOUNDRY_REALTIME_FANOUT_TOKEN/)

    expect(() => resolveWorkspaceRealtimeFanoutDestination({
      COFOUNDRY_REALTIME_FANOUT_TOKEN: "cross-origin-realtime-token-at-least-32",
      COFOUNDRY_REALTIME_FANOUT_URL: "http://relay.example/events",
      NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    })).toThrow(/credential-free HTTPS URL/)
  })
})
