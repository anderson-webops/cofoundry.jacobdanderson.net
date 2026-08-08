export default defineNuxtRouteMiddleware(async () => {
  const session = await useAuthoritativeSession()
  if (!session)
    return navigateTo("/auth/sign-in")

  const runtimeConfig = useRuntimeConfig()
  if (runtimeConfig.public.featureInvestmentModule !== true)
    return navigateTo(session.role === "admin" ? "/admin" : "/")

  if (!["admin", "investor_admin"].includes(session.role))
    return navigateTo("/app")
})
