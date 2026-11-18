import { defineEventHandler, setHeader } from "h3"
import { requireInvestmentReviewerSession } from "../../../utils/admin"
import { loadInvestmentReviewerSnapshot } from "../../../utils/investment-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireInvestmentReviewerSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "investment-review:list",
    windowMs: 60 * 1000,
  })
  setHeader(event, "Cache-Control", "private, no-store")
  return loadInvestmentReviewerSnapshot(event, session)
})
