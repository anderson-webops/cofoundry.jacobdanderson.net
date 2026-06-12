import process from "node:process"
import { send } from "h3"
import { readPublicEnvironment } from "../../shared/utils/environment"
import { buildHealthPayload, setHealthResponseHeaders } from "../utils/health"

export default defineEventHandler((event) => {
  setHealthResponseHeaders(event)

  const payload = buildHealthPayload({
    generatedAt: new Date().toISOString(),
    publicEnvironment: readPublicEnvironment(process.env),
  })

  return send(event, JSON.stringify(payload), "application/json; charset=utf-8")
})
