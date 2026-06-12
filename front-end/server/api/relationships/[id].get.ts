import { getRouterParam } from "h3"
import { requireAuthenticatedSession } from "../../utils/auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { loadRelationshipReadModel } from "../../utils/relationship-read-model"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "relationships:read",
    windowMs: 60 * 1000,
  })

  const matchId = getRouterParam(event, "id")

  if (!matchId)
    throw createError({ statusCode: 400, statusMessage: "Relationship id is required." })

  const { relationship } = await loadRelationshipReadModel(event, session, matchId)
  if (!relationship)
    throw createError({ statusCode: 404, statusMessage: "Relationship not found." })

  return {
    relationship,
  }
})
