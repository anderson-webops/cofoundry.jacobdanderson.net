import type { H3Event } from "h3"
import type { SessionUser } from "../../shared/types/domain"
import { buildInboxQueues, buildInboxSnapshot } from "../../shared/utils/inbox"
import { loadMemberWorkspaceState } from "./member-workspace"
import { buildSessionIdentity } from "./session-identity"

export async function loadInboxReadModel(event: H3Event, session: SessionUser) {
  const workspace = await loadMemberWorkspaceState(event, buildSessionIdentity(session))
  const queues = buildInboxQueues(workspace.seed, workspace.session.id)

  return {
    queues,
    session: workspace.session,
    snapshot: buildInboxSnapshot(workspace.seed, workspace.session.id, queues),
    workspace,
  }
}
