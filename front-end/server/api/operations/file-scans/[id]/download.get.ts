import { getRouterParam, send, setHeader } from "h3"
import { readLocalFileUploadContent } from "../../../../utils/local-operations-store"
import { requireOperationsWorker } from "../../../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"
import { isSupabaseEnabled } from "../../../../utils/supabase"

function safeFilename(filename: string) {
  return filename.replaceAll(/[^\w.-]+/g, "-").replace(/^\.+/, "").slice(0, 120) || "upload"
}

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  if (isSupabaseEnabled(event)) {
    throw createError({
      statusCode: 404,
      statusMessage: "Use the Supabase signed storage URL for this upload.",
    })
  }

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 120,
    scope: "operations:file-scan-download",
    windowMs: 60 * 1000,
  })

  const uploadId = getRouterParam(event, "id")
  if (!uploadId)
    throw createError({ statusCode: 400, statusMessage: "Upload id is required." })

  const content = await readLocalFileUploadContent(uploadId)
  if (!content)
    throw createError({ statusCode: 404, statusMessage: "Local upload content was not found." })

  setHeader(event, "Cache-Control", "no-store")
  setHeader(event, "Content-Disposition", `attachment; filename="${safeFilename(content.filename)}"`)

  return send(event, content.bytes, content.mimeType)
})
