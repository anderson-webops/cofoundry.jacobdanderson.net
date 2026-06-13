import { setHeader } from "h3"
import { requireAuthenticatedSession } from "../../utils/auth"
import { loadMemberWorkspaceState } from "../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

function buildIdentity(session: Awaited<ReturnType<typeof requireAuthenticatedSession>>) {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 10,
    scope: "account:export",
    windowMs: 60 * 60 * 1000,
  })

  const workspace = await loadMemberWorkspaceState(event, buildIdentity(session))
  const { seed, state } = workspace
  const conversations = seed.conversations.filter(conversation => conversation.participantIds.includes(session.id))
  const conversationIds = new Set(conversations.map(conversation => conversation.id))
  const matches = seed.matches.filter(match => match.participantIds.includes(session.id))
  const matchIds = new Set(matches.map(match => match.id))
  const proposals = seed.proposals.filter(proposal => proposal.createdByUserId === session.id || proposal.recipientUserId === session.id)
  const proposalIds = new Set(proposals.map(proposal => proposal.id))
  const contracts = seed.contracts.filter(contract => proposalIds.has(contract.proposalId))
  const contractIds = new Set(contracts.map(contract => contract.id))
  const ownedProfileIds = new Set(seed.profiles.filter(profile => profile.userId === session.id).map(profile => profile.id))

  const exportPayload = {
    account: state.user,
    bookmarks: state.bookmarks,
    collaboration: {
      connectRequests: seed.connectRequests.filter(request => request.fromUserId === session.id || request.toUserId === session.id),
      contractVersions: seed.contractVersions.filter(version => contractIds.has(version.contractId)),
      contracts,
      conversations,
      matches,
      messages: seed.messages.filter(message => conversationIds.has(message.conversationId)),
      notifications: seed.notifications.filter(notification => notification.userId === session.id),
      proposalComments: seed.proposalComments.filter(comment => proposalIds.has(comment.proposalId) || comment.authorUserId === session.id),
      proposalVersions: seed.proposalVersions.filter(version => proposalIds.has(version.proposalId)),
      proposals,
      relationshipDecisions: seed.relationshipDecisions.filter(decision => matchIds.has(decision.matchId) || decision.authorUserId === session.id),
      reports: seed.reports.filter(report => report.reporterUserId === session.id || ownedProfileIds.has(report.targetId)),
      signatures: seed.signatures.filter(signature => signature.userId === session.id || contractIds.has(signature.contractId)),
      trialCollaborations: seed.trialCollaborations.filter(trial => matchIds.has(trial.matchId)),
    },
    exportedAt: new Date().toISOString(),
    profile: state.profile,
    savedSearches: state.savedSearches,
    startupOpportunities: state.opportunities,
    subscription: state.subscription,
  }

  setHeader(event, "Content-Disposition", `attachment; filename="cofoundry-data-export-${session.id}.json"`)
  return exportPayload
})
