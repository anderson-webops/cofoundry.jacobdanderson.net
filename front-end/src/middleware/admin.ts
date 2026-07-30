export default defineNuxtRouteMiddleware(async () => {
  const response = await useAuthoritativeSession()

  if (!response)
    return navigateTo("/auth/sign-in")

  if (response.role !== "admin")
    return navigateTo("/app")
})
