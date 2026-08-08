import type { SessionUser } from "../../shared/types/domain"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ref } from "vue"
import { encodeSessionUser } from "../../shared/utils/session"
import { useSessionState } from "../../src/composables/useSessionState"

const olivia: SessionUser = {
  email: "olivia@cofoundry.dev",
  id: "user_olivia",
  name: "Olivia Chen",
  onboardingCompleted: true,
  role: "founder",
  subscriptionPlan: "pro",
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("authoritative session state", () => {
  it("shares server-initialized session state across composable consumers", () => {
    const cookie = ref<string | null>(encodeSessionUser(olivia))
    const states = new Map<string, ReturnType<typeof ref<SessionUser | null>>>()

    vi.stubGlobal("useCookie", () => cookie)
    vi.stubGlobal("useState", (key: string, initialize: () => SessionUser | null) => {
      if (!states.has(key))
        states.set(key, ref(initialize()))
      return states.get(key)
    })

    const authSession = useSessionState()
    const workspaceSession = useSessionState()

    expect(workspaceSession.session.value).toEqual(olivia)

    const updated = { ...olivia, subscriptionPlan: "team" as const }
    authSession.setSession(updated)

    expect(workspaceSession.session.value).toEqual(updated)
  })

  it("does not overwrite the server-managed HttpOnly session cookie", () => {
    const encoded = encodeSessionUser(olivia)
    const cookie = ref<string | null>(encoded)
    const session = ref<SessionUser | null>(null)

    vi.stubGlobal("useCookie", () => cookie)
    vi.stubGlobal("useState", (_key: string, initialize: () => SessionUser | null) => {
      if (!session.value)
        session.value = initialize()
      return session
    })

    useSessionState().setSession(null)

    expect(session.value).toBeNull()
    expect(cookie.value).toBe(encoded)
  })
})
