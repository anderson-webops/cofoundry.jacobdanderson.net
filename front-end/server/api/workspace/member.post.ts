import type { MemberWorkspaceWritePayload } from "~/shared/types/domain"
import { requireAuthenticatedSession } from "~/server/utils/auth"
import { persistMemberWorkspaceWritePayload } from "../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "workspace:member",
    windowMs: 60 * 1000,
  })
  const body = await readBody<{ state: MemberWorkspaceWritePayload }>(event)

  if (!body?.state)
    throw createError({ statusCode: 400, statusMessage: "A member workspace payload is required." })

  const workspace = await persistMemberWorkspaceWritePayload(event, {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }, body.state)

  return {
    data: workspace.seed,
    session: workspace.session,
  }
})
