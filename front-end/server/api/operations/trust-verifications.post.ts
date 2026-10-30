import { operationsTrustVerificationSchema } from "~/shared/utils/validation"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"
import { recordTrustVerificationEvent } from "../../utils/trust-verification-events"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 60,
    scope: "operations:trust-verifications",
    windowMs: 60 * 1000,
  })

  const payload = operationsTrustVerificationSchema.parse(await readBody(event))
  const verificationEvent = await recordTrustVerificationEvent(event, payload)

  return {
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
    verificationEvent,
  }
})
