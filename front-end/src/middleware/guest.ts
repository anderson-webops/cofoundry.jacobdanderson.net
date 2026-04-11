export default defineNuxtRouteMiddleware(async () => {
  const session = await useAuthoritativeSession()

  if (session?.onboardingCompleted)
    return navigateTo("/app")

  if (session)
    return navigateTo("/onboarding")
})
