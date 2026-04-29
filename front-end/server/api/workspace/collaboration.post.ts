import type { CollaborationMutationPayload } from "../../utils/collaboration-workflow"
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
  const payload = await readBody<CollaborationMutationPayload>(event)

  if (!payload?.action)
    throw createError({ statusCode: 400, statusMessage: "A collaboration action is required." })

  return applyCollaborationMutation(event, session, payload)
})
