import type {
  AdminAction,
  AppRole,
  BookmarkTargetType,
  ConnectDeclineReason,
  ConnectRequestPayload,
  ConnectRequestStatus,
  ContactRevealStage,
  ContractVersion,
  MessageAttachment,
  NotificationPreferences,
  NotificationType,
  ProposalPayload,
  ProposalSectionKey,
  ProposalStatus,
  ReportReason,
  SearchFilters,
  SessionUser,
  WorkspaceSeed,
} from "~/shared/types/domain"
import { useStorage, watchDebounced } from "@vueuse/core"
import { acceptHMRUpdate, defineStore } from "pinia"
import { workspaceSeed } from "~/shared/data/seed"
import { buildSubscriptionUsage } from "~/shared/utils/billing"
import { cloneValue } from "~/shared/utils/clone"
import {
  acknowledgeTrialCollaborationTransition,
  addProposalCommentTransition,
  createConnectRequestTransition,
  createContractFromProposalTransition,
  createProposalCounterVersionTransition,
  createProposalTransition,
  markConversationReadTransition,
  markNotificationReadTransition,
  respondToConnectRequestTransition,
  sendMessageTransition,
  signContractTransition,
  startTrialCollaborationTransition,
  updateProposalStatusTransition,
} from "~/shared/utils/collaboration"
import { buildOpportunityRiskFlags, buildProfileReadiness, getReportPriority } from "~/shared/utils/formation"
import {
  getContractById,
  getCurrentContractVersion,
  getCurrentProposalVersion,
  getMessagesForConversation,
  getProfileByUserId,
  getProposalById,
  getSubscriptionByUserId,
} from "~/shared/utils/workspace"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceWritePayload } from "~/shared/utils/workspace-persistence"

function now() {
  return new Date().toISOString()
}

const opportunitySlugPattern = /[^a-z0-9]+/g
const opportunitySlugTrimPattern = /^-|-$/g

interface MinimumOnboardingPayload {
  intentMode: "start" | "join" | "explore"
  displayName: string
  photoUrl: string
  headline: string
  bio: string
  location: string
  remotePreference: "remote" | "hybrid" | "in_person"
  primaryRole: string
  roles: string[]
  industries: string[]
  timeCommitment: "nights_weekends" | "part_time" | "full_time"
  weeklyAvailabilityHours: number
  startTimeline: "immediately" | "30_days" | "90_days" | "exploring"
  fullTimeBy: string
  runwayBucket: "under_3_months" | "3_to_6_months" | "6_to_12_months" | "12_plus_months" | "undisclosed"
  equityPhilosophy: "equal_unless_strong_reason" | "contribution_weighted" | "dynamic_over_time"
  companyPreferences: string[]
  profileVisibility: "public" | "members" | "private"
}

interface FullProfilePayload {
  displayName: string
  photoUrl: string
  headline: string
  bio: string
  location: string
  remotePreference: "remote" | "hybrid" | "in_person"
  primaryRole: string
  roles: string[]
  yearsExperience: number
  industries: string[]
  startupStagePreferences: ("idea" | "prototype" | "mvp" | "revenue" | "growth")[]
  compensationPreferences: ("equity_only" | "cash_and_equity" | "cash_only" | "advisory")[]
  equityExpectationRange: string
  timeCommitment: "nights_weekends" | "part_time" | "full_time"
  weeklyAvailabilityHours: number
  startTimeline: "immediately" | "30_days" | "90_days" | "exploring"
  fullTimeBy: string
  runwayBucket: "under_3_months" | "3_to_6_months" | "6_to_12_months" | "12_plus_months" | "undisclosed"
  currentStatus: "full_time_employed" | "consulting_part_time" | "between_roles" | "full_time_on_startup" | "exploring"
  equityPhilosophy: "equal_unless_strong_reason" | "contribution_weighted" | "dynamic_over_time"
  leadershipPreference: "wants_ceo_role" | "open_to_ceo_role" | "prefers_non_ceo_role"
  decisionModelPreference: "ceo_decides_with_input" | "area_owner_decides" | "consensus_for_big_bets"
  deadlockPreference: "advisor_tiebreaker" | "rotating_decider" | "board_mediator" | "neutral_operator"
  companyPreferences: string[]
  nonNegotiables: string[]
  introCapacity: string
  nonResponsibilities: string[]
  accountabilityMilestones: string[]
  existingAssets: string[]
  existingAssetsNotes: string
  priorObligations: "none_known" | "possible_constraints" | "confirmed_constraints"
  readyToAssignIp: boolean
  linkedin: string
  github: string
  portfolio: string
  website: string
  hasIdea: boolean
  wantsToJoinIdea: boolean
  values: string[]
  workStylePreferences: string[]
  profileVisibility: "public" | "members" | "private"
}

function createOpportunitySlug(input: string) {
  return input.toLowerCase().replaceAll(opportunitySlugPattern, "-").replaceAll(opportunitySlugTrimPattern, "")
}

function canSendOutreachFromProfile(profile?: ReturnType<typeof getProfileByUserId>) {
  return Boolean(profile && buildProfileReadiness(profile).readyForOutreach)
}

function deriveUserRole(hasIdea: boolean, wantsToJoinIdea: boolean) {
  return !hasIdea && wantsToJoinIdea ? "collaborator" : "founder"
}

export const useWorkspaceStore = defineStore("workspace", () => {
  const { session } = useSessionState()
  const data = useStorage<WorkspaceSeed>("cofoundry-workspace", cloneValue(workspaceSeed), undefined, {
    mergeDefaults: true,
  })

  const ready = ref(false)
  const hydrating = ref(false)
  const syncing = ref(false)
  const persistError = ref("")
  const lastSyncedAt = ref<string | null>(null)
  const loadedUserId = ref("")
  const serverBackedWorkspace = computed(() => Boolean(session.value))

  function normalizeLegacyConnectRequests() {
    data.value.connectRequests = data.value.connectRequests.map((request) => {
      if (request.structuredIntro)
        return request

      return {
        ...request,
        structuredIntro: {
          context: "profile",
          roleContext: "Structured intro",
          whyFit: request.note,
          whyNow: "Interested in comparing fit and next steps now.",
          proposedNextStep: "intro_call",
        },
      }
    })
  }

  function normalizeLegacyUsers() {
    data.value.users = data.value.users.map(user => ({
      ...user,
      notificationPreferences: user.notificationPreferences || {
        unreadDigestEmail: false,
      },
    }))
  }

  function ensureReady() {
    normalizeLegacyUsers()
    normalizeLegacyConnectRequests()

    if (!ready.value)
      ready.value = true
  }

  normalizeLegacyUsers()
  normalizeLegacyConnectRequests()

  function resetToSeed() {
    data.value = cloneValue(workspaceSeed)
    loadedUserId.value = ""
    lastSyncedAt.value = null
    persistError.value = ""
  }

  function resetSessionState() {
    resetToSeed()
    hydrating.value = false
    syncing.value = false
    ready.value = false
  }

  function touchProfileActivity(userId: string) {
    const profile = getProfileByUserId(data.value, userId)
    if (profile)
      profile.trustSignals.lastActiveAt = now()
  }

  function syncProfileDerivedState(userId: string) {
    const profile = getProfileByUserId(data.value, userId)
    const user = data.value.users.find(item => item.id === userId)
    if (!profile || !user)
      return

    profile.verificationBadges.profileComplete = buildProfileReadiness(profile).profileComplete
    profile.verificationBadges.linkedAccounts = Boolean(
      profile.links.linkedin
      || profile.links.github
      || profile.links.portfolio
      || profile.links.website,
    )
    profile.trustSignals.workHistoryVerified = profile.trustSignals.workHistoryVerified || Boolean(profile.links.linkedin || profile.links.website)
    profile.trustSignals.identityVerified = profile.trustSignals.governmentIdVerified || Boolean(
      profile.verificationBadges.emailVerified
      && (profile.trustSignals.linkedInVerified || profile.trustSignals.githubVerified || profile.trustSignals.workDomainVerified || profile.trustSignals.websiteVerified),
    )
    profile.availability = profile.intent.introCapacity || `${profile.timeCommitment.replaceAll("_", " ")} availability`
    profile.summaryHighlights = [
      profile.hasIdea && !profile.wantsToJoinIdea
        ? "Actively building and screening for a founding partner"
        : !profile.hasIdea && profile.wantsToJoinIdea
            ? "Actively looking to join a founding team"
            : "Exploring both founder and collaborator paths",
      `${profile.roleScope.primaryRole || profile.roles[0] || "Generalist"} · ${profile.commitmentProfile.weeklyAvailabilityHours}h/week · ${profile.intent.startTimeline.replaceAll("_", " ")}`,
      profile.trustSignals.builderProofs.length
        ? `${profile.trustSignals.builderProofs.length} evidence card${profile.trustSignals.builderProofs.length === 1 ? "" : "s"} · ${profile.trustSignals.replyRatePercent}% replies`
        : profile.intent.companyPreferences.slice(0, 2).join(" · ") || "Refine company fit preferences",
    ]
    user.role = deriveUserRole(profile.hasIdea, profile.wantsToJoinIdea)
  }

  function ensureSessionUser(session: SessionUser) {
    ensureReady()
    const draftState = buildDraftMemberWorkspaceState(session)

    const existingUser = data.value.users.find(user => user.id === session.id)
    const existingProfile = data.value.profiles.find(profile => profile.userId === session.id)
    const existingSubscription = getSubscriptionByUserId(data.value, session.id)

    if (!existingUser) {
      data.value.users.push(draftState.user)
    }

    if (!existingProfile) {
      data.value.profiles.push(draftState.profile)
    }

    if (!existingSubscription) {
      data.value.subscriptions.push(draftState.subscription)
    }

    syncProfileDerivedState(session.id)
  }

  async function loadWorkspace(force = false) {
    ensureReady()

    if (!session.value) {
      resetSessionState()
      return data.value
    }

    if (!serverBackedWorkspace.value) {
      ensureSessionUser(session.value)
      loadedUserId.value = session.value.id
      ready.value = true
      return data.value
    }

    if (!force && ready.value && loadedUserId.value === session.value.id)
      return data.value

    hydrating.value = true
    persistError.value = ""

    try {
      const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
      const response = await $fetch<{ data: WorkspaceSeed, session: SessionUser }>("/api/workspace", { headers })
      data.value = cloneValue(response.data)
      loadedUserId.value = response.session.id
      lastSyncedAt.value = now()
      ensureReady()
      ready.value = true
      return data.value
    }
    catch (caughtError) {
      persistError.value = caughtError instanceof Error ? caughtError.message : "Unable to load the workspace."
      throw caughtError
    }
    finally {
      hydrating.value = false
    }
  }

  async function persistWorkspace(force = false) {
    if (!serverBackedWorkspace.value || !session.value || hydrating.value)
      return data.value

    const payload = buildMemberWorkspaceWritePayload(data.value, session.value.id)
    if (!payload)
      return data.value

    if (syncing.value && !force)
      return data.value

    syncing.value = true

    try {
      const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
      const response = await $fetch<{ data: WorkspaceSeed, session: SessionUser }>("/api/workspace/member", {
        method: "POST",
        body: { state: payload },
        headers,
      })
      data.value = cloneValue(response.data)
      loadedUserId.value = response.session.id
      lastSyncedAt.value = now()
      persistError.value = ""
      ensureReady()
      return data.value
    }
    catch (caughtError) {
      persistError.value = caughtError instanceof Error ? caughtError.message : "Unable to save your workspace changes."
      if (force)
        throw caughtError
      return data.value
    }
    finally {
      syncing.value = false
    }
  }

  function applyAuthoritativeWorkspace(payload: { data: WorkspaceSeed, session: SessionUser }) {
    data.value = cloneValue(payload.data)
    loadedUserId.value = payload.session.id
    lastSyncedAt.value = now()
    persistError.value = ""
    ensureReady()
    ready.value = true
    return data.value
  }

  async function runCollaborationMutation<Result extends Record<string, string | null> | undefined>(
    payload: Record<string, unknown>,
  ) {
    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
    const response = await $fetch<{ data: WorkspaceSeed, result: Result, session: SessionUser }>("/api/workspace/collaboration", {
      method: "POST",
      body: payload,
      headers,
    })

    applyAuthoritativeWorkspace(response)
    return response.result
  }

  async function syncNotificationRead(notificationId: string) {
    const headers = import.meta.server ? useRequestHeaders(["cookie"]) : undefined
    const response = await $fetch<{ data: WorkspaceSeed, session: SessionUser }>(`/api/inbox/notifications/${notificationId}/read`, {
      method: "POST",
      headers,
    })

    applyAuthoritativeWorkspace(response)
  }

  function createDraftUserFromSignUp(session: SessionUser, displayName: string) {
    ensureSessionUser({
      ...session,
      name: displayName,
    })
  }

  function completeMinimumOnboarding(userId: string, payload: MinimumOnboardingPayload) {
    ensureReady()

    const profile = getProfileByUserId(data.value, userId)
    const user = data.value.users.find(item => item.id === userId)
    if (!profile || !user)
      return

    profile.displayName = payload.displayName
    profile.photoUrl = payload.photoUrl
    profile.headline = payload.headline
    profile.bio = payload.bio
    profile.location = payload.location
    profile.remotePreference = payload.remotePreference
    profile.roleScope.primaryRole = payload.primaryRole
    profile.roles = Array.from(new Set([payload.primaryRole, ...payload.roles]))
    profile.industries = payload.industries
    profile.timeCommitment = payload.timeCommitment
    profile.commitmentProfile.weeklyAvailabilityHours = payload.weeklyAvailabilityHours
    profile.commitmentProfile.fullTimeBy = payload.fullTimeBy
    profile.commitmentProfile.runwayBucket = payload.runwayBucket
    profile.intent = {
      startTimeline: payload.startTimeline,
      companyPreferences: payload.companyPreferences,
      nonNegotiables: profile.intent.nonNegotiables,
      introCapacity: profile.intent.introCapacity,
    }
    profile.governancePreferences.equityPhilosophy = payload.equityPhilosophy
    profile.hasIdea = payload.intentMode !== "join"
    profile.wantsToJoinIdea = payload.intentMode !== "start"
    profile.privacy.profileVisibility = payload.profileVisibility
    profile.trustSignals.lastActiveAt = now()
    user.onboardingCompleted = true
    syncProfileDerivedState(userId)
  }

  function updateCurrentProfile(
    userId: string,
    payload: FullProfilePayload,
  ) {
    ensureReady()

    const profile = getProfileByUserId(data.value, userId)
    const user = data.value.users.find(item => item.id === userId)
    if (!profile || !user)
      return

    profile.displayName = payload.displayName
    profile.photoUrl = payload.photoUrl
    profile.headline = payload.headline
    profile.bio = payload.bio
    profile.location = payload.location
    profile.remotePreference = payload.remotePreference
    profile.roleScope.primaryRole = payload.primaryRole
    profile.roles = Array.from(new Set([payload.primaryRole, ...payload.roles]))
    profile.yearsExperience = payload.yearsExperience
    profile.industries = payload.industries
    profile.startupStagePreferences = payload.startupStagePreferences
    profile.compensationPreferences = payload.compensationPreferences
    profile.equityExpectationRange = payload.equityExpectationRange
    profile.timeCommitment = payload.timeCommitment
    profile.commitmentProfile = {
      weeklyAvailabilityHours: payload.weeklyAvailabilityHours,
      fullTimeBy: payload.fullTimeBy,
      runwayBucket: payload.runwayBucket,
      currentStatus: payload.currentStatus,
    }
    profile.governancePreferences = {
      equityPhilosophy: payload.equityPhilosophy,
      leadershipPreference: payload.leadershipPreference,
      decisionModelPreference: payload.decisionModelPreference,
      deadlockPreference: payload.deadlockPreference,
    }
    profile.roleScope = {
      primaryRole: payload.primaryRole,
      nonResponsibilities: payload.nonResponsibilities,
      accountabilityMilestones: payload.accountabilityMilestones,
    }
    profile.ipReadiness = {
      existingAssets: payload.existingAssets,
      existingAssetsNotes: payload.existingAssetsNotes,
      priorObligations: payload.priorObligations,
      readyToAssignIp: payload.readyToAssignIp,
    }
    profile.intent = {
      startTimeline: payload.startTimeline,
      companyPreferences: payload.companyPreferences,
      nonNegotiables: payload.nonNegotiables,
      introCapacity: payload.introCapacity,
    }
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
    profile.trustSignals.lastActiveAt = now()
    user.onboardingCompleted = true
    syncProfileDerivedState(userId)
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
    officialWebsite: string
    verificationMethod: "none" | "work_email" | "domain" | "github_org"
    industries: string[]
  }) {
    const opportunityId = crypto.randomUUID()
    const riskFlags = buildOpportunityRiskFlags(payload)
    const verificationStatus = riskFlags.length
      ? "manual_review"
      : payload.verificationMethod === "domain"
        ? "domain_verified"
        : payload.verificationMethod === "work_email" || payload.verificationMethod === "github_org"
          ? "owner_verified"
          : "unverified"

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
      officialWebsite: payload.officialWebsite,
      verificationMethod: payload.verificationMethod,
      verificationStatus,
      riskFlags,
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
    const subscription = getSubscriptionByUserId(data.value, userId)
    const usage = buildSubscriptionUsage(data.value, userId, subscription || undefined)
    if (usage.savedSearches.exhausted)
      return false

    data.value.savedSearches.unshift({
      id: crypto.randomUUID(),
      userId,
      label,
      scope,
      filters: cloneValue(filters),
      createdAt: now(),
    })
    touchProfileActivity(userId)
    return true
  }

  async function sendConnectRequest(fromUserId: string, toUserId: string, payload: ConnectRequestPayload) {
    const profile = getProfileByUserId(data.value, fromUserId)
    if (!canSendOutreachFromProfile(profile))
      return false

    const subscription = getSubscriptionByUserId(data.value, fromUserId)
    const usage = buildSubscriptionUsage(data.value, fromUserId, subscription || undefined)
    if (usage.intros.exhausted)
      return false

    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "send_connect_request",
        payload,
        toUserId,
      })
      return true
    }

    data.value = createConnectRequestTransition(data.value, fromUserId, toUserId, payload, now()).seed
    return true
  }

  async function respondToConnectRequest(requestId: string, status: ConnectRequestStatus, declineReason: ConnectDeclineReason | null = null) {
    const request = data.value.connectRequests.find(item => item.id === requestId)
    if (!request)
      return null

    if (serverBackedWorkspace.value) {
      const result = await runCollaborationMutation<{ conversationId: string | null }>({
        action: "respond_connect_request",
        declineReason,
        requestId,
        status,
      })
      return result?.conversationId || null
    }

    const transition = respondToConnectRequestTransition(data.value, requestId, status, now(), declineReason)
    data.value = transition.seed
    return transition.conversationId
  }

  async function sendMessage(conversationId: string, senderUserId: string | null, body: string, attachments: MessageAttachment[] = [], type: "user" | "system" = "user") {
    const conversation = data.value.conversations.find(item => item.id === conversationId)
    if (!conversation)
      return

    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "send_message",
        attachments,
        body,
        conversationId,
        type,
      })
      return
    }

    data.value = sendMessageTransition(data.value, conversationId, senderUserId, body, attachments, now(), type).seed
  }

  async function markConversationRead(conversationId: string, userId: string) {
    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "mark_conversation_read",
        conversationId,
      })
      return
    }

    data.value = markConversationReadTransition(data.value, conversationId, userId)
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

  async function createProposal(
    creatorUserId: string,
    recipientUserId: string,
    conversationId: string,
    opportunityId: string | null,
    title: string,
    payload: ProposalPayload,
  ) {
    const subscription = getSubscriptionByUserId(data.value, creatorUserId)
    const usage = buildSubscriptionUsage(data.value, creatorUserId, subscription || undefined)
    if (usage.proposals.exhausted)
      return null

    if (serverBackedWorkspace.value) {
      const result = await runCollaborationMutation<{ proposalId: string | null }>({
        action: "create_proposal",
        conversationId,
        opportunityId,
        payload,
        recipientUserId,
        title,
      })
      return result?.proposalId || null
    }

    const transition = createProposalTransition(data.value, creatorUserId, recipientUserId, conversationId, opportunityId, title, payload, now())
    data.value = transition.seed
    return transition.proposalId
  }

  async function updateProposalStatus(proposalId: string, status: ProposalStatus, actorUserId: string) {
    const proposal = getProposalById(data.value, proposalId)
    if (!proposal)
      return

    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "update_proposal_status",
        proposalId,
        status,
      })
      return
    }

    data.value = updateProposalStatusTransition(data.value, proposalId, status, actorUserId, now())
  }

  async function createProposalCounterVersion(
    proposalId: string,
    createdByUserId: string,
    payload: ProposalPayload,
  ) {
    const proposal = getProposalById(data.value, proposalId)
    const currentVersion = proposal && getCurrentProposalVersion(data.value, proposal)
    if (!proposal || !currentVersion)
      return

    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "create_proposal_counter_version",
        payload,
        proposalId,
      })
      return
    }

    data.value = createProposalCounterVersionTransition(data.value, proposalId, createdByUserId, payload, now()).seed
  }

  async function addProposalComment(proposalId: string, proposalVersionId: string, authorUserId: string, section: ProposalSectionKey, body: string) {
    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "add_proposal_comment",
        body,
        proposalId,
        proposalVersionId,
        section,
      })
      return
    }

    data.value = addProposalCommentTransition(data.value, proposalId, proposalVersionId, authorUserId, section, body, now()).seed
  }

  async function createContractFromProposal(proposalId: string, actorUserId?: string) {
    const proposal = getProposalById(data.value, proposalId)
    if (!proposal)
      return null

    const existingContract = data.value.contracts.find(contract => contract.proposalId === proposalId)
    if (existingContract)
      return existingContract.id

    if (actorUserId) {
      const subscription = getSubscriptionByUserId(data.value, actorUserId)
      const usage = buildSubscriptionUsage(data.value, actorUserId, subscription || undefined)
      if (usage.contractDrafts.exhausted)
        return null
    }

    if (serverBackedWorkspace.value) {
      const result = await runCollaborationMutation<{ contractId: string | null }>({
        action: "create_contract_from_proposal",
        proposalId,
      })
      return result?.contractId || null
    }

    const transition = createContractFromProposalTransition(data.value, proposalId, now())
    data.value = transition.seed
    return transition.contractId
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

  async function signContract(contractId: string, userId: string, typedName: string) {
    const contract = getContractById(data.value, contractId)
    const currentVersion = contract && getCurrentContractVersion(data.value, contract)
    if (!contract || !currentVersion)
      return

    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "sign_contract",
        contractId,
        typedName,
      })
      return
    }

    data.value = signContractTransition(data.value, contractId, userId, typedName, now())
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

  function completeTrustVerification(userId: string, verificationType: "phone" | "linkedin" | "github" | "website" | "work_domain" | "government_id") {
    const profile = getProfileByUserId(data.value, userId)
    if (!profile)
      return

    if (verificationType === "phone")
      profile.trustSignals.phoneVerified = true

    if (verificationType === "linkedin") {
      if (!profile.links.linkedin)
        return

      profile.trustSignals.linkedInVerified = true
      profile.verificationBadges.linkedAccounts = true
      profile.trustSignals.workHistoryVerified = true
    }

    if (verificationType === "github") {
      if (!profile.links.github)
        return

      profile.trustSignals.githubVerified = true
      profile.verificationBadges.linkedAccounts = true
      profile.trustSignals.workHistoryVerified = true
    }

    if (verificationType === "website") {
      if (!profile.links.website)
        return

      profile.trustSignals.websiteVerified = true
      profile.verificationBadges.linkedAccounts = true
      profile.trustSignals.workHistoryVerified = true
    }

    if (verificationType === "work_domain") {
      if (!profile.links.website)
        return

      profile.trustSignals.workDomainVerified = true
      profile.trustSignals.workHistoryVerified = true
    }

    if (verificationType === "government_id") {
      profile.trustSignals.governmentIdVerified = true
      profile.trustSignals.identityVerified = true
    }

    touchProfileActivity(userId)
    syncProfileDerivedState(userId)
  }

  function updateContactRevealStage(userId: string, stage: ContactRevealStage) {
    const profile = getProfileByUserId(data.value, userId)
    if (!profile)
      return

    profile.privacy.contactRevealStage = stage
  }

  async function updateNotificationPreferences(userId: string, preferences: NotificationPreferences) {
    const user = data.value.users.find(item => item.id === userId)
    if (!user)
      return

    user.notificationPreferences = {
      unreadDigestEmail: preferences.unreadDigestEmail,
    }

    await persistWorkspace(true)
  }

  function createReport(
    reporterUserId: string,
    targetType: "profile" | "message" | "opportunity",
    targetId: string,
    reason: ReportReason,
    details: string,
  ) {
    const priority = getReportPriority(reason)
    data.value.reports.unshift({
      id: crypto.randomUUID(),
      reporterUserId,
      targetType,
      targetId,
      reason,
      priority,
      details,
      status: "open",
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
      resolutionNotes: null,
      resolvedAt: null,
      resolvedByUserId: null,
      createdAt: now(),
    })

    data.value.users
      .filter(user => user.role === "admin")
      .forEach((user) => {
        createNotification(
          user.id,
          "admin",
          priority === "high" ? "High-priority safety report" : "New moderation report",
          details,
          "/admin/reports",
        )
      })
  }

  async function startTrialCollaboration(matchId: string, createdByUserId: string) {
    const existingTrial = data.value.trialCollaborations.find(trial => trial.matchId === matchId)
    if (existingTrial)
      return existingTrial.id

    const match = data.value.matches.find(item => item.id === matchId)
    if (!match)
      return null

    if (serverBackedWorkspace.value) {
      const result = await runCollaborationMutation<{ trialId: string | null }>({
        action: "start_trial",
        matchId,
      })
      return result?.trialId || null
    }

    const transition = startTrialCollaborationTransition(data.value, matchId, createdByUserId, now())
    data.value = transition.seed
    return transition.trialId
  }

  async function acknowledgeTrialCollaboration(trialId: string, userId: string) {
    const trial = data.value.trialCollaborations.find(item => item.id === trialId)
    if (!trial)
      return

    if (serverBackedWorkspace.value) {
      await runCollaborationMutation({
        action: "acknowledge_trial",
        trialId,
      })
      return
    }

    data.value = acknowledgeTrialCollaborationTransition(data.value, trialId, userId, now())
  }

  async function markNotificationRead(notificationId: string) {
    if (serverBackedWorkspace.value) {
      await syncNotificationRead(notificationId)
      return
    }

    const currentUserId = session.value?.id
    if (!currentUserId)
      return

    data.value = markNotificationReadTransition(data.value, notificationId, currentUserId, now()).seed
  }

  function updateSubscriptionPlan(userId: string, plan: "free" | "pro" | "team") {
    const subscription = getSubscriptionByUserId(data.value, userId)
    if (!subscription)
      return

    subscription.plan = plan
    subscription.status = "active"
    subscription.renewsAt = plan === "free" ? null : new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    subscription.cancelAtPeriodEnd = false
    subscription.visibilityBoost = plan !== "free"
    subscription.unlimitedMessaging = plan !== "free"
    subscription.proposalWorkflow = plan !== "free"
    subscription.contractBuilder = plan !== "free"
  }

  function cancelSubscriptionAtPeriodEnd(userId: string) {
    const subscription = getSubscriptionByUserId(data.value, userId)
    if (!subscription || subscription.plan === "free")
      return

    subscription.cancelAtPeriodEnd = true
  }

  function resumeSubscription(userId: string) {
    const subscription = getSubscriptionByUserId(data.value, userId)
    if (!subscription)
      return

    subscription.cancelAtPeriodEnd = false
  }

  function recordAdminAction(payload: {
    id?: string
    adminUserId: string
    type: AdminAction["type"]
    targetId: string
    targetType: AdminAction["targetType"]
    notes: string
    createdAt?: string
  }) {
    data.value.adminActions.unshift({
      id: payload.id || crypto.randomUUID(),
      adminUserId: payload.adminUserId,
      type: payload.type,
      targetId: payload.targetId,
      targetType: payload.targetType,
      notes: payload.notes,
      createdAt: payload.createdAt || now(),
    })
  }

  function applyUserSuspension(targetUserId: string, adminUserId: string, notes: string, suspendedAt = now(), actionId?: string) {
    const user = data.value.users.find(item => item.id === targetUserId)
    if (!user)
      return

    user.suspendedAt = suspendedAt
    recordAdminAction({
      id: actionId,
      adminUserId,
      type: "suspend_user",
      targetId: targetUserId,
      targetType: "user",
      notes,
      createdAt: suspendedAt,
    })
  }

  function applyUserReinstatement(targetUserId: string, adminUserId: string, notes: string, createdAt = now(), actionId?: string) {
    const user = data.value.users.find(item => item.id === targetUserId)
    if (!user)
      return

    user.suspendedAt = null
    recordAdminAction({
      id: actionId,
      adminUserId,
      type: "reinstate_user",
      targetId: targetUserId,
      targetType: "user",
      notes,
      createdAt,
    })
  }

  function applyUserRoleChange(targetUserId: string, adminUserId: string, role: AppRole, notes: string, createdAt = now(), actionId?: string) {
    const user = data.value.users.find(item => item.id === targetUserId)
    if (!user)
      return

    user.role = role
    recordAdminAction({
      id: actionId,
      adminUserId,
      type: "change_user_role",
      targetId: targetUserId,
      targetType: "user",
      notes,
      createdAt,
    })
  }

  function applyReportReview(reportId: string, adminUserId: string, notes: string, reviewedAt = now(), actionId?: string) {
    const report = data.value.reports.find(item => item.id === reportId)
    if (!report)
      return

    report.status = "reviewed"
    report.reviewNotes = notes
    report.reviewedAt = reviewedAt
    report.reviewedByUserId = adminUserId
    recordAdminAction({
      id: actionId,
      adminUserId,
      type: "review_report",
      targetId: reportId,
      targetType: "report",
      notes,
      createdAt: reviewedAt,
    })
  }

  function applyReportResolution(reportId: string, adminUserId: string, notes: string, resolvedAt = now(), actionId?: string) {
    const report = data.value.reports.find(item => item.id === reportId)
    if (!report)
      return

    report.status = "resolved"
    report.reviewNotes = report.reviewNotes || notes
    report.reviewedAt = report.reviewedAt || resolvedAt
    report.reviewedByUserId = report.reviewedByUserId || adminUserId
    report.resolutionNotes = notes
    report.resolvedAt = resolvedAt
    report.resolvedByUserId = adminUserId
    recordAdminAction({
      id: actionId,
      adminUserId,
      type: "resolve_report",
      targetId: reportId,
      targetType: "report",
      notes,
      createdAt: resolvedAt,
    })
  }

  async function suspendUser(targetUserId: string, adminUserId: string, notes: string) {
    const response = await $fetch<{
      action: {
        id: string
        adminUserId: string
        createdAt: string
        notes: string
        targetId: string
      }
      user: {
        id: string
        suspendedAt: string
      }
    }>(`/api/admin/users/${targetUserId}/status`, {
      method: "POST",
      body: { action: "suspend", notes },
    })

    applyUserSuspension(response.user.id, response.action.adminUserId || adminUserId, response.action.notes, response.user.suspendedAt, response.action.id)
  }

  async function reinstateUser(targetUserId: string, adminUserId: string, notes: string) {
    const response = await $fetch<{
      action: {
        id: string
        adminUserId: string
        createdAt: string
        notes: string
        targetId: string
      }
      user: {
        id: string
        suspendedAt: null
      }
    }>(`/api/admin/users/${targetUserId}/status`, {
      method: "POST",
      body: { action: "reinstate", notes },
    })

    applyUserReinstatement(response.user.id, response.action.adminUserId || adminUserId, response.action.notes, response.action.createdAt, response.action.id)
  }

  async function changeUserRole(targetUserId: string, adminUserId: string, role: AppRole, notes: string) {
    const response = await $fetch<{
      action: {
        id: string
        adminUserId: string
        createdAt: string
        notes: string
        targetId: string
      }
      user: {
        id: string
        role: AppRole
      }
    }>(`/api/admin/users/${targetUserId}/role`, {
      method: "POST",
      body: { notes, role },
    })

    applyUserRoleChange(response.user.id, response.action.adminUserId || adminUserId, response.user.role, response.action.notes, response.action.createdAt, response.action.id)
  }

  async function reviewReport(reportId: string, adminUserId: string, notes: string) {
    const response = await $fetch<{
      action: {
        id: string
        adminUserId: string
        createdAt: string
        notes: string
        targetId: string
      }
      report: {
        id: string
        reviewedAt: string
      }
    }>(`/api/admin/reports/${reportId}/status`, {
      method: "POST",
      body: { status: "reviewed", notes },
    })

    applyReportReview(response.report.id, response.action.adminUserId || adminUserId, response.action.notes, response.report.reviewedAt, response.action.id)
  }

  async function resolveReport(reportId: string, adminUserId: string, notes: string) {
    const response = await $fetch<{
      action: {
        id: string
        adminUserId: string
        createdAt: string
        notes: string
        targetId: string
      }
      report: {
        id: string
        resolvedAt: string
      }
    }>(`/api/admin/reports/${reportId}/status`, {
      method: "POST",
      body: { status: "resolved", notes },
    })

    applyReportResolution(response.report.id, response.action.adminUserId || adminUserId, response.action.notes, response.report.resolvedAt, response.action.id)
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

  if (import.meta.client) {
    watchDebounced(data, async () => {
      if (!serverBackedWorkspace.value || !session.value || hydrating.value || loadedUserId.value !== session.value.id)
        return

      await persistWorkspace()
    }, {
      debounce: 350,
      deep: true,
      maxWait: 1200,
    })
  }

  return {
    data,
    ready,
    hydrating,
    lastSyncedAt,
    loadedUserId,
    loadWorkspace,
    applyAuthoritativeWorkspace,
    persistError,
    persistWorkspace,
    resetSessionState,
    syncing,
    completeMinimumOnboarding,
    cancelSubscriptionAtPeriodEnd,
    changeUserRole,
    createContractFromProposal,
    createDraftUserFromSignUp,
    createInvestmentApplication,
    createOpportunity,
    createReport,
    createProposal,
    createProposalCounterVersion,
    addProposalComment,
    completeTrustVerification,
    ensureReady,
    ensureSessionUser,
    getConversationPreview,
    markConversationRead,
    markNotificationRead,
    reviewReport,
    reinstateUser,
    resetToSeed,
    resumeSubscription,
    resolveReport,
    acknowledgeTrialCollaboration,
    respondToConnectRequest,
    saveSearch,
    sendConnectRequest,
    sendMessage,
    setTyping,
    signContract,
    startTrialCollaboration,
    suspendUser,
    toggleBookmark,
    updateContactRevealStage,
    updateNotificationPreferences,
    updateContractVersion,
    updateCurrentProfile,
    updateProposalStatus,
    updateSubscriptionPlan,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useWorkspaceStore, import.meta.hot))
