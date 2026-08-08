import { setHeader } from "h3"
import { investmentApplicantMutationEnvelopeSchema } from "~/shared/utils/investment-validation"
import { requireAuthenticatedSession } from "../../../../utils/auth"
import { mutateInvestmentApplicantWorkspace } from "../../../../utils/investment-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const workspaceId = getRouterParam(event, "id")
  if (!workspaceId)
    throw createError({ statusCode: 400, statusMessage: "Investment workspace id is required." })
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, workspaceId),
    limit: 180,
    scope: "investment-workspaces:mutate",
    windowMs: 60 * 60 * 1000,
  })
  const payload = investmentApplicantMutationEnvelopeSchema.parse(await readBody(event))
  const workspace = await mutateInvestmentApplicantWorkspace(
    event,
    session,
    workspaceId,
    payload.expectedVersion,
    payload.mutation,
  )
  setHeader(event, "Cache-Control", "private, no-store")
  return { workspace }
})
