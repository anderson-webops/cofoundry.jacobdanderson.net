import { setHeader } from "h3"
import { redactReportForReporter } from "~/shared/utils/workspace-authorization"
import { requireAuthenticatedSession } from "../../utils/auth"
import { listContractLegalReviewsForContracts } from "../../utils/contract-legal-reviews"
import { listFileUploadsByRelated } from "../../utils/file-uploads"
import { loadInvestmentApplicantExport } from "../../utils/investment-workspaces"
import { loadMemberWorkspaceState } from "../../utils/member-workspace"
import { loadOrganizationWorkspaceSnapshot } from "../../utils/organization-workspaces"
import { listPrivacyRequestsForUser } from "../../utils/privacy-requests"
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
  const contractLegalReviews = await listContractLegalReviewsForContracts(event, [...contractIds])
  const privacyRequests = (await listPrivacyRequestsForUser(event, session.id)).map(request => ({
    createdAt: request.createdAt,
    details: request.details,
    id: request.id,
    resolvedAt: request.resolvedAt,
    reviewedAt: request.reviewedAt,
    status: request.status,
    type: request.type,
  }))
  const organizationSnapshot = await loadOrganizationWorkspaceSnapshot(event, session)
  const investmentWorkspaces = await loadInvestmentApplicantExport(event, session)
  const investmentFileUploads = (await listFileUploadsByRelated(event, investmentWorkspaces.flatMap(investmentWorkspace => [
    investmentWorkspace.id,
    investmentWorkspace.application.id,
  ].map(relatedId => ({
    relatedId,
    relatedType: "investment_workspace" as const,
  }))))).filter(upload => upload.ownerUserId === session.id).map(upload => ({
    createdAt: upload.createdAt,
    deletedAt: upload.deletedAt,
    id: upload.id,
    mimeType: upload.mimeType,
    originalFilename: upload.originalFilename,
    purpose: upload.purpose,
    relatedId: upload.relatedId,
    relatedType: upload.relatedType,
    scanStatus: upload.scanStatus,
    sizeBytes: upload.sizeBytes,
    status: upload.status,
    updatedAt: upload.updatedAt,
  }))
  const exportPayload = {
    account: state.user,
    bookmarks: state.bookmarks,
    collaboration: {
      connectRequests: seed.connectRequests.filter(request => request.fromUserId === session.id || request.toUserId === session.id),
      contractLegalReviews,
      contractVersions: seed.contractVersions.filter(version => contractIds.has(version.contractId)),
      contracts,
      conversations,
      investmentApplications: seed.investmentApplications.filter(application => application.applicantUserId === session.id),
      matches,
      messages: seed.messages.filter(message => conversationIds.has(message.conversationId)),
      notifications: seed.notifications.filter(notification => notification.userId === session.id),
      proposalComments: seed.proposalComments.filter(comment => proposalIds.has(comment.proposalId) || comment.authorUserId === session.id),
      proposalVersions: seed.proposalVersions.filter(version => proposalIds.has(version.proposalId)),
      proposals,
      relationshipDecisions: seed.relationshipDecisions.filter(decision => matchIds.has(decision.matchId) || decision.authorUserId === session.id),
      reports: seed.reports
        .filter(report => report.reporterUserId === session.id)
        .map(redactReportForReporter),
      signatures: seed.signatures.filter(signature => signature.userId === session.id || contractIds.has(signature.contractId)),
      trialCollaborations: seed.trialCollaborations.filter(trial => matchIds.has(trial.matchId)),
    },
    exportedAt: new Date().toISOString(),
    investmentWorkspaces,
    investmentFileUploads,
    organizations: organizationSnapshot.workspaces,
    privacyRequests,
    profile: state.profile,
    savedSearches: state.savedSearches,
    startupOpportunities: state.opportunities,
    subscription: state.subscription,
  }

  setHeader(event, "Content-Disposition", `attachment; filename="cofoundry-data-export-${session.id}.json"`)
  return exportPayload
})
