import type {
  Contract,
  ContractVersion,
  Match,
  Profile,
  Proposal,
  ProposalComment,
  ProposalVersion,
  SessionUser,
  TrialCollaboration,
  WorkspaceSeed,
} from "../types/domain"

export function getUserById(seed: WorkspaceSeed, userId: string) {
  return seed.users.find(user => user.id === userId)
}

export function getProfileByUserId(seed: WorkspaceSeed, userId: string) {
  return seed.profiles.find(profile => profile.userId === userId)
}

export function getSubscriptionByUserId(seed: WorkspaceSeed, userId: string) {
  return seed.subscriptions.find(subscription => subscription.userId === userId)
}

export function buildSessionUser(seed: WorkspaceSeed, userId: string): SessionUser | null {
  const user = getUserById(seed, userId)
  const profile = getProfileByUserId(seed, userId)
  const subscription = getSubscriptionByUserId(seed, userId)

  if (!user || !profile)
    return null

  return {
    id: user.id,
    email: user.email,
    name: profile.displayName,
    role: user.role,
    onboardingCompleted: user.onboardingCompleted,
    subscriptionPlan: subscription?.plan || "free",
  }
}

export function getCurrentProposalVersion(seed: WorkspaceSeed, proposal: Proposal) {
  return seed.proposalVersions.find(version => version.id === proposal.currentVersionId)
}

export function getCurrentContractVersion(seed: WorkspaceSeed, contract: Contract) {
  return seed.contractVersions.find(version => version.id === contract.currentVersionId)
}

export function getMatchesForUser(seed: WorkspaceSeed, userId: string) {
  return seed.matches.filter(match => match.participantIds.includes(userId))
}

export function getIncomingConnectRequestsForUser(seed: WorkspaceSeed, userId: string) {
  return seed.connectRequests
    .filter(request => request.toUserId === userId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function getOutgoingConnectRequestsForUser(seed: WorkspaceSeed, userId: string) {
  return seed.connectRequests
    .filter(request => request.fromUserId === userId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function getConversationByMatch(seed: WorkspaceSeed, match: Match) {
  return seed.conversations.find(conversation => conversation.id === match.conversationId)
}

export function getMatchByConversation(seed: WorkspaceSeed, conversationId: string) {
  return seed.matches.find(match => match.conversationId === conversationId)
}

export function getContractsForUser(seed: WorkspaceSeed, userId: string) {
  return seed.contracts.filter((contract) => {
    const proposal = seed.proposals.find(item => item.id === contract.proposalId)
    if (!proposal)
      return false

    return proposal.createdByUserId === userId || proposal.recipientUserId === userId
  })
}

export function getProposalsForUser(seed: WorkspaceSeed, userId: string) {
  return seed.proposals.filter(proposal => proposal.createdByUserId === userId || proposal.recipientUserId === userId)
}

export function getOpportunitiesForUser(seed: WorkspaceSeed, userId: string) {
  return seed.opportunities.filter(opportunity => opportunity.ownerUserId === userId)
}

export function getTrialsForUser(seed: WorkspaceSeed, userId: string) {
  const matchIds = seed.matches
    .filter(match => match.participantIds.includes(userId))
    .map(match => match.id)

  return seed.trialCollaborations.filter(trial => matchIds.includes(trial.matchId))
}

export function getTrialForMatch(seed: WorkspaceSeed, matchId: string) {
  return seed.trialCollaborations.find(trial => trial.matchId === matchId)
}

export function getMessagesForConversation(seed: WorkspaceSeed, conversationId: string) {
  return seed.messages
    .filter(message => message.conversationId === conversationId)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

export function buildAdminMetrics(seed: WorkspaceSeed) {
  const completedProfiles = seed.profiles.filter(profile => profile.verificationBadges.profileComplete).length
  const paidSubscriptions = seed.subscriptions.filter(subscription => subscription.plan !== "free").length

  return {
    newSignups: seed.users.length,
    profileCompletionRate: Math.round((completedProfiles / seed.profiles.length) * 100),
    connectRequests: seed.connectRequests.length,
    matches: seed.matches.length,
    proposalsCreated: seed.proposals.length,
    contractsCreated: seed.contracts.length,
    paidConversionRate: Math.round((paidSubscriptions / seed.users.length) * 100),
  }
}

export function buildRecommendationCards(seed: WorkspaceSeed, userId: string) {
  const profile = getProfileByUserId(seed, userId)
  if (!profile)
    return []

  return seed.opportunities
    .map((opportunity) => {
      let score = 0
      if (opportunity.rolesNeeded.some(role => profile.roles.includes(role)))
        score += 3
      if (opportunity.industries.some(industry => profile.industries.includes(industry)))
        score += 2
      if (profile.startupStagePreferences.includes(opportunity.stage))
        score += 2
      if (profile.compensationPreferences.includes(opportunity.compensationStructure))
        score += 1
      if (profile.timeCommitment === opportunity.expectedCommitment)
        score += 1
      return { opportunity, score }
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score)
}

export function createContractVersionDraft(
  contract: Contract,
  currentVersion: ContractVersion,
  partial: Partial<ContractVersion>,
): ContractVersion {
  return {
    ...currentVersion,
    ...partial,
    id: `${contract.id}_version_${currentVersion.versionNumber + 1}`,
    versionNumber: currentVersion.versionNumber + 1,
    createdAt: new Date().toISOString(),
  }
}

export function buildParticipantProfiles(seed: WorkspaceSeed, participantIds: string[]) {
  return participantIds
    .map(participantId => getProfileByUserId(seed, participantId))
    .filter(Boolean) as Profile[]
}

export function getOpportunityById(seed: WorkspaceSeed, opportunityId: string) {
  return seed.opportunities.find(opportunity => opportunity.id === opportunityId)
}

export function getProposalById(seed: WorkspaceSeed, proposalId: string) {
  return seed.proposals.find(proposal => proposal.id === proposalId)
}

export function getProposalByConversation(seed: WorkspaceSeed, conversationId: string) {
  return seed.proposals.find(proposal => proposal.conversationId === conversationId)
}

export function getProposalVersions(seed: WorkspaceSeed, proposalId: string) {
  return seed.proposalVersions
    .filter(version => version.proposalId === proposalId)
    .sort((left, right) => right.versionNumber - left.versionNumber)
}

export function getProposalComments(seed: WorkspaceSeed, proposalId: string): ProposalComment[] {
  return seed.proposalComments
    .filter(comment => comment.proposalId === proposalId)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export function getContractById(seed: WorkspaceSeed, contractId: string) {
  return seed.contracts.find(contract => contract.id === contractId)
}

export function getProfileSkills(seed: WorkspaceSeed, profileId: string) {
  return seed.profileSkills
    .filter(profileSkill => profileSkill.profileId === profileId)
    .map((profileSkill) => {
      const skill = seed.skills.find(item => item.id === profileSkill.skillId)
      return skill ? { ...profileSkill, skill } : null
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
}

export function getUnreadMessages(seed: WorkspaceSeed, userId: string) {
  return seed.conversations.reduce((total, conversation) => total + (conversation.unreadCountByUser[userId] || 0), 0)
}

export function getPendingReports(seed: WorkspaceSeed) {
  return seed.reports.filter(report => report.status === "open")
}

export function buildTrialDraft(
  match: Match,
  profiles: Profile[],
  createdByUserId: string,
): TrialCollaboration {
  const partnerNames = profiles.map(profile => profile.displayName).join(" + ")

  return {
    id: crypto.randomUUID(),
    matchId: match.id,
    createdByUserId,
    title: `${partnerNames} alignment sprint`,
    objective: "Pressure-test working style, scope ownership, and delivery quality before finalizing the long-term collaboration terms.",
    scope: "Use one realistic workflow slice to test communication, decision velocity, and whether the company shape still feels right after working together.",
    weeklyHours: 8,
    durationWeeks: 2,
    checkInCadence: "Two short check-ins each week plus a written review at the end of the sprint.",
    deliverables: [
      "One scoped workflow or prototype shipped together",
      "Shared written decision log covering role boundaries and open questions",
      "End-of-sprint review on whether to move into a formal proposal",
    ],
    successSignals: [
      "Both sides respond on time and keep commitments visible",
      "Decision rights feel clearer, not fuzzier, after the sprint",
      "The work creates conviction about moving into a real proposal",
    ],
    status: "draft",
    acknowledgedByUserIds: [createdByUserId],
    nextCheckInAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function getAcceptedProposalVersion(seed: WorkspaceSeed, proposalId: string): ProposalVersion | undefined {
  const proposal = seed.proposals.find(item => item.id === proposalId)
  if (!proposal)
    return undefined

  return seed.proposalVersions.find(version => version.id === proposal.currentVersionId)
}
