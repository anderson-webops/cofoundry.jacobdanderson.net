import type { FileUpload, Profile, Report, SessionUser, User, WorkspaceSeed } from "../types/domain"
import { hasPaidContractWorkflowSponsor } from "./billing"
import { cloneValue } from "./clone"
import { sanitizeNotificationHref } from "./inbox"

function isFullAdminRole(role: SessionUser["role"]) {
  return role === "admin"
}

function redactUser(user: User, revealEmail: boolean): User {
  return {
    ...user,
    email: revealEmail ? user.email : "",
    linkedProviders: [],
    notificationPreferences: {
      unreadDigestEmail: false,
      workflowEmail: false,
    },
    suspendedAt: null,
  }
}

function redactProfile(profile: Profile, options: { relationship: boolean, revealContact: boolean }): Profile {
  return {
    ...profile,
    photoUrl: "",
    links: options.revealContact
      ? profile.links
      : {
          github: "",
          linkedin: "",
          portfolio: "",
          website: "",
        },
    portfolio: profile.privacy.portfolioVisibility === "private" && !options.relationship
      ? []
      : profile.portfolio,
  }
}

function sanitizeNotifications(seed: WorkspaceSeed) {
  seed.notifications = seed.notifications.map(notification => ({
    ...notification,
    href: sanitizeNotificationHref(notification.href),
  }))
  return seed
}

export function redactReportForReporter(report: Report): Report {
  return {
    ...report,
    resolutionNotes: null,
    resolvedByUserId: null,
    reviewNotes: null,
    reviewedByUserId: null,
  }
}

function redactFileUploadForMember(upload: FileUpload): FileUpload {
  return {
    ...upload,
    bucket: "",
    objectPath: "",
    scanNotes: null,
  }
}

function projectInvestorAdminWorkspace(source: WorkspaceSeed, userId: string): WorkspaceSeed {
  const ownProfileIds = new Set(
    source.profiles
      .filter(profile => profile.userId === userId)
      .map(profile => profile.id),
  )

  return {
    ...source,
    users: source.users.filter(user => user.id === userId),
    profiles: source.profiles.filter(profile => profile.userId === userId),
    profileSkills: source.profileSkills.filter(skill => ownProfileIds.has(skill.profileId)),
    opportunities: [],
    opportunityRoles: [],
    bookmarks: source.bookmarks.filter(bookmark => bookmark.userId === userId),
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
    subscriptions: source.subscriptions.filter(subscription => subscription.userId === userId),
    reports: source.reports
      .filter(report => report.reporterUserId === userId)
      .map(redactReportForReporter),
    adminActions: [],
    investmentApplications: source.investmentApplications.filter(application => application.applicantUserId === userId),
    notifications: source.notifications
      .filter(notification => notification.userId === userId)
      .map(notification => ({
        ...notification,
        href: sanitizeNotificationHref(notification.href),
      })),
    fileUploads: source.fileUploads
      .filter(upload => upload.ownerUserId === userId)
      .map(redactFileUploadForMember),
    savedSearches: source.savedSearches.filter(search => search.userId === userId),
  }
}

export function projectWorkspaceForSession(seed: WorkspaceSeed, session: SessionUser): WorkspaceSeed {
  const source = cloneValue(seed)

  if (isFullAdminRole(session.role))
    return sanitizeNotifications(source)

  if (session.role === "investor_admin")
    return projectInvestorAdminWorkspace(source, session.id)

  const userId = session.id
  const matchIds = new Set(
    source.matches
      .filter(match => match.participantIds.includes(userId))
      .map(match => match.id),
  )
  const matchedUserIds = new Set(
    source.matches
      .filter(match => match.participantIds.includes(userId))
      .flatMap(match => match.participantIds),
  )
  const conversationIds = new Set(
    source.conversations
      .filter(conversation => conversation.participantIds.includes(userId))
      .map(conversation => conversation.id),
  )
  const collaborationUserIds = new Set<string>([
    userId,
    ...matchedUserIds,
    ...source.conversations
      .filter(conversation => conversation.participantIds.includes(userId))
      .flatMap(conversation => conversation.participantIds),
    ...source.proposals
      .filter(proposal => proposal.createdByUserId === userId || proposal.recipientUserId === userId)
      .flatMap(proposal => [proposal.createdByUserId, proposal.recipientUserId]),
  ])
  const interactionUserIds = new Set<string>([
    ...collaborationUserIds,
    ...source.connectRequests
      .filter(request => request.fromUserId === userId || request.toUserId === userId)
      .flatMap(request => [request.fromUserId, request.toUserId]),
  ])
  const acceptedProposalUserIds = new Set(
    source.proposals
      .filter(proposal =>
        proposal.status === "accepted"
        && (proposal.createdByUserId === userId || proposal.recipientUserId === userId),
      )
      .flatMap(proposal => [proposal.createdByUserId, proposal.recipientUserId]),
  )
  const proposalIds = new Set(
    source.proposals
      .filter(proposal => proposal.createdByUserId === userId || proposal.recipientUserId === userId)
      .map(proposal => proposal.id),
  )
  const contractIds = new Set(
    source.contracts
      .filter(contract => proposalIds.has(contract.proposalId))
      .map(contract => contract.id),
  )
  const contractUserIds = new Set(
    source.contracts
      .filter(contract => contractIds.has(contract.id))
      .flatMap((contract) => {
        const proposal = source.proposals.find(item => item.id === contract.proposalId)
        return proposal
          ? [proposal.createdByUserId, proposal.recipientUserId]
          : []
      }),
  )
  const canRevealContact = (profileOwnerId: string) => {
    if (profileOwnerId === userId)
      return true

    const profile = source.profiles.find(item => item.userId === profileOwnerId)
    if (!profile?.privacy.contactDetailsVisibleToMatchesOnly)
      return true

    if (profile.privacy.contactRevealStage === "matches")
      return matchedUserIds.has(profileOwnerId)
    if (profile.privacy.contactRevealStage === "proposal_accepted")
      return acceptedProposalUserIds.has(profileOwnerId)

    return contractUserIds.has(profileOwnerId)
  }

  const visibleProfiles = source.profiles.filter(profile =>
    profile.userId === userId
    || interactionUserIds.has(profile.userId)
    || profile.privacy.profileVisibility !== "private",
  )
  const visibleProfileIds = new Set(visibleProfiles.map(profile => profile.id))
  const visibleProfileUserIds = new Set(visibleProfiles.map(profile => profile.userId))
  const visibleOpportunities = source.opportunities.filter((opportunity) => {
    if (opportunity.ownerUserId === userId || collaborationUserIds.has(opportunity.ownerUserId))
      return true

    const ownerProfile = source.profiles.find(profile => profile.userId === opportunity.ownerUserId)
    return Boolean(ownerProfile && ownerProfile.privacy.opportunityVisibility !== "private")
  }).map(opportunity => ({
    ...opportunity,
    riskFlags: opportunity.ownerUserId === userId
      ? opportunity.riskFlags
      : [],
  }))
  const visibleOpportunityIds = new Set(visibleOpportunities.map(opportunity => opportunity.id))
  const visibleUserIds = new Set([
    userId,
    ...interactionUserIds,
    ...visibleProfileUserIds,
    ...visibleOpportunities.map(opportunity => opportunity.ownerUserId),
  ])
  const messageIds = new Set(
    source.messages
      .filter(message => conversationIds.has(message.conversationId))
      .map(message => message.id),
  )

  return {
    ...source,
    users: source.users
      .filter(user => visibleUserIds.has(user.id))
      .map(user => user.id === userId
        ? user
        : redactUser(user, canRevealContact(user.id))),
    profiles: visibleProfiles.map(profile =>
      profile.userId === userId
        ? profile
        : redactProfile(profile, {
            relationship: collaborationUserIds.has(profile.userId),
            revealContact: canRevealContact(profile.userId),
          }),
    ),
    profileSkills: source.profileSkills.filter(skill => visibleProfileIds.has(skill.profileId)),
    opportunities: visibleOpportunities,
    opportunityRoles: source.opportunityRoles.filter(role => visibleOpportunityIds.has(role.opportunityId)),
    bookmarks: source.bookmarks.filter(bookmark => bookmark.userId === userId),
    connectRequests: source.connectRequests.filter(request => request.fromUserId === userId || request.toUserId === userId),
    matches: source.matches.filter(match => matchIds.has(match.id)),
    conversations: source.conversations.filter(conversation => conversationIds.has(conversation.id)),
    messages: source.messages.filter(message => conversationIds.has(message.conversationId)),
    proposals: source.proposals.filter(proposal => proposalIds.has(proposal.id)),
    proposalVersions: source.proposalVersions.filter(version => proposalIds.has(version.proposalId)),
    proposalComments: source.proposalComments.filter(comment => proposalIds.has(comment.proposalId)),
    contracts: source.contracts
      .filter(contract => contractIds.has(contract.id))
      .map(contract => ({
        ...contract,
        workflowSponsored: hasPaidContractWorkflowSponsor(source, contract),
      })),
    contractVersions: source.contractVersions.filter(version => contractIds.has(version.contractId)),
    signatures: source.signatures.filter(signature => contractIds.has(signature.contractId)),
    trialCollaborations: source.trialCollaborations.filter(trial => matchIds.has(trial.matchId)),
    relationshipDecisions: source.relationshipDecisions.filter(decision => matchIds.has(decision.matchId)),
    subscriptions: source.subscriptions.filter(subscription => subscription.userId === userId),
    reports: source.reports
      .filter(report => report.reporterUserId === userId)
      .map(redactReportForReporter),
    adminActions: [],
    investmentApplications: source.investmentApplications.filter(application => application.applicantUserId === userId),
    notifications: source.notifications
      .filter(notification => notification.userId === userId)
      .map(notification => ({
        ...notification,
        href: sanitizeNotificationHref(notification.href),
      })),
    fileUploads: source.fileUploads
      .filter(upload =>
        upload.ownerUserId === userId
        || (
          upload.status === "uploaded"
          && upload.scanStatus === "clean"
          && upload.purpose !== "trust_evidence"
          && (
            (upload.relatedType === "message" && Boolean(upload.relatedId && messageIds.has(upload.relatedId)))
            || (upload.relatedType === "proposal" && Boolean(upload.relatedId && proposalIds.has(upload.relatedId)))
            || (upload.relatedType === "contract" && Boolean(upload.relatedId && contractIds.has(upload.relatedId)))
          )
        ),
      )
      .map(redactFileUploadForMember),
    savedSearches: source.savedSearches.filter(search => search.userId === userId),
  }
}
