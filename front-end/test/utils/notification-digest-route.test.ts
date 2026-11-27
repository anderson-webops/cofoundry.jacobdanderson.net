import type { H3Event } from "h3"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const fixtures = vi.hoisted(() => ({
  authenticate: vi.fn(),
  inbox: vi.fn(),
  loadWorkspace: vi.fn(),
  parse: vi.fn(),
  query: vi.fn(),
  readBody: vi.fn(),
  record: vi.fn(),
  scheduled: vi.fn(),
  send: vi.fn(),
  supabaseEnabled: vi.fn(),
}))

vi.mock("h3", async importOriginal => ({
  ...await importOriginal<typeof import("h3")>(),
  readBody: fixtures.readBody,
}))

vi.mock("../../shared/data/seed", () => ({
  workspaceSeed: { users: [] }
}))
vi.mock("../../shared/utils/inbox", () => ({ buildInboxSnapshot: fixtures.inbox }))
vi.mock("../../shared/utils/validation", () => ({
  operationsDigestRunSchema: { parse: fixtures.parse }
}))
vi.mock("../../shared/utils/workspace", () => ({
  buildSessionUser: vi.fn()
}))
vi.mock("../../server/utils/member-workspace", () => ({ loadMemberWorkspaceState: fixtures.loadWorkspace }))
vi.mock("../../server/utils/notification-delivery", () => ({
  buildDigestSubject: (count: number) => `Digest ${count}`,
  isScheduledDigestEmailEnabled: fixtures.scheduled,
  recordNotificationDelivery: fixtures.record,
  sendUnreadNotificationDigest: fixtures.send,
}))
vi.mock("../../server/utils/operations-auth", () => ({ requireOperationsWorker: fixtures.authenticate }))
vi.mock("../../server/utils/rate-limit", () => ({
  assertRateLimit: vi.fn(),
  buildRateLimitKey: vi.fn()
}))
vi.mock("../../server/utils/supabase", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({ limit: fixtures.query })
      })
    }),
  }),
  isSupabaseEnabled: fixtures.supabaseEnabled,
}))

const owner = {
  email: "synthetic@example.com",
  email_digest_enabled: true,
  id: "synthetic-owner",
  onboarding_completed: true,
  role: "founder",
}

let handler: typeof import("../../server/api/operations/notification-digests/run.post").default

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", (callback: unknown) => callback)
  vi.stubGlobal("readBody", fixtures.readBody)
  handler = (await import("../../server/api/operations/notification-digests/run.post")).default
})

beforeEach(() => {
  vi.resetAllMocks()
  fixtures.supabaseEnabled.mockReturnValue(true)
  fixtures.parse.mockReturnValue({ dryRun: false, maxUsers: 10, onlyWithUnread: false })
  fixtures.query.mockResolvedValue({
    data: [owner],
    error: null
  })
  fixtures.loadWorkspace.mockImplementation(async (_event, identity) => ({
    seed: {},
    session: { ...identity, subscriptionPlan: "free" },
  }))
  fixtures.inbox.mockReturnValue({
    actions: ["synthetic-unread"]
  })
  fixtures.send.mockResolvedValue({ configured: true, delivered: true, unreadCount: 1 })
})

afterAll(() => vi.unstubAllGlobals())

describe("scheduled digest route", () => {
  it("authenticates the worker before reading a request or contacting a provider", async () => {
    fixtures.authenticate.mockImplementation(() => {
      throw new Error("worker denied")
    })
    await expect(handler({} as H3Event)).rejects.toThrow("worker denied")
    expect(fixtures.readBody).not.toHaveBeenCalled()
    expect(fixtures.query).not.toHaveBeenCalled()
    expect(fixtures.send).not.toHaveBeenCalled()
  })

  it("records an empty mock run without sending mail or querying Supabase", async () => {
    fixtures.supabaseEnabled.mockReturnValue(false)
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      mode: "mock",
      processed: 0,
      sent: 0,
      skipped: 1
    })
    expect(fixtures.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "operations-worker" }), expect.objectContaining({ configured: false, delivered: false }))
    expect(fixtures.query).not.toHaveBeenCalled()
    expect(fixtures.send).not.toHaveBeenCalled()
  })

  it("skips members without unread notifications before preference or mail writes", async () => {
    fixtures.parse.mockReturnValue({ dryRun: false, maxUsers: 10, onlyWithUnread: true })
    fixtures.inbox.mockReturnValue({ actions: [] })
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      sent: 0,
      skipped: 1,
      results: [
        { reason: "no_unread_notifications", userId: owner.id }
      ]
    })
    expect(fixtures.record).not.toHaveBeenCalled()
    expect(fixtures.send).not.toHaveBeenCalled()
  })

  it("records preference suppression without delivering a digest", async () => {
    fixtures.query.mockResolvedValue({
      data: [
        { ...owner, email_digest_enabled: false }
      ],
      error: null
    })
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      sent: 0,
      skipped: 1,
      results: [
        { reason: "email_digest_disabled", userId: owner.id }
      ]
    })
    expect(fixtures.record).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: owner.id }), expect.objectContaining({ suppressed: true, delivered: false }))
    expect(fixtures.send).not.toHaveBeenCalled()
  })

  it("keeps dry runs free of mail delivery and notification writes", async () => {
    fixtures.parse.mockReturnValue({ dryRun: true, maxUsers: 10, onlyWithUnread: false })
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      dryRun: true,
      sent: 0,
      skipped: 1,
      results: [
        { reason: "dry_run" }
      ]
    })
    expect(fixtures.record).not.toHaveBeenCalled()
    expect(fixtures.send).not.toHaveBeenCalled()
  })

  it("retains authoritative workspace identity and mail preference controls", async () => {
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      mode: "supabase",
      processed: 1,
      sent: 1,
      skipped: 0,
      results: [
        { reason: "sent", userId: owner.id }
      ]
    })
    expect(fixtures.loadWorkspace).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ email: owner.email, id: owner.id, role: owner.role }))
    expect(fixtures.send).toHaveBeenCalledWith(expect.anything(), {}, expect.objectContaining({ id: owner.id }), { respectPreferences: true, skipIfEmpty: true })
  })

  it.each([
    [
      { configured: false, delivered: false, unreadCount: 1 },
      "mail_not_configured"
    ],
    [
      { configured: true, delivered: false, unreadCount: 1 },
      "delivery_failed"
    ],
    [
      {
        configured: true,
        delivered: false,
        suppressed: true,
        unreadCount: 1
      },
      "email_digest_disabled"
    ],
    [
      {
        configured: true,
        delivered: false,
        reason: "explicit-provider-result",
        unreadCount: 1
      },
      "explicit-provider-result"
    ],
  ])("preserves delivery classification for %j", async (delivery, reason) => {
    fixtures.send.mockResolvedValue(delivery)
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      failed: 0,
      sent: 0,
      skipped: 1,
      results: [
        { reason, userId: owner.id }
      ]
    })
  })

  it("isolates a member failure and continues with the next member", async () => {
    fixtures.query.mockResolvedValue({
      data: [
        owner,
        { ...owner, id: "second-owner" }
      ],
      error: null
    })
    fixtures.loadWorkspace.mockRejectedValueOnce(new Error("synthetic read failure"))
    const result = await handler({} as H3Event)
    expect(result).toMatchObject({
      processed: 2,
      failed: 1,
      sent: 1,
      failures: [
        { error: "synthetic read failure", userId: owner.id }
      ],
      results: [
        { userId: "second-owner" }
      ]
    })
    expect(fixtures.send).toHaveBeenCalledTimes(1)
  })
})
