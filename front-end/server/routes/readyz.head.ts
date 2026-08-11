import { sendNoContent } from "h3"
import { resolveFrontendReadiness, setHealthResponseHeaders } from "../utils/health"

export default defineEventHandler(async (event) => {
  setHealthResponseHeaders(event)
  const ready = await resolveFrontendReadiness(event)
  return sendNoContent(event, ready ? 200 : 503)
})
