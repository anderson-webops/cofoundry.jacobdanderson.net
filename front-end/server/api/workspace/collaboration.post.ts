import type { CollaborationMutationPayload } from "../../utils/collaboration-workflow"
import { requireAuthenticatedSession } from "../../utils/auth"
import { applyCollaborationMutation } from "../../utils/collaboration-workflow"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const payload = await readBody<CollaborationMutationPayload>(event)

  if (!payload?.action)
    throw createError({ statusCode: 400, statusMessage: "A collaboration action is required." })

  return applyCollaborationMutation(event, session, payload)
})
