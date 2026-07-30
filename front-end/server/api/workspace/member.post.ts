import { requireAuthenticatedSession } from "~/server/utils/auth"
import { memberWorkspaceWriteEnvelopeSchema } from "~/shared/utils/validation"
import { projectWorkspaceForSession } from "~/shared/utils/workspace-authorization"
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
  const body = memberWorkspaceWriteEnvelopeSchema.parse(await readBody(event))

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
    data: projectWorkspaceForSession(workspace.seed, workspace.session),
    session: workspace.session,
  }
})
