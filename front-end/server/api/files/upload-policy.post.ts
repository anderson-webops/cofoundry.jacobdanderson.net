import { fileUploadPolicySchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../../utils/auth"
import { createFileUploadPolicy } from "../../utils/file-uploads"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 20,
    scope: "files:upload-policy",
    windowMs: 60 * 60 * 1000,
  })

  const payload = fileUploadPolicySchema.parse(await readBody(event))
  const policy = await createFileUploadPolicy(event, session, payload)

  return {
    policy,
  }
})
