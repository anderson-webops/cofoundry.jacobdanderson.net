import type {
  Contract,
  ContractVersion,
  Match,
  Profile,
  Proposal,
  ProposalVersion,
  SessionUser,
  Subscription,
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

export function getConversationByMatch(seed: WorkspaceSeed, match: Match) {
  return seed.conversations.find(conversation => conversation.id === match.conversationId)
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

export function getSubscriptionEntitlements(subscription?: Subscription) {
  return {
    canMessageFreely: subscription?.unlimitedMessaging || false,
    canUseProposals: subscription?.proposalWorkflow || false,
    canUseContracts: subscription?.contractBuilder || false,
    hasVisibilityBoost: subscription?.visibilityBoost || false,
  }
}

export function getAcceptedProposalVersion(seed: WorkspaceSeed, proposalId: string): ProposalVersion | undefined {
  const proposal = seed.proposals.find(item => item.id === proposalId)
  if (!proposal)
    return undefined

  return seed.proposalVersions.find(version => version.id === proposal.currentVersionId)
}
