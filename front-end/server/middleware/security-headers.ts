import process from "node:process"
import { defineEventHandler, getRequestURL, setResponseHeader } from "h3"
import { useRuntimeConfig } from "nitropack/runtime"
import { isLocalDevelopmentEnvironment } from "../../shared/utils/environment"
import { resolveServerAppUrl } from "../utils/app-url"
import { buildSecurityHeaders, shouldDefaultApiResponseToNoStore } from "../utils/security-headers"

export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const appUrl = resolveServerAppUrl(event)
  const headers = buildSecurityHeaders({
    appUrl,
    backendMode: runtimeConfig.public.backendMode,
    billingMode: runtimeConfig.public.billingMode,
    includeContentSecurityPolicy: false,
    isProduction: !isLocalDevelopmentEnvironment(process.env),
    stripePublishableKey: runtimeConfig.public.stripePublishableKey,
    supabaseUrl: runtimeConfig.public.supabaseUrl,
  })

  for (const [name, value] of Object.entries(headers))
    setResponseHeader(event, name, value)

  if (shouldDefaultApiResponseToNoStore(getRequestURL(event).pathname))
    setResponseHeader(event, "Cache-Control", "no-store")
})
