import { defineEventHandler, sendNoContent } from "h3"
import { setHealthResponseHeaders } from "../utils/health"

export default defineEventHandler((event) => {
  setHealthResponseHeaders(event)
  return sendNoContent(event, 200)
})
