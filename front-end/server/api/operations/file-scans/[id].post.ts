import { getRouterParam } from "h3"
import { fileScanResultSchema } from "~/shared/utils/validation"
import { recordFileScanResult } from "../../../utils/file-uploads"
import { requireOperationsWorker } from "../../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { isSupabaseEnabled } from "../../../utils/supabase"

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 120,
    scope: "operations:file-scans",
    windowMs: 60 * 1000,
  })

  const uploadId = getRouterParam(event, "id")
  if (!uploadId)
    throw createError({ statusCode: 400, statusMessage: "Upload id is required." })

  const payload = fileScanResultSchema.parse(await readBody(event))
  const upload = await recordFileScanResult(event, uploadId, payload)

  return {
    mode: isSupabaseEnabled(event) ? "supabase" : "mock",
    upload,
  }
})
