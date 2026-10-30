import { operationsEmailSuppressionSchema } from "~/shared/utils/validation"
import { recordEmailSuppression } from "../../utils/email-suppression"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 60,
    scope: "operations:email-suppressions",
    windowMs: 60 * 1000,
  })

  const payload = operationsEmailSuppressionSchema.parse(await readBody(event))
  const suppression = await recordEmailSuppression(event, payload)

  return {
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
    suppression,
  }
})
