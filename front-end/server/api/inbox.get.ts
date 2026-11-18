import { defineEventHandler } from "h3"
import { requireAuthenticatedSession } from "~/server/utils/auth"
import { loadInboxReadModel } from "../utils/inbox-read-model"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "inbox:read-model",
    windowMs: 60 * 1000,
  })
  const readModel = await loadInboxReadModel(event, session)

  return {
    inbox: readModel.snapshot,
  }
})
