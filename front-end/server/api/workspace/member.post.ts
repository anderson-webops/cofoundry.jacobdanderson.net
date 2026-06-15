import type { MemberWorkspaceWritePayload } from "~/shared/types/domain"
import { requireAuthenticatedSession } from "~/server/utils/auth"
import { persistMemberWorkspaceWritePayload } from "../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { emitWorkspaceRealtimeChange } from "../../utils/workspace-realtime"

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
  await emitWorkspaceRealtimeChange([session.id], {
    metadata: {
      action: "persist_member_workspace",
    },
    source: "workspace.member",
  })

  return {
    data: workspace.seed,
    session: workspace.session,
  }
})
