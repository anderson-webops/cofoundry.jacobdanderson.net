import type { H3Event } from "h3"
import { getHeader, getRequestURL } from "h3"

const trailingSlashPattern = /\/+$/
const localHostnames = new Set(["localhost", "127.0.0.1", "::1"])

function stripTrailingSlash(value: string) {
  return value.replace(trailingSlashPattern, "")
}

function firstHeaderValue(value: string | null | undefined) {
  return value?.split(",")[0]?.trim() || ""
}

function isLocalAppUrl(value: string) {
  try {
    const url = new URL(value)
    return localHostnames.has(url.hostname)
  }
  catch {
    return false
  }
}

function originFromHeaders(input: {
  forwardedHost?: string | null
  forwardedProto?: string | null
  host?: string | null
  requestOrigin: string
}) {
  const headerHost = firstHeaderValue(input.forwardedHost) || firstHeaderValue(input.host)
  if (!headerHost)
    return stripTrailingSlash(input.requestOrigin)

  const requestProtocol = input.requestOrigin.includes("://")
    ? input.requestOrigin.split("://")[0]
    : "http"
  const protocol = firstHeaderValue(input.forwardedProto) || requestProtocol
  const normalizedHost = headerHost.replace(/^https?:\/\//i, "")

  try {
    return stripTrailingSlash(new URL(`${protocol}://${normalizedHost}`).origin)
  }
  catch {
    return stripTrailingSlash(input.requestOrigin)
  }
}

export function resolveServerAppUrlFromParts(input: {
  configuredAppUrl?: string
  forwardedHost?: string | null
  forwardedProto?: string | null
  host?: string | null
  requestOrigin: string
}) {
  const configuredAppUrl = stripTrailingSlash(input.configuredAppUrl?.trim() || "")
  const requestOrigin = originFromHeaders(input)

  if (!configuredAppUrl)
    return requestOrigin

  if (isLocalAppUrl(configuredAppUrl) && requestOrigin && !isLocalAppUrl(requestOrigin))
    return requestOrigin

  return configuredAppUrl
}

export function resolveServerAppUrl(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  const configuredAppUrl = stripTrailingSlash(runtimeConfig.public.appUrl?.trim() || "")

  if (configuredAppUrl && !isLocalAppUrl(configuredAppUrl))
    return configuredAppUrl

  let requestUrl: URL
  try {
    requestUrl = getRequestURL(event)
  }
  catch {
    return configuredAppUrl || "http://localhost:3000"
  }

  return resolveServerAppUrlFromParts({
    configuredAppUrl,
    forwardedHost: getHeader(event, "x-forwarded-host"),
    forwardedProto: getHeader(event, "x-forwarded-proto"),
    host: getHeader(event, "host"),
    requestOrigin: requestUrl.origin,
  })
}
