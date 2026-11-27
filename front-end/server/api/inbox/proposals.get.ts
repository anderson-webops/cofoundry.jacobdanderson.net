import { defineEventHandler } from "h3"
import { requireAuthenticatedSession } from "../../utils/auth"
import { loadInboxReadModel } from "../../utils/inbox-read-model"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "inbox:proposals",
    windowMs: 60 * 1000,
  })

  const { queues } = await loadInboxReadModel(event, session)

  return {
    count: queues.proposalsNeedingResponse.length,
    proposals: queues.proposalsNeedingResponse,
  }
})
