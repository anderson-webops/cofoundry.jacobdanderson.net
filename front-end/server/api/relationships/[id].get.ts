import { getRouterParam } from "h3"
import { buildRelationshipSnapshot } from "~/shared/utils/relationships"
import { requireAuthenticatedSession } from "../../utils/auth"
import { loadMemberWorkspaceState } from "../../utils/member-workspace"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const matchId = getRouterParam(event, "id")

  if (!matchId)
    throw createError({ statusCode: 400, statusMessage: "Relationship id is required." })

  const workspace = await loadMemberWorkspaceState(event, {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  })

  const relationship = buildRelationshipSnapshot(workspace.seed, workspace.session.id, matchId)
  if (!relationship)
    throw createError({ statusCode: 404, statusMessage: "Relationship not found." })

  return {
    relationship,
  }
})
