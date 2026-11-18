import { defineEventHandler, getRequestURL, setResponseHeader } from "h3"
import { buildResponsePolicyHeaders } from "../utils/response-policies"

export default defineEventHandler((event) => {
  const headers = buildResponsePolicyHeaders(getRequestURL(event).pathname)

  for (const [name, value] of Object.entries(headers))
    setResponseHeader(event, name, value)
})
