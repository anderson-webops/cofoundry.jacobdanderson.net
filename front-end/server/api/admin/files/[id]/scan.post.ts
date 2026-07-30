import { getRouterParam } from "h3"
import { adminFileScanResultSchema } from "~/shared/utils/validation"
import { requireAdminSession } from "../../../../utils/admin"
import { recordAdminFileScanResult } from "../../../../utils/file-uploads"
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

  const payload = adminFileScanResultSchema.parse(await readBody(event))
  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    metadata: {
      nextStatus: payload.scanStatus,
      scanStatus: payload.scanStatus,
    },
    notes: payload.notes,
    targetId: uploadId,
    targetType: "file_upload" as const,
    type: "record_file_scan" as const,
  }
  const upload = await recordAdminFileScanResult(event, uploadId, payload, action)
  if (!upload)
    throw createError({ statusCode: 404, statusMessage: "File upload was not found." })

  return {
    action,
    upload,
  }
})
