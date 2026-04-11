export default defineNuxtRouteMiddleware(async (to) => {
  const session = await useAuthoritativeSession()

  if (!session)
    return navigateTo("/auth/sign-in")

  if (!session.onboardingCompleted && to.path !== "/onboarding")
    return navigateTo("/onboarding")
})
