export default defineNuxtRouteMiddleware((to) => {
  const { session } = useSessionState()

  if (!session.value)
    return navigateTo("/auth/sign-in")

  if (!session.value.onboardingCompleted && to.path !== "/onboarding")
    return navigateTo("/onboarding")
})
