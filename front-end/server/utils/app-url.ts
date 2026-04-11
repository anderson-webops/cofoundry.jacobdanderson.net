import type { H3Event } from "h3"

const trailingSlashPattern = /\/+$/

function stripTrailingSlash(value: string) {
  return value.replace(trailingSlashPattern, "")
}

export function resolveServerAppUrl(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  const configuredAppUrl = stripTrailingSlash(runtimeConfig.public.appUrl)

  if (configuredAppUrl)
    return configuredAppUrl

  return getRequestURL(event).origin
}
