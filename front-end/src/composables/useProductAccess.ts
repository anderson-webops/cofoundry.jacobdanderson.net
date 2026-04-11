import type { ProductAccessEnvironment, ProductAccessPolicy } from "~/shared/utils/product-access"
import { buildAccessRequestPath, getBackendModeLabel, getBillingModeLabel, getGuidePageCta, getIntroCta, getPricingTierCta, getPrimaryAccessCta, getSecondaryAccessCta, resolveProductAccessPolicy } from "~/shared/utils/product-access"

export function useProductAccess() {
  const runtimeConfig = useRuntimeConfig()
  const isLocalDevelopment = import.meta.dev
  const environment = computed<ProductAccessEnvironment>(() => ({
    backendMode: runtimeConfig.public.backendMode === "supabase" ? "supabase" : "mock",
    billingMode: runtimeConfig.public.billingMode === "stripe" ? "stripe" : "mock",
    enableDemoAccess: runtimeConfig.public.enableDemoAccess === true,
  }))

  const policy = computed<ProductAccessPolicy>(() => resolveProductAccessPolicy(environment.value, isLocalDevelopment))

  function getServiceLabels() {
    return {
      backend: getBackendModeLabel(environment.value, isLocalDevelopment),
      billing: getBillingModeLabel(environment.value, isLocalDevelopment),
    }
  }

  return {
    policy,
    buildAccessRequestPath,
    getGuidePageCta: (ctaLabel: string, ctaTo: string, source?: string) => getGuidePageCta(policy.value, ctaLabel, ctaTo, source),
    getIntroCta: (source?: string) => getIntroCta(policy.value, source),
    getPricingTierCta: (tierId: "free" | "pro" | "team", source?: string) => getPricingTierCta(policy.value, tierId, source),
    getPrimaryAccessCta: (source?: string) => getPrimaryAccessCta(policy.value, source),
    getSecondaryAccessCta: (source?: string) => getSecondaryAccessCta(policy.value, source),
    getServiceLabels,
  }
}
