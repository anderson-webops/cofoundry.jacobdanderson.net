import type { H3Event } from "h3"
import { Buffer } from "node:buffer"
import { getHeader, getQuery, getRouterParam, readRawBody } from "h3"
import { writeLocalFileUploadContent } from "../../../utils/local-operations-store"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { isSupabaseEnabled } from "../../../utils/supabase"

const maxLocalUploadBytes = 10 * 1024 * 1024

function readUploadToken(event: H3Event) {
  const queryToken = getQuery(event).token
  if (typeof queryToken === "string")
    return queryToken

  return getHeader(event, "x-cofoundry-upload-token") || ""
}

export default defineEventHandler(async (event) => {
  if (isSupabaseEnabled(event)) {
    throw createError({
      statusCode: 404,
      statusMessage: "Local upload URLs are only available when Supabase storage is disabled.",
    })
  }

  const uploadId = getRouterParam(event, "id")
  if (!uploadId)
    throw createError({ statusCode: 400, statusMessage: "Upload id is required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, uploadId),
    limit: 30,
    scope: "files:local-upload",
    windowMs: 60 * 60 * 1000,
  })

  const contentLength = Number.parseInt(getHeader(event, "content-length") || "", 10)
  if (!Number.isNaN(contentLength) && contentLength > maxLocalUploadBytes)
    throw createError({ statusCode: 413, statusMessage: "Uploaded file exceeds the local file size limit." })

  const rawBody = await readRawBody(event, false)
  const bytes = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "")

  try {
    const upload = await writeLocalFileUploadContent(uploadId, readUploadToken(event), bytes)

    return {
      upload: {
        id: upload.id,
        scanStatus: upload.scan_status,
        sizeBytes: upload.size_bytes,
        status: upload.status,
      },
    }
  }
  catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : "Local upload failed.",
    })
  }
})
