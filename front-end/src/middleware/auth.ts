export default defineNuxtRouteMiddleware(async (to) => {
  const session = await useAuthoritativeSession()

  if (!session)
    return navigateTo("/auth/sign-in")

  if (session.role === "investor_admin" && to.path.startsWith("/app")) {
    const runtimeConfig = useRuntimeConfig()
    return navigateTo(runtimeConfig.public.featureInvestmentModule === true
      ? "/investment-review"
      : "/")
  }
})
