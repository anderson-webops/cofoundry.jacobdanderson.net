import { requireAuthenticatedSession } from "~/server/utils/auth"
import { projectWorkspaceForSession } from "~/shared/utils/workspace-authorization"
import { loadMemberWorkspaceState } from "../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 120,
    scope: "workspace:read",
    windowMs: 60 * 1000,
  })
  const workspace = await loadMemberWorkspaceState(event, {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  })

  return {
    data: projectWorkspaceForSession(workspace.seed, workspace.session),
    session: workspace.session,
  }
})
