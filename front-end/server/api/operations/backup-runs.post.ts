import { defineEventHandler, readBody } from "h3"
import { operationsBackupRunSchema } from "~/shared/utils/validation"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { recordBackupRun } from "../../utils/operations-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 60,
    scope: "operations:backup-runs",
    windowMs: 60 * 1000,
  })

  const payload = operationsBackupRunSchema.parse(await readBody(event))
  const backupRun = await recordBackupRun(event, payload)

  return {
    backupRun,
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
  }
})
