import type { SessionUser } from "~/shared/types/domain"

export async function useAuthoritativeSession() {
  const { setSession } = useSessionState()
  const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
  const response = await $fetch<{ session: SessionUser | null }>("/api/auth/session", { headers })

  setSession(response.session)
  return response.session
}
