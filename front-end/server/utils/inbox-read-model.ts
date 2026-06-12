import type { H3Event } from "h3"
import type { SessionUser } from "../../shared/types/domain"
import { buildInboxQueues, buildInboxSnapshot } from "../../shared/utils/inbox"
import { loadMemberWorkspaceState } from "./member-workspace"

function buildIdentity(session: SessionUser) {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

export async function loadInboxReadModel(event: H3Event, session: SessionUser) {
  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const queues = buildInboxQueues(workspace.seed, workspace.session.id)

  return {
    queues,
    session: workspace.session,
    snapshot: buildInboxSnapshot(workspace.seed, workspace.session.id, queues),
    workspace,
  }
}
