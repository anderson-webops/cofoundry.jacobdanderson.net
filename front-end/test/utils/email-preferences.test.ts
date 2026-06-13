import type { H3Event } from "h3"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { applyEmailPreferenceToken, createEmailPreferenceManagementUrl, createEmailPreferenceToken, verifyEmailPreferenceToken } from "../../server/utils/email-preferences"
import { clearLocalMemberWorkspaceStoreForTests } from "../../server/utils/local-member-workspace"
import { loadMemberWorkspaceState, persistMemberWorkspaceWritePayload } from "../../server/utils/member-workspace"

const event = {} as H3Event
const identity = {
  email: "email-pref-member@example.com",
  id: "user_email_pref_member",
  name: "Email Preference Member",
  onboardingCompleted: true,
  role: "founder" as const,
  subscriptionPlan: "free" as const,
}

let dataDirectory: string
let previousSessionSecret: string | undefined

describe("email preference tokens", () => {
  beforeEach(async () => {
    previousSessionSecret = process.env.SESSION_SIGNING_SECRET
    process.env.SESSION_SIGNING_SECRET = "test-email-preference-secret"
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-email-preferences-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appUrl: "https://cofoundry.example",
        backendMode: "mock",
        billingMode: "mock",
        supportEmail: "support@example.com",
      },
    }))
    await clearLocalMemberWorkspaceStoreForTests()
  })

  afterEach(async () => {
    await clearLocalMemberWorkspaceStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    if (previousSessionSecret === undefined)
      delete process.env.SESSION_SIGNING_SECRET
    else
      process.env.SESSION_SIGNING_SECRET = previousSessionSecret
    vi.unstubAllGlobals()
  })

  it("creates signed preference management URLs and rejects expired tokens", () => {
    const now = Date.UTC(2026, 5, 13)
    const token = createEmailPreferenceToken({
      category: "digest",
      email: "Member@Example.com",
      userId: "user_member",
    }, { expiresInDays: 1, now })

    expect(token).toBeTruthy()
    expect(verifyEmailPreferenceToken(token!, { now })).toMatchObject({
      ok: true,
      payload: {
        category: "digest",
        email: "member@example.com",
        userId: "user_member",
      },
    })
    expect(verifyEmailPreferenceToken(token!, { now: now + 2 * 24 * 60 * 60 * 1000 })).toMatchObject({
      ok: false,
      reason: "Email preference link has expired.",
      statusCode: 410,
    })

    const url = createEmailPreferenceManagementUrl({
      category: "workflow",
      email: identity.email,
      userId: identity.id,
    }, {
      appUrl: "https://cofoundry.example/",
      now,
    })

    expect(url).toContain("https://cofoundry.example/email/preferences?token=")
  })

  it("disables only the linked optional email category in durable local member state", async () => {
    const initial = await loadMemberWorkspaceState(event, identity)

    await persistMemberWorkspaceWritePayload(event, identity, {
      bookmarks: [],
      notificationPreferences: {
        unreadDigestEmail: true,
        workflowEmail: true,
      },
      onboardingCompleted: true,
      opportunities: [],
      profile: initial.state.profile,
      savedSearches: [],
    })

    const token = createEmailPreferenceToken({
      category: "workflow",
      email: identity.email,
      userId: identity.id,
    })

    expect(token).toBeTruthy()

    const result = await applyEmailPreferenceToken(event, token!)
    const reloaded = await loadMemberWorkspaceState(event, identity)

    expect(result).toMatchObject({
      category: "workflow",
      email: identity.email,
      userId: identity.id,
    })
    expect(reloaded.state.user.notificationPreferences.workflowEmail).toBe(false)
    expect(reloaded.state.user.notificationPreferences.unreadDigestEmail).toBe(true)
  })
})
