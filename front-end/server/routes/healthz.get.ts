import { defineEventHandler } from "h3"
import { buildProbePayload, setHealthResponseHeaders } from "../utils/health"

export default defineEventHandler((event) => {
  setHealthResponseHeaders(event)
  return buildProbePayload(true)
})
