import { setHeader } from "h3"
import { requireAuthenticatedSession } from "../utils/auth"
import { loadOrganizationWorkspaceSnapshot } from "../utils/organization-workspaces"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 90,
    scope: "organizations:list",
    windowMs: 60 * 1000,
  })
  setHeader(event, "Cache-Control", "private, no-store")
  return loadOrganizationWorkspaceSnapshot(event, session)
})
