import type { SessionUser } from "~/shared/types/domain"

export default defineNuxtRouteMiddleware(async () => {
  const { setSession } = useSessionState()

  const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
  const response = await $fetch<{ session: SessionUser | null }>("/api/auth/session", { headers })

  setSession(response.session)

  if (!response.session)
    return navigateTo("/auth/sign-in")

  if (!["admin", "investor_admin"].includes(response.session.role))
    return navigateTo("/app")
})
