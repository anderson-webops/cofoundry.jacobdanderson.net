import { operationsEventSchema } from "~/shared/utils/validation"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { recordOperationalEvent } from "../../utils/operations-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 120,
    scope: "operations:events",
    windowMs: 60 * 1000,
  })

  const payload = operationsEventSchema.parse(await readBody(event))
  const operationalEvent = await recordOperationalEvent(event, payload)

  return {
    event: operationalEvent,
    mode: isSupabaseEnabled(event) ? "supabase" : "mock",
  }
})
