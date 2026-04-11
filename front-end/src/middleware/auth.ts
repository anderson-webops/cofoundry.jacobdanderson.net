export default defineNuxtRouteMiddleware(async () => {
  const session = await useAuthoritativeSession()

  if (!session)
    return navigateTo("/auth/sign-in")
})
