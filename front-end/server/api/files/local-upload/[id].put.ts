import type { H3Event } from "h3"
import { Buffer } from "node:buffer"
import { getHeader, getRouterParam, readRawBody } from "h3"
import { assertLocalFileUploadToken, writeLocalFileUploadContent } from "../../../utils/local-operations-store"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { isSupabaseEnabled } from "../../../utils/supabase"

const maxLocalUploadBytes = 10 * 1024 * 1024

function readUploadToken(event: H3Event) {
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
    limit: 60,
    scope: "files:local-upload:ip",
    windowMs: 60 * 60 * 1000,
  })
  assertRateLimit(event, {
    key: buildRateLimitKey(event, uploadId),
    limit: 5,
    scope: "files:local-upload:policy",
    windowMs: 60 * 60 * 1000,
  })

  const token = readUploadToken(event)
  if (!token || token.length > 200)
    throw createError({ statusCode: 401, statusMessage: "A valid upload token is required." })

  let policy: Awaited<ReturnType<typeof assertLocalFileUploadToken>>
  try {
    policy = await assertLocalFileUploadToken(uploadId, token)
  }
  catch {
    throw createError({ statusCode: 401, statusMessage: "Local upload token is invalid or expired." })
  }

  const contentLengthHeader = getHeader(event, "content-length") || ""
  if (!contentLengthHeader)
    throw createError({ statusCode: 411, statusMessage: "Uploads must declare their exact Content-Length." })

  const contentLength = Number.parseInt(contentLengthHeader, 10)
  if (contentLength > maxLocalUploadBytes)
    throw createError({ statusCode: 413, statusMessage: "Uploaded file exceeds the local file size limit." })
  if (contentLength !== policy.sizeBytes)
    throw createError({ statusCode: 400, statusMessage: "Uploaded file size does not match the requested upload policy." })

  const rawBody = await readRawBody(event, false)
  const bytes = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(rawBody || "")

  try {
    const upload = await writeLocalFileUploadContent(uploadId, token, bytes)

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
    console.warn("[files] Local upload write failed.", {
      error,
      uploadId,
    })
    throw createError({
      statusCode: 400,
      statusMessage: "Local upload could not be completed.",
    })
  }
})
