import type { H3Error } from "h3"
import process from "node:process"
import { createError, getRequestURL, send, setResponseHeaders, setResponseStatus } from "h3"
import { defineNitroErrorHandler } from "nitropack/runtime"
import { sanitizeErrorResponseBody } from "./utils/error-response"

function presentationError(error: H3Error) {
  const statusCode = error.statusCode || 500
  if (process.env.NODE_ENV !== "production" || statusCode < 500)
    return error

  console.error("[request error] Internal server failure.", error)
  const safeError = createError({
    message: "Server Error",
    statusCode,
    statusMessage: "Server Error",
  })
  safeError.unhandled = true
  return safeError
}

export default defineNitroErrorHandler(async (error, event, { defaultHandler }) => {
  const response = await defaultHandler(presentationError(error), event, { silent: true })
  response.headers["cache-control"] = "no-store"
  setResponseHeaders(event, response.headers)
  setResponseStatus(event, response.status, response.statusText)

  const body = sanitizeErrorResponseBody(response.body, getRequestURL(event).pathname)
  return send(event, typeof body === "string"
    ? body
    : JSON.stringify(body, null, 2))
})
