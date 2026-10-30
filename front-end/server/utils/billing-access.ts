import type { H3Event } from "h3"
import process from "node:process"
import { resolveProductAccessPolicy } from "~/shared/utils/product-access"
import { isLocalDevelopmentEnvironment } from "../../shared/utils/environment"

export function resolveServerBillingAccessPolicy(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)

  return resolveProductAccessPolicy({
    backendMode: runtimeConfig.public.backendMode === "supabase"
      ? "supabase"
      : "mock",
    billingMode: runtimeConfig.public.billingMode === "stripe"
      ? "stripe"
      : "mock",
    enableDemoAccess: runtimeConfig.public.enableDemoAccess === true,
  }, isLocalDevelopmentEnvironment(process.env))
}

export function buildOperatorManagedBillingUrl(appUrl: string, source: string) {
  const params = new URLSearchParams({ source, topic: "pricing" })
  return `${appUrl}/contact?${params.toString()}`
}
