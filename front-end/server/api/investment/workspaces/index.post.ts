import { setHeader } from "h3"
import { investmentWorkspaceCreateSchema } from "~/shared/utils/investment-validation"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { createInvestmentWorkspace } from "../../../utils/investment-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 10,
    scope: "investment-workspaces:create",
    windowMs: 24 * 60 * 60 * 1000,
  })
  const payload = investmentWorkspaceCreateSchema.parse(await readBody(event))
  const workspace = await createInvestmentWorkspace(event, session, payload)
  setHeader(event, "Cache-Control", "private, no-store")
  return { workspace }
})
