import { defineEventHandler, readBody } from "h3"
import { operationsContractEnvelopeSchema } from "~/shared/utils/validation"
import { recordContractEnvelopeEvent } from "../../utils/contract-envelope-events"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 60,
    scope: "operations:contract-envelopes",
    windowMs: 60 * 1000,
  })

  const payload = operationsContractEnvelopeSchema.parse(await readBody(event))
  const envelopeEvent = await recordContractEnvelopeEvent(event, payload)

  return {
    envelopeEvent,
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
  }
})
