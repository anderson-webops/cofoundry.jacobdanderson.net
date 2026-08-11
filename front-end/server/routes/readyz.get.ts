import { setResponseStatus } from "h3"
import { buildProbePayload, resolveFrontendReadiness, setHealthResponseHeaders } from "../utils/health"

export default defineEventHandler(async (event) => {
  setHealthResponseHeaders(event)
  const ready = await resolveFrontendReadiness(event)
  setResponseStatus(event, ready ? 200 : 503)
  return buildProbePayload(ready)
})
