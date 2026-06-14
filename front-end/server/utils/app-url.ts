import type { H3Event } from "h3"
import process from "node:process"
import { getHeader, getRequestURL } from "h3"
import { appProductionUrl } from "../../shared/constants/app"

const trailingSlashPattern = /\/+$/
const localHostnames = new Set(["localhost", "127.0.0.1", "::1"])
const localPublicAppUrlValues = new Set(["1", "true", "yes"])

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

function normalizeFallbackAppUrl(value: string | undefined) {
  return stripTrailingSlash(value?.trim() || appProductionUrl)
}

function shouldUseProductionFallback(input: {
  allowLocalAppUrl?: boolean
  configuredAppUrl: string
  nodeEnv?: string
  requestOrigin: string
}) {
  if (input.allowLocalAppUrl || input.nodeEnv !== "production")
    return false

  return isLocalAppUrl(input.requestOrigin) && (!input.configuredAppUrl || isLocalAppUrl(input.configuredAppUrl))
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
  allowLocalAppUrl?: boolean
  configuredAppUrl?: string
  forwardedHost?: string | null
  forwardedProto?: string | null
  host?: string | null
  nodeEnv?: string
  productionFallbackAppUrl?: string
  requestOrigin: string
}) {
  const configuredAppUrl = stripTrailingSlash(input.configuredAppUrl?.trim() || "")
  const requestOrigin = originFromHeaders(input)
  const productionFallbackAppUrl = normalizeFallbackAppUrl(input.productionFallbackAppUrl)

  if (shouldUseProductionFallback({
    allowLocalAppUrl: input.allowLocalAppUrl,
    configuredAppUrl,
    nodeEnv: input.nodeEnv,
    requestOrigin,
  })) {
    return productionFallbackAppUrl
  }

  if (!configuredAppUrl)
    return requestOrigin

  if (isLocalAppUrl(configuredAppUrl) && requestOrigin && !isLocalAppUrl(requestOrigin))
    return requestOrigin

  return configuredAppUrl
}

function allowLocalPublicAppUrl() {
  return localPublicAppUrlValues.has(process.env.COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL?.trim().toLowerCase() || "")
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
    if (process.env.NODE_ENV === "production" && !allowLocalPublicAppUrl())
      return isLocalAppUrl(configuredAppUrl) || !configuredAppUrl ? appProductionUrl : configuredAppUrl

    return configuredAppUrl || "http://localhost:3000"
  }

  return resolveServerAppUrlFromParts({
    allowLocalAppUrl: allowLocalPublicAppUrl(),
    configuredAppUrl,
    forwardedHost: getHeader(event, "x-forwarded-host"),
    forwardedProto: getHeader(event, "x-forwarded-proto"),
    host: getHeader(event, "host"),
    nodeEnv: process.env.NODE_ENV,
    requestOrigin: requestUrl.origin,
  })
}
