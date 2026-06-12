import type { H3Event } from "h3"
import type { SessionUser } from "../../shared/types/domain"
import { buildRelationshipSnapshot } from "../../shared/utils/relationships"
import { loadMemberWorkspaceState } from "./member-workspace"
import { buildSessionIdentity } from "./session-identity"

export async function loadRelationshipReadModel(event: H3Event, session: SessionUser, matchId: string) {
  const workspace = await loadMemberWorkspaceState(event, buildSessionIdentity(session))
  const relationship = buildRelationshipSnapshot(workspace.seed, workspace.session.id, matchId)

  return {
    relationship,
    session: workspace.session,
    workspace,
  }
}
