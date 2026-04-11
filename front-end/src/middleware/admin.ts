export default defineNuxtRouteMiddleware(async () => {
  const response = await useAuthoritativeSession()

  if (!response)
    return navigateTo("/auth/sign-in")

  if (!["admin", "investor_admin"].includes(response.role))
    return navigateTo("/app")
})
