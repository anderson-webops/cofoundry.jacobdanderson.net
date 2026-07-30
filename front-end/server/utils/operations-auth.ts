import type { H3Event } from "h3"
import { Buffer } from "node:buffer"
import { timingSafeEqual } from "node:crypto"
import process from "node:process"
import { createError, getHeader } from "h3"

function readConfiguredToken(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  return String(
    process.env.COFOUNDRY_OPERATIONS_TOKEN
    || process.env.OPERATIONS_WORKER_TOKEN
    || runtimeConfig.operationsWorkerToken
    || "",
  ).trim()
}

function readProvidedToken(event: H3Event) {
  const authorization = getHeader(event, "authorization")?.trim()
  const bearerPrefix = "Bearer "

  if (authorization?.startsWith(bearerPrefix))
    return authorization.slice(bearerPrefix.length).trim()

  return getHeader(event, "x-cofoundry-operations-token")?.trim() || ""
}

function tokensMatch(leftValue: string, rightValue: string) {
  const left = Buffer.from(leftValue)
  const right = Buffer.from(rightValue)

  if (!left.length || left.length !== right.length)
    return false

  return timingSafeEqual(left, right)
}

export function requireOperationsWorker(event: H3Event) {
  const configuredToken = readConfiguredToken(event)
  if (configuredToken.length < 32) {
    throw createError({
      statusCode: 503,
      statusMessage: "A strong operations worker token is not configured on this server.",
    })
  }

  if (!tokensMatch(readProvidedToken(event), configuredToken)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Operations worker authorization failed.",
    })
  }
}
