import { createError, defineEventHandler, getRouterParam, setHeader } from "h3"
import { requireInvestmentReviewerSession } from "../../../utils/admin"
import { loadInvestmentReviewerWorkspace } from "../../../utils/investment-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireInvestmentReviewerSession(event)
  const workspaceId = getRouterParam(event, "id")
  if (!workspaceId)
    throw createError({ statusCode: 400, statusMessage: "Review case id is required." })
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, workspaceId),
    limit: 120,
    scope: "investment-review:case",
    windowMs: 60 * 1000,
  })
  setHeader(event, "Cache-Control", "private, no-store")
  return loadInvestmentReviewerWorkspace(event, session, workspaceId)
})
