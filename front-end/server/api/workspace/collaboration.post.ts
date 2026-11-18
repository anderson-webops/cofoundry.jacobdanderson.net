import type { CollaborationMutationPayload } from "../../utils/collaboration-workflow"
import { defineEventHandler, readBody } from "h3"
import { collaborationMutationSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../../utils/auth"
import { applyCollaborationMutation } from "../../utils/collaboration-workflow"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "workspace:collaboration",
    windowMs: 60 * 1000,
  })
  const payload = collaborationMutationSchema.parse(await readBody(event)) as CollaborationMutationPayload

  return applyCollaborationMutation(event, session, payload)
})
