import type { SessionUser } from "~/shared/types/domain"
import { decodeSessionUser, encodeSessionUser, sessionCookieName } from "~/shared/utils/session"

export function useSessionState() {
  const rawCookie = useCookie<string | null>(sessionCookieName, {
    sameSite: "lax",
    watch: "shallow",
  })

  const session = computed(() => decodeSessionUser(rawCookie.value))

  function setSession(nextSession: SessionUser | null) {
    rawCookie.value = nextSession ? encodeSessionUser(nextSession) : null
  }

  return {
    rawCookie,
    session,
    setSession,
  }
}
