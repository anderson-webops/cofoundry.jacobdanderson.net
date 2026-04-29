import { getQuery } from "h3"
import { listPendingFileScans } from "../../../utils/file-uploads"
import { requireOperationsWorker } from "../../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { isSupabaseEnabled } from "../../../utils/supabase"

function parseLimit(value: unknown) {
  const parsed = Number.parseInt(String(value || "25"), 10)

  if (Number.isNaN(parsed))
    return 25

  return Math.min(Math.max(parsed, 1), 100)
}

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 120,
    scope: "operations:file-scan-queue",
    windowMs: 60 * 1000,
  })

  const pendingScans = await listPendingFileScans(event, parseLimit(getQuery(event).limit))

  return {
    mode: isSupabaseEnabled(event) ? "supabase" : "mock",
    pendingScans,
  }
})
