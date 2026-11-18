import { createError, defineEventHandler, getRouterParam, readBody, setHeader } from "h3"
import { organizationMutationEnvelopeSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { mutateOrganizationWorkspace } from "../../../utils/organization-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const organizationId = getRouterParam(event, "id")
  if (!organizationId)
    throw createError({ statusCode: 400, statusMessage: "Organization id is required." })
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id, organizationId),
    limit: 120,
    scope: "organizations:mutate",
    windowMs: 60 * 60 * 1000,
  })
  const payload = organizationMutationEnvelopeSchema.parse(await readBody(event))
  const result = await mutateOrganizationWorkspace(
    event,
    session,
    organizationId,
    payload.expectedVersion,
    payload.mutation,
  )
  setHeader(event, "Cache-Control", "private, no-store")
  return result
})
