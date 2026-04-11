export default defineNuxtRouteMiddleware(() => {
  const { session } = useSessionState()

  if (!session.value)
    return navigateTo("/auth/sign-in")
})
