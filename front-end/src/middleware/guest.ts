import { defineNuxtRouteMiddleware, navigateTo, useRuntimeConfig } from "#app"
import { useAuthoritativeSession } from "~/composables/useAuthoritativeSession"

export default defineNuxtRouteMiddleware(async () => {
  const session = await useAuthoritativeSession()

  if (session?.onboardingCompleted) {
    const runtimeConfig = useRuntimeConfig()
    return navigateTo(session.role === "investor_admin"
      ? runtimeConfig.public.featureInvestmentModule === true
        ? "/investment-review"
        : "/"
      : "/app")
  }

  if (session)
    return navigateTo("/onboarding")
})
