import type { H3Event } from "h3"
import type { FileUpload, FileUploadRelatedType, SessionUser, WorkspaceSeed } from "../../shared/types/domain"
import type { RelationshipSnapshot } from "../../shared/utils/relationships"
import { buildRelationshipSnapshot } from "../../shared/utils/relationships"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"
import { listFileUploadsByRelated } from "./file-uploads"
import { loadMemberWorkspaceState } from "./member-workspace"
import { buildSessionIdentity } from "./session-identity"

function mergeFileUploads(seed: WorkspaceSeed, fileUploads: FileUpload[]): WorkspaceSeed {
  if (!fileUploads.length)
    return seed

  const uploadById = new Map(seed.fileUploads.map(upload => [upload.id, upload]))
  fileUploads.forEach(upload => uploadById.set(upload.id, upload))

  return {
    ...seed,
    fileUploads: Array.from(uploadById.values()),
  }
}

function relationshipFileSelectors(seed: WorkspaceSeed, relationship: RelationshipSnapshot) {
  const selectors: Array<{ relatedId: string, relatedType: FileUploadRelatedType }> = []

  seed.messages
    .filter(message => message.conversationId === relationship.conversationId)
    .forEach(message => selectors.push({ relatedId: message.id, relatedType: "message" }))

  relationship.activeProposals.forEach(proposal => selectors.push({ relatedId: proposal.id, relatedType: "proposal" }))
  relationship.activeContracts.forEach(contract => selectors.push({ relatedId: contract.id, relatedType: "contract" }))

  return selectors
}

export async function loadRelationshipReadModel(event: H3Event, session: SessionUser, matchId: string) {
  const workspace = await loadMemberWorkspaceState(event, buildSessionIdentity(session))
  const projectedSeed = projectWorkspaceForSession(workspace.seed, workspace.session)
  const relationship = buildRelationshipSnapshot(projectedSeed, workspace.session.id, matchId)

  if (!relationship) {
    return {
      relationship,
      session: workspace.session,
      workspace,
    }
  }

  const fileUploads = await listFileUploadsByRelated(event, relationshipFileSelectors(projectedSeed, relationship))
  const seed = mergeFileUploads(workspace.seed, fileUploads)
  const refreshedSeed = projectWorkspaceForSession(seed, workspace.session)
  const refreshedRelationship = buildRelationshipSnapshot(refreshedSeed, workspace.session.id, matchId)

  return {
    relationship: refreshedRelationship,
    session: workspace.session,
    workspace: {
      ...workspace,
      seed: refreshedSeed,
    },
  }
}
