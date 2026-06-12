import { describe, expect, it } from "vitest"
import { isScheduledDigestEmailEnabled } from "../../server/utils/notification-delivery"
import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"

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
})
