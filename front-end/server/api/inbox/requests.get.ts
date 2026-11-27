import { defineEventHandler } from "h3"
import { requireAuthenticatedSession } from "../../utils/auth"
import { loadInboxReadModel } from "../../utils/inbox-read-model"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "inbox:requests",
    windowMs: 60 * 1000,
  })

  const { queues } = await loadInboxReadModel(event, session)

  return {
    counts: {
      incoming: queues.pendingIncomingRequests.length,
      outgoing: queues.pendingOutgoingRequests.length,
    },
    requests: {
      incoming: queues.pendingIncomingRequests,
      outgoing: queues.pendingOutgoingRequests,
    },
  }
})
