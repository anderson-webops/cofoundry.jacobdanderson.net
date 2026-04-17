import { requireAuthenticatedSession } from "~/server/utils/auth"
import { loadMemberWorkspaceState } from "../utils/member-workspace"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const workspace = await loadMemberWorkspaceState(event, {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  })

  return {
    data: workspace.seed,
    session: workspace.session,
  }
})
