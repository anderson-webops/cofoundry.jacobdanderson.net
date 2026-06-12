import type { H3Event } from "h3"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { persistMockCheckoutSubscription, updateMockSubscriptionRenewal } from "../../server/utils/billing-persistence"
import { applyCollaborationMutation } from "../../server/utils/collaboration-workflow"
import { clearLocalAdminAuditStoreForTests } from "../../server/utils/local-admin-audit"
import { clearLocalCollaborationStoreForTests } from "../../server/utils/local-collaboration-store"
import { clearLocalMemberWorkspaceStoreForTests } from "../../server/utils/local-member-workspace"
import { loadMemberWorkspaceState, persistMemberWorkspaceWritePayload } from "../../server/utils/member-workspace"
import { workspaceSeed } from "../../shared/data/seed"
import { buildSessionUser } from "../../shared/utils/workspace"

let dataDirectory: string

const event = {} as H3Event
const identity = {
  email: "local-member@example.com",
  id: "user_local_member",
  name: "Local Member",
  onboardingCompleted: false,
  role: "founder" as const,
  subscriptionPlan: "free" as const,
}

describe("local member workspace persistence", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-member-workspace-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        backendMode: "mock",
        billingMode: "mock",
      },
    }))
    await clearLocalAdminAuditStoreForTests()
    await clearLocalCollaborationStoreForTests()
    await clearLocalMemberWorkspaceStoreForTests()
  })

  afterEach(async () => {
    await clearLocalAdminAuditStoreForTests()
    await clearLocalCollaborationStoreForTests()
    await clearLocalMemberWorkspaceStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    vi.unstubAllGlobals()
  })

  it("persists member-owned workspace state in mock mode", async () => {
    const initial = await loadMemberWorkspaceState(event, identity)

    const saved = await persistMemberWorkspaceWritePayload(event, identity, {
      bookmarks: [],
      notificationPreferences: {
        unreadDigestEmail: true,
      },
      onboardingCompleted: true,
      opportunities: [],
      profile: {
        ...initial.state.profile,
        bio: "This profile was persisted by the local member workspace store for production-facing mock mode.",
        headline: "Server-persisted local member profile",
      },
      savedSearches: [],
    })

    const reloaded = await loadMemberWorkspaceState(event, identity)

    expect(saved.session).toMatchObject({
      id: identity.id,
      onboardingCompleted: true,
    })
    expect(reloaded.state.profile).toMatchObject({
      headline: "Server-persisted local member profile",
    })
    expect(reloaded.state.user.notificationPreferences.unreadDigestEmail).toBe(true)
  })

  it("persists mock collaboration mutations through the server route helpers", async () => {
    const session = buildSessionUser(workspaceSeed, "user_malik")
    if (!session)
      throw new Error("Expected seeded Malik review account.")

    const conversation = workspaceSeed.conversations.find(item =>
      item.participantIds.includes(session.id)
      && (item.unreadCountByUser[session.id] || 0) > 0,
    )
    if (!conversation)
      throw new Error("Expected a seeded unread conversation for Malik.")

    await applyCollaborationMutation(event, session, {
      action: "mark_conversation_read",
      conversationId: conversation.id,
    })

    const reloaded = await loadMemberWorkspaceState(event, {
      email: session.email,
      id: session.id,
      name: session.name,
      onboardingCompleted: session.onboardingCompleted,
      role: session.role,
      subscriptionPlan: session.subscriptionPlan,
    })

    expect(reloaded.seed.conversations.find(item => item.id === conversation.id)?.unreadCountByUser[session.id]).toBe(0)
  })

  it("persists mock billing checkout and renewal changes", async () => {
    const initial = await loadMemberWorkspaceState(event, identity)
    const checkout = await persistMockCheckoutSubscription(event, initial.session, "pro", "annual")

    expect(checkout?.state.subscription).toMatchObject({
      billingCycle: "annual",
      cancelAtPeriodEnd: false,
      plan: "pro",
      status: "active",
    })
    expect(checkout?.state.subscription.stripeCheckoutSessionId).toMatch(/^mock_checkout_/)

    const cancel = await updateMockSubscriptionRenewal(event, checkout!.session, "cancel_at_period_end")
    expect(cancel?.state.subscription.cancelAtPeriodEnd).toBe(true)

    const resume = await updateMockSubscriptionRenewal(event, cancel!.session, "resume")
    expect(resume?.state.subscription.cancelAtPeriodEnd).toBe(false)

    const reloaded = await loadMemberWorkspaceState(event, identity)
    expect(reloaded.state.subscription).toMatchObject({
      billingCycle: "annual",
      cancelAtPeriodEnd: false,
      plan: "pro",
    })
  })
})
