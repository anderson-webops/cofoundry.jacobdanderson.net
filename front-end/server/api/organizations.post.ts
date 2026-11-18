import { defineEventHandler, readBody, setHeader } from "h3"
import { organizationCreateSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../utils/auth"
import { createOrganizationWorkspace } from "../utils/organization-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 5,
    scope: "organizations:create",
    windowMs: 24 * 60 * 60 * 1000,
  })
  const payload = organizationCreateSchema.parse(await readBody(event))
  const workspace = await createOrganizationWorkspace(event, session, payload)
  setHeader(event, "Cache-Control", "private, no-store")
  return { workspace }
})
