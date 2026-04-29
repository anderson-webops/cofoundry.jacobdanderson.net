import { getRouterParam } from "h3"
import { fileScanResultSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { recordFileScanResult } from "../../../../utils/file-uploads"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:file-scan",
    windowMs: 60 * 60 * 1000,
  })

  const uploadId = getRouterParam(event, "id")
  if (!uploadId)
    throw createError({ statusCode: 400, statusMessage: "Upload id is required." })

  const payload = fileScanResultSchema.parse(await readBody(event))
  const upload = await recordFileScanResult(event, uploadId, payload)

  return {
    upload,
  }
})
