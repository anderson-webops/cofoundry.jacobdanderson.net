import { defineEventHandler, readBody } from "h3"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { deliverWorkspaceRealtimeEnvelope } from "../../utils/workspace-realtime"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 600,
    scope: "operations:realtime-events",
    windowMs: 60 * 1000,
  })

  const delivered = await deliverWorkspaceRealtimeEnvelope(await readBody(event))

  return {
    delivered,
    ok: true,
  }
})
