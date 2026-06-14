import process from "node:process"
import { setResponseHeader } from "h3"
import { buildSecurityHeaders } from "../utils/security-headers"

export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const headers = buildSecurityHeaders({
    appUrl: runtimeConfig.public.appUrl,
    backendMode: runtimeConfig.public.backendMode,
    billingMode: runtimeConfig.public.billingMode,
    isProduction: process.env.NODE_ENV === "production",
    stripePublishableKey: runtimeConfig.public.stripePublishableKey,
    supabaseUrl: runtimeConfig.public.supabaseUrl,
  })

  for (const [name, value] of Object.entries(headers))
    setResponseHeader(event, name, value)
})
