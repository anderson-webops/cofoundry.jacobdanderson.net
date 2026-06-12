import process from "node:process"
import { setResponseHeader } from "h3"
import { buildSecurityHeaders } from "../utils/security-headers"

export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const headers = buildSecurityHeaders({
    appUrl: runtimeConfig.public.appUrl,
    isProduction: process.env.NODE_ENV === "production",
  })

  for (const [name, value] of Object.entries(headers))
    setResponseHeader(event, name, value)
})
