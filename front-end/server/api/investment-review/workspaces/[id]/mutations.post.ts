import { setHeader } from "h3"
import { investmentReviewerMutationEnvelopeSchema } from "~/shared/utils/investment-validation"
import { requireInvestmentReviewerSession } from "../../../../utils/admin"
import { mutateInvestmentReviewerWorkspace } from "../../../../utils/investment-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireInvestmentReviewerSession(event)
  const workspaceId = getRouterParam(event, "id")
  if (!workspaceId)
    throw createError({ statusCode: 400, statusMessage: "Review case id is required." })
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, workspaceId),
    limit: 240,
    scope: "investment-review:mutate",
    windowMs: 60 * 60 * 1000,
  })
  const payload = investmentReviewerMutationEnvelopeSchema.parse(await readBody(event))
  const workspace = await mutateInvestmentReviewerWorkspace(
    event,
    session,
    workspaceId,
    payload.expectedVersion,
    payload.mutation,
  )
  setHeader(event, "Cache-Control", "private, no-store")
  return { workspace }
})
