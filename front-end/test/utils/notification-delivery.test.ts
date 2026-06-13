import { describe, expect, it } from "vitest"
import { buildDigestContent, isScheduledDigestEmailEnabled, sendUnreadNotificationDigest } from "../../server/utils/notification-delivery"
import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"
import { buildLifecycleNotification } from "../../shared/utils/lifecycle-notifications"
import { buildSessionUser } from "../../shared/utils/workspace"

describe("notification delivery preferences", () => {
  it("allows scheduled digests only for explicitly enabled users", () => {
    const seed = cloneValue(workspaceSeed)

    expect(isScheduledDigestEmailEnabled(seed, "user_olivia")).toBe(true)

    const user = seed.users.find(item => item.id === "user_olivia")
    expect(user).toBeDefined()
    user!.notificationPreferences.unreadDigestEmail = false

    expect(isScheduledDigestEmailEnabled(seed, "user_olivia")).toBe(false)
    expect(isScheduledDigestEmailEnabled(seed, "missing_user")).toBe(false)
  })

  it("builds digest content from the canonical inbox action queue", () => {
    const seed = cloneValue(workspaceSeed)
    const session = buildSessionUser(seed, "user_malik")

    expect(session).toBeDefined()

    seed.notifications = seed.notifications.filter(notification => notification.userId !== "user_malik")

    const digest = buildDigestContent(seed, session!)

    expect(digest.snapshot.actions.length).toBeGreaterThan(0)
    expect(digest.snapshot.actions.some(item => item.kind === "proposal")).toBe(true)
    expect(digest.snapshot.actions.some(item => item.kind === "contract")).toBe(true)
    expect(digest.body).toContain("Review proposal")
    expect(digest.body).toContain("/app/contracts/")
  })

  it("skips manual digest delivery when the workspace queue is clear", async () => {
    const result = await sendUnreadNotificationDigest({} as never, workspaceSeed, {
      email: "clear@example.com",
      id: "user_without_actions",
      name: "Clear Queue",
      onboardingCompleted: true,
      role: "founder",
      subscriptionPlan: "free",
    }, { skipIfEmpty: true })

    expect(result).toMatchObject({
      delivered: false,
      reason: "no_workspace_items",
      skipped: true,
      unreadCount: 0,
    })
  })

  it("builds lifecycle notification content for signature-required events", () => {
    const plan = buildLifecycleNotification(workspaceSeed, {
      eventType: "contract.signature_required",
      targetId: "contract_ledgerloop",
      userId: "user_malik",
    })

    expect(plan).toMatchObject({
      eventType: "contract.signature_required",
      href: "/app/contracts/contract_ledgerloop",
      notificationType: "contract",
      recipientEmail: "malik@cofoundry.dev",
      subject: "CoFoundry: signature needed for LedgerLoop Founder Collaboration Agreement",
      targetId: "contract_ledgerloop",
      targetType: "contract",
      userId: "user_malik",
    })
    expect(plan?.body).toContain("waiting on your signature")
  })

  it("does not build lifecycle email content for unrelated or already-satisfied targets", () => {
    const alreadySigned = buildLifecycleNotification(workspaceSeed, {
      eventType: "contract.signature_required",
      targetId: "contract_ledgerloop",
      userId: "user_olivia",
    })
    const unrelated = buildLifecycleNotification(workspaceSeed, {
      eventType: "proposal.updated",
      targetId: "proposal_ledgerloop_cto",
      userId: "user_sofia",
    })

    expect(alreadySigned).toBeNull()
    expect(unrelated).toBeNull()
  })
})
