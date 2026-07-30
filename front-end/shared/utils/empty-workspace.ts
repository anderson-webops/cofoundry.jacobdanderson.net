import type { WorkspaceSeed } from "../types/domain"

export function createEmptyWorkspaceSeed(): WorkspaceSeed {
  return {
    version: "empty",
    users: [],
    profiles: [],
    skills: [],
    profileSkills: [],
    opportunities: [],
    opportunityRoles: [],
    bookmarks: [],
    connectRequests: [],
    matches: [],
    conversations: [],
    messages: [],
    proposals: [],
    proposalVersions: [],
    proposalComments: [],
    contracts: [],
    contractVersions: [],
    signatures: [],
    trialCollaborations: [],
    relationshipDecisions: [],
    subscriptions: [],
    reports: [],
    adminActions: [],
    investmentApplications: [],
    notifications: [],
    fileUploads: [],
    savedSearches: [],
  }
}
