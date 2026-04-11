import type {
  BookmarkTargetType,
  ConnectRequestStatus,
  ContractVersion,
  MessageAttachment,
  NotificationType,
  ProposalStatus,
  SearchFilters,
  SessionUser,
  WorkspaceSeed,
} from "~/shared/types/domain"
import { useStorage } from "@vueuse/core"
import { acceptHMRUpdate, defineStore } from "pinia"
import { workspaceSeed } from "~/shared/data/seed"
import { cloneValue } from "~/shared/utils/clone"
import { buildContractVersionFromProposal } from "~/shared/utils/contracts"
import {
  getContractById,
  getCurrentContractVersion,
  getCurrentProposalVersion,
  getMessagesForConversation,
  getProfileByUserId,
  getProposalById,
  getSubscriptionByUserId,
} from "~/shared/utils/workspace"

function now() {
  return new Date().toISOString()
}

const opportunitySlugPattern = /[^a-z0-9]+/g
const opportunitySlugTrimPattern = /^-|-$/g

function createOpportunitySlug(input: string) {
  return input.toLowerCase().replaceAll(opportunitySlugPattern, "-").replaceAll(opportunitySlugTrimPattern, "")
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const data = useStorage<WorkspaceSeed>("cofoundry-workspace", cloneValue(workspaceSeed), undefined, {
    mergeDefaults: true,
  })

  const ready = ref(false)

  function ensureReady() {
    if (!ready.value)
      ready.value = true
  }

  function resetToSeed() {
    data.value = cloneValue(workspaceSeed)
  }

  function ensureSessionUser(session: SessionUser) {
    ensureReady()

    const existingUser = data.value.users.find(user => user.id === session.id)
    const existingProfile = data.value.profiles.find(profile => profile.userId === session.id)
    const existingSubscription = getSubscriptionByUserId(data.value, session.id)

    if (!existingUser) {
      data.value.users.push({
        id: session.id,
        email: session.email,
        role: session.role,
        createdAt: now(),
        linkedProviders: ["email"],
        verifiedEmail: true,
        onboardingCompleted: session.onboardingCompleted,
        suspendedAt: null,
      })
    }

    if (!existingProfile) {
      data.value.profiles.push({
        id: `profile_${session.id}`,
        userId: session.id,
        displayName: session.name,
        headline: "New member getting their founder profile ready.",
        bio: "Add your background, experience, and operating style to start matching with the right people.",
        location: "Remote",
        remotePreference: "remote",
        roles: [session.role === "founder" ? "Founder" : "Collaborator"],
        yearsExperience: 0,
        industries: [],
        startupStagePreferences: ["idea"],
        compensationPreferences: ["equity_only"],
        equityExpectationRange: "Flexible",
        timeCommitment: "part_time",
        links: {
          linkedin: "",
          github: "",
          portfolio: "",
          website: "",
        },
        hasIdea: session.role === "founder",
        wantsToJoinIdea: session.role !== "founder",
        values: ["Candor"],
        workStylePreferences: ["Async updates"],
        privacy: {
          profileVisibility: "members",
          portfolioVisibility: "private",
          opportunityVisibility: "members",
          contactDetailsVisibleToMatchesOnly: true,
        },
        verificationBadges: {
          profileComplete: false,
          emailVerified: true,
          linkedAccounts: false,
        },
        availability: "Profile still in progress.",
        portfolio: [],
        ventures: [],
        summaryHighlights: ["Finish onboarding to appear in recommendations"],
      })
    }

    if (!existingSubscription) {
      data.value.subscriptions.push({
        id: `subscription_${session.id}`,
        userId: session.id,
        plan: session.subscriptionPlan,
        status: "active",
        billingCycle: "monthly",
        renewsAt: null,
        visibilityBoost: false,
        unlimitedMessaging: false,
        proposalWorkflow: false,
        contractBuilder: false,
      })
    }
  }

  function createDraftUserFromSignUp(session: SessionUser, displayName: string) {
    ensureSessionUser({
      ...session,
      name: displayName,
    })
  }

  function updateCurrentProfile(
    userId: string,
    payload: {
      displayName: string
      headline: string
      bio: string
      location: string
      remotePreference: "remote" | "hybrid" | "in_person"
      roles: string[]
      yearsExperience: number
      industries: string[]
      startupStagePreferences: ("idea" | "prototype" | "mvp" | "revenue" | "growth")[]
      compensationPreferences: ("equity_only" | "cash_and_equity" | "cash_only" | "advisory")[]
      equityExpectationRange: string
      timeCommitment: "nights_weekends" | "part_time" | "full_time"
      linkedin: string
      github: string
      portfolio: string
      website: string
      hasIdea: boolean
      wantsToJoinIdea: boolean
      values: string[]
      workStylePreferences: string[]
      profileVisibility: "public" | "members" | "private"
    },
  ) {
    ensureReady()

    const profile = getProfileByUserId(data.value, userId)
    const user = data.value.users.find(item => item.id === userId)
    if (!profile || !user)
      return

    profile.displayName = payload.displayName
    profile.headline = payload.headline
    profile.bio = payload.bio
    profile.location = payload.location
    profile.remotePreference = payload.remotePreference
    profile.roles = payload.roles
    profile.yearsExperience = payload.yearsExperience
    profile.industries = payload.industries
    profile.startupStagePreferences = payload.startupStagePreferences
    profile.compensationPreferences = payload.compensationPreferences
    profile.equityExpectationRange = payload.equityExpectationRange
    profile.timeCommitment = payload.timeCommitment
    profile.links = {
      linkedin: payload.linkedin,
      github: payload.github,
      portfolio: payload.portfolio,
      website: payload.website,
    }
    profile.hasIdea = payload.hasIdea
    profile.wantsToJoinIdea = payload.wantsToJoinIdea
    profile.values = payload.values
    profile.workStylePreferences = payload.workStylePreferences
    profile.privacy.profileVisibility = payload.profileVisibility
    profile.verificationBadges.profileComplete = true
    profile.summaryHighlights = [
      payload.hasIdea ? "Actively building a startup idea" : "Looking to join a serious founding team",
      `${payload.roles[0]} · ${payload.timeCommitment.replaceAll("_", " ")}`,
      payload.industries.join(" · "),
    ]
    user.onboardingCompleted = true
  }

  function createOpportunity(userId: string, payload: {
    startupName: string
    oneLinePitch: string
    problem: string
    targetUsers: string
    stage: "idea" | "prototype" | "mvp" | "revenue" | "growth"
    traction: string
    rolesNeeded: string[]
    expectedCommitment: "nights_weekends" | "part_time" | "full_time"
    compensationStructure: "equity_only" | "cash_and_equity" | "cash_only" | "advisory"
    equityRange: string
    location: string
    remotePreference: "remote" | "hybrid" | "in_person"
    industries: string[]
  }) {
    const opportunityId = crypto.randomUUID()
    data.value.opportunities.unshift({
      id: opportunityId,
      ownerUserId: userId,
      startupName: payload.startupName,
      slug: createOpportunitySlug(payload.startupName),
      oneLinePitch: payload.oneLinePitch,
      problem: payload.problem,
      targetUsers: payload.targetUsers,
      stage: payload.stage,
      traction: payload.traction,
      rolesNeeded: payload.rolesNeeded,
      expectedCommitment: payload.expectedCommitment,
      compensationStructure: payload.compensationStructure,
      equityRange: payload.equityRange,
      industries: payload.industries,
      location: payload.location,
      remotePreference: payload.remotePreference,
      createdAt: now(),
      updatedAt: now(),
      isOpen: true,
    })

    return opportunityId
  }

  function toggleBookmark(userId: string, targetType: BookmarkTargetType, targetId: string) {
    const existing = data.value.bookmarks.find(bookmark => bookmark.userId === userId && bookmark.targetType === targetType && bookmark.targetId === targetId)

    if (existing) {
      data.value.bookmarks = data.value.bookmarks.filter(bookmark => bookmark.id !== existing.id)
      return false
    }

    data.value.bookmarks.unshift({
      id: crypto.randomUUID(),
      userId,
      targetType,
      targetId,
      createdAt: now(),
    })
    return true
  }

  function saveSearch(userId: string, scope: "profiles" | "opportunities", label: string, filters: SearchFilters) {
    data.value.savedSearches.unshift({
      id: crypto.randomUUID(),
      userId,
      label,
      scope,
      filters: cloneValue(filters),
      createdAt: now(),
    })
  }

  function sendConnectRequest(fromUserId: string, toUserId: string, note: string) {
    data.value.connectRequests.unshift({
      id: crypto.randomUUID(),
      fromUserId,
      toUserId,
      note,
      status: "pending",
      createdAt: now(),
      respondedAt: null,
    })
  }

  function respondToConnectRequest(requestId: string, status: ConnectRequestStatus) {
    const request = data.value.connectRequests.find(item => item.id === requestId)
    if (!request)
      return null

    request.status = status
    request.respondedAt = now()

    if (status !== "accepted")
      return null

    const conversationId = crypto.randomUUID()
    data.value.conversations.unshift({
      id: conversationId,
      participantIds: [request.fromUserId, request.toUserId],
      lastMessageAt: now(),
      unreadCountByUser: {
        [request.fromUserId]: 0,
        [request.toUserId]: 0,
      },
      typingByUserIds: [],
    })
    data.value.matches.unshift({
      id: crypto.randomUUID(),
      participantIds: [request.fromUserId, request.toUserId],
      source: "connect_request",
      conversationId,
      createdAt: now(),
    })
    data.value.messages.push({
      id: crypto.randomUUID(),
      conversationId,
      senderUserId: null,
      type: "system",
      body: "Connection accepted. Messaging is now unlocked.",
      attachments: [],
      createdAt: now(),
    })

    return conversationId
  }

  function sendMessage(conversationId: string, senderUserId: string | null, body: string, attachments: MessageAttachment[] = [], type: "user" | "system" = "user") {
    const conversation = data.value.conversations.find(item => item.id === conversationId)
    if (!conversation)
      return

    data.value.messages.push({
      id: crypto.randomUUID(),
      conversationId,
      senderUserId,
      type,
      body,
      attachments,
      createdAt: now(),
    })

    conversation.lastMessageAt = now()
    conversation.participantIds.forEach((participantId) => {
      if (participantId !== senderUserId)
        conversation.unreadCountByUser[participantId] = (conversation.unreadCountByUser[participantId] || 0) + 1
    })
  }

  function markConversationRead(conversationId: string, userId: string) {
    const conversation = data.value.conversations.find(item => item.id === conversationId)
    if (!conversation)
      return

    conversation.unreadCountByUser[userId] = 0
  }

  function setTyping(conversationId: string, userId: string, isTyping: boolean) {
    const conversation = data.value.conversations.find(item => item.id === conversationId)
    if (!conversation)
      return

    const current = new Set(conversation.typingByUserIds)
    if (isTyping)
      current.add(userId)
    else
      current.delete(userId)

    conversation.typingByUserIds = Array.from(current)
  }

  function createProposal(
    creatorUserId: string,
    recipientUserId: string,
    conversationId: string,
    opportunityId: string | null,
    title: string,
    payload: {
      roleTitle: string
      responsibilities: string[]
      weeklyTimeCommitment: number
      startDate: string
      cashCompensation: string
      equity: string
      vestingSchedule: string
      cliff: string
      decisionRights: string
      ipAssignmentRequired: boolean
      confidentiality: string
      exitTerms: string
      notes: string
    },
  ) {
    const proposalId = crypto.randomUUID()
    const versionId = crypto.randomUUID()

    data.value.proposals.unshift({
      id: proposalId,
      conversationId,
      opportunityId,
      createdByUserId: creatorUserId,
      recipientUserId,
      title,
      currentVersionId: versionId,
      status: "sent",
      createdAt: now(),
      updatedAt: now(),
    })

    data.value.proposalVersions.unshift({
      id: versionId,
      proposalId,
      versionNumber: 1,
      createdByUserId: creatorUserId,
      createdAt: now(),
      summary: `${payload.roleTitle} proposal sent`,
      ...payload,
    })

    sendMessage(conversationId, null, "A collaboration proposal was sent.", [], "system")
    createNotification(recipientUserId, "proposal", "New proposal received", title, `/app/proposals/${proposalId}`)
    return proposalId
  }

  function updateProposalStatus(proposalId: string, status: ProposalStatus, actorUserId: string) {
    const proposal = getProposalById(data.value, proposalId)
    if (!proposal)
      return

    proposal.status = status
    proposal.updatedAt = now()
    sendMessage(proposal.conversationId, null, `Proposal status changed to ${status.replaceAll("_", " ")}.`, [], "system")

    const counterpartyId = proposal.createdByUserId === actorUserId ? proposal.recipientUserId : proposal.createdByUserId
    createNotification(
      counterpartyId,
      "proposal",
      "Proposal updated",
      `${proposal.title} is now ${status.replaceAll("_", " ")}.`,
      `/app/proposals/${proposalId}`,
    )
  }

  function createProposalCounterVersion(
    proposalId: string,
    createdByUserId: string,
    payload: {
      roleTitle: string
      responsibilities: string[]
      weeklyTimeCommitment: number
      startDate: string
      cashCompensation: string
      equity: string
      vestingSchedule: string
      cliff: string
      decisionRights: string
      ipAssignmentRequired: boolean
      confidentiality: string
      exitTerms: string
      notes: string
    },
  ) {
    const proposal = getProposalById(data.value, proposalId)
    const currentVersion = proposal && getCurrentProposalVersion(data.value, proposal)
    if (!proposal || !currentVersion)
      return

    const versionId = crypto.randomUUID()

    data.value.proposalVersions.unshift({
      id: versionId,
      proposalId,
      versionNumber: currentVersion.versionNumber + 1,
      createdByUserId,
      createdAt: now(),
      summary: `${payload.roleTitle} counter version`,
      ...payload,
    })

    proposal.currentVersionId = versionId
    proposal.status = "countered"
    proposal.updatedAt = now()
    sendMessage(proposal.conversationId, null, `Proposal updated to version ${currentVersion.versionNumber + 1}.`, [], "system")
  }

  function addProposalComment(proposalId: string, proposalVersionId: string, authorUserId: string, section: string, body: string) {
    data.value.proposalComments.unshift({
      id: crypto.randomUUID(),
      proposalId,
      proposalVersionId,
      authorUserId,
      section,
      body,
      createdAt: now(),
    })
  }

  function createContractFromProposal(proposalId: string) {
    const proposal = getProposalById(data.value, proposalId)
    if (!proposal)
      return null

    const existingContract = data.value.contracts.find(contract => contract.proposalId === proposalId)
    if (existingContract)
      return existingContract.id

    const version = getCurrentProposalVersion(data.value, proposal)
    const participants = [proposal.createdByUserId, proposal.recipientUserId]
      .map(userId => getProfileByUserId(data.value, userId))
      .filter((participant): participant is NonNullable<typeof participant> => Boolean(participant))

    if (!version || participants.length !== 2)
      return null

    const contractId = crypto.randomUUID()
    const contractVersion = buildContractVersionFromProposal(version, participants, contractId, 1)

    data.value.contracts.unshift({
      id: contractId,
      proposalId,
      title: `${proposal.title.replace("Proposal", "Agreement")}`,
      status: "pending_signature",
      currentVersionId: contractVersion.id,
      disclaimerAcknowledged: true,
      createdAt: now(),
      updatedAt: now(),
    })

    data.value.contractVersions.unshift(contractVersion)
    createNotification(proposal.recipientUserId, "contract", "Contract draft ready", "A contract draft was generated from your proposal.", `/app/contracts/${contractId}`)
    return contractId
  }

  function updateContractVersion(contractId: string, partial: Partial<ContractVersion>) {
    const contract = getContractById(data.value, contractId)
    const currentVersion = contract && getCurrentContractVersion(data.value, contract)
    if (!contract || !currentVersion)
      return

    const nextVersion: ContractVersion = {
      ...currentVersion,
      ...partial,
      id: crypto.randomUUID(),
      versionNumber: currentVersion.versionNumber + 1,
      createdAt: now(),
    }

    data.value.contractVersions.unshift(nextVersion)
    contract.currentVersionId = nextVersion.id
    contract.updatedAt = now()
  }

  function signContract(contractId: string, userId: string, typedName: string) {
    const contract = getContractById(data.value, contractId)
    const currentVersion = contract && getCurrentContractVersion(data.value, contract)
    if (!contract || !currentVersion)
      return

    const existingSignature = data.value.signatures.find(signature => signature.contractId === contractId && signature.userId === userId && signature.contractVersionId === currentVersion.id)
    if (existingSignature)
      return

    data.value.signatures.push({
      id: crypto.randomUUID(),
      contractId,
      contractVersionId: currentVersion.id,
      userId,
      typedName,
      signedAt: now(),
    })

    const proposal = data.value.proposals.find(item => item.id === contract.proposalId)
    if (!proposal)
      return

    const participantIds = [proposal.createdByUserId, proposal.recipientUserId]
    const signatures = data.value.signatures.filter(signature => signature.contractId === contractId && signature.contractVersionId === currentVersion.id)

    if (participantIds.every(participantId => signatures.some(signature => signature.userId === participantId)))
      contract.status = "signed"
  }

  function createNotification(userId: string, type: NotificationType, title: string, body: string, href: string) {
    data.value.notifications.unshift({
      id: crypto.randomUUID(),
      userId,
      type,
      title,
      body,
      href,
      readAt: null,
      createdAt: now(),
    })
  }

  function markNotificationRead(notificationId: string) {
    const notification = data.value.notifications.find(item => item.id === notificationId)
    if (notification)
      notification.readAt = now()
  }

  function updateSubscriptionPlan(userId: string, plan: "free" | "pro" | "team") {
    const subscription = getSubscriptionByUserId(data.value, userId)
    if (!subscription)
      return

    subscription.plan = plan
    subscription.status = "active"
    subscription.renewsAt = plan === "free" ? null : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    subscription.visibilityBoost = plan !== "free"
    subscription.unlimitedMessaging = plan !== "free"
    subscription.proposalWorkflow = plan !== "free"
    subscription.contractBuilder = plan !== "free"
  }

  function suspendUser(targetUserId: string, adminUserId: string, notes: string) {
    const user = data.value.users.find(item => item.id === targetUserId)
    if (!user)
      return

    user.suspendedAt = now()
    data.value.adminActions.unshift({
      id: crypto.randomUUID(),
      adminUserId,
      type: "suspend_user",
      targetId: targetUserId,
      notes,
      createdAt: now(),
    })
  }

  function reinstateUser(targetUserId: string, adminUserId: string, notes: string) {
    const user = data.value.users.find(item => item.id === targetUserId)
    if (!user)
      return

    user.suspendedAt = null
    data.value.adminActions.unshift({
      id: crypto.randomUUID(),
      adminUserId,
      type: "reinstate_user",
      targetId: targetUserId,
      notes,
      createdAt: now(),
    })
  }

  function resolveReport(reportId: string, adminUserId: string, notes: string) {
    const report = data.value.reports.find(item => item.id === reportId)
    if (!report)
      return

    report.status = "resolved"
    data.value.adminActions.unshift({
      id: crypto.randomUUID(),
      adminUserId,
      type: "resolve_report",
      targetId: reportId,
      notes,
      createdAt: now(),
    })
  }

  function createInvestmentApplication(userId: string, opportunityId: string, payload: {
    raiseAmount: string
    traction: string
    deckLink: string
    teamSummary: string
    reason: string
  }) {
    data.value.investmentApplications.unshift({
      id: crypto.randomUUID(),
      opportunityId,
      applicantUserId: userId,
      status: "submitted",
      createdAt: now(),
      ...payload,
    })
  }

  function getConversationPreview(conversationId: string) {
    return getMessagesForConversation(data.value, conversationId).at(-1)
  }

  return {
    data,
    ready,
    createContractFromProposal,
    createDraftUserFromSignUp,
    createInvestmentApplication,
    createOpportunity,
    createProposal,
    createProposalCounterVersion,
    addProposalComment,
    ensureReady,
    ensureSessionUser,
    getConversationPreview,
    markConversationRead,
    markNotificationRead,
    reinstateUser,
    resetToSeed,
    resolveReport,
    respondToConnectRequest,
    saveSearch,
    sendConnectRequest,
    sendMessage,
    setTyping,
    signContract,
    suspendUser,
    toggleBookmark,
    updateContractVersion,
    updateCurrentProfile,
    updateProposalStatus,
    updateSubscriptionPlan,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useWorkspaceStore, import.meta.hot))
