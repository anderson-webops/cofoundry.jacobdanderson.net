export default defineNuxtRouteMiddleware(() => {
  const { session } = useSessionState()

  if (!session.value)
    return navigateTo("/auth/sign-in")

  if (!["admin", "investor_admin"].includes(session.value.role))
    return navigateTo("/app")
})
