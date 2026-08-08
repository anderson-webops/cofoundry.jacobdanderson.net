import type { SessionUser } from "~/shared/types/domain"
import { decodeSessionUser, sessionCookieName } from "~/shared/utils/session"

export function useSessionState() {
  const rawCookie = useCookie<string | null>(sessionCookieName, {
    sameSite: "lax",
    watch: false,
  })
  const session = useState<SessionUser | null>("cofoundry-authoritative-session", () => decodeSessionUser(rawCookie.value))

  function setSession(nextSession: SessionUser | null) {
    session.value = nextSession
  }

  return {
    session,
    setSession,
  }
}
