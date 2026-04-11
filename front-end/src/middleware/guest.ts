export default defineNuxtRouteMiddleware(() => {
  const { session } = useSessionState()

  if (session.value?.onboardingCompleted)
    return navigateTo("/app")

  if (session.value)
    return navigateTo("/onboarding")
})
