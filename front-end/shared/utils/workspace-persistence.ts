import type {
  AppRole,
  Bookmark,
  MemberWorkspaceState,
  MemberWorkspaceWritePayload,
  Profile,
  SavedSearch,
  SessionUser,
  StartupOpportunity,
  SubscriptionPlan,
  WorkspaceSeed,
} from "../types/domain"
import { cloneValue } from "./clone"
import { normalizeNotificationPreferences } from "./notification-preferences"
import { buildSessionUser, getProfileByUserId, getSubscriptionByUserId, getUserById } from "./workspace"

export interface SessionResolutionInput {
  email: string
  id: string
  name?: string
  onboardingCompleted?: boolean
  role?: AppRole
  subscriptionPlan?: SubscriptionPlan
}

const fallbackNameSplitPattern = /[._-]+/

function now() {
  return new Date().toISOString()
}

function formatFallbackName(email: string) {
  const localPart = normalizeWorkspaceEmail(email).split("@")[0] || "member"
  return localPart
    .split(fallbackNameSplitPattern)
    .filter(Boolean)
    .map(segment => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ")
}

export function normalizeWorkspaceEmail(email: string) {
  return email.trim().toLowerCase()
}

export function findWorkspaceUserIdByEmail(seed: WorkspaceSeed, email: string) {
  const normalizedEmail = normalizeWorkspaceEmail(email)
  return seed.users.find(user => normalizeWorkspaceEmail(user.email) === normalizedEmail)?.id
    || null
}

export function resolveSessionUserFromWorkspace(seed: WorkspaceSeed, input: SessionResolutionInput): SessionUser {
  const directSession = buildSessionUser(seed, input.id)
  if (directSession)
    return directSession

  const mappedUserId = findWorkspaceUserIdByEmail(seed, input.email)
  if (mappedUserId) {
    const mappedSession = buildSessionUser(seed, mappedUserId)
    if (mappedSession)
      return mappedSession
  }

  return {
    id: input.id,
    email: normalizeWorkspaceEmail(input.email),
    name: input.name?.trim() || formatFallbackName(input.email),
    role: input.role || "founder",
    onboardingCompleted: input.onboardingCompleted ?? false,
    subscriptionPlan: input.subscriptionPlan || "free",
  }
}

export function buildDraftMemberWorkspaceState(session: SessionUser, createdAt = now(), options: { verifiedEmail?: boolean } = {}): MemberWorkspaceState {
  const verifiedEmail = options.verifiedEmail === true

  return {
    user: {
      id: session.id,
      email: normalizeWorkspaceEmail(session.email),
      role: session.role,
      createdAt,
      linkedProviders: ["email"],
      verifiedEmail,
      onboardingCompleted: session.onboardingCompleted,
      notificationPreferences: normalizeNotificationPreferences(),
      suspendedAt: null,
    },
    profile: {
      id: `profile_${session.id}`,
      userId: session.id,
      displayName: session.name,
      photoUrl: "",
      headline: "New member getting their founder profile ready.",
      bio: "Add your background, experience, and operating style to start matching with the right people.",
      location: "Remote",
      remotePreference: "remote",
      roles: [
        session.role === "founder"
          ? "Founder"
          : "Collaborator"
      ],
      yearsExperience: 0,
      industries: [],
      startupStagePreferences: ["idea"],
      compensationPreferences: ["equity_only"],
      equityExpectationRange: "Flexible",
      timeCommitment: "part_time",
      commitmentProfile: {
        weeklyAvailabilityHours: 10,
        fullTimeBy: "",
        runwayBucket: "undisclosed",
        currentStatus: "exploring",
      },
      governancePreferences: {
        equityPhilosophy: "equal_unless_strong_reason",
        leadershipPreference: session.role === "founder"
          ? "wants_ceo_role"
          : "prefers_non_ceo_role",
        decisionModelPreference: "area_owner_decides",
        deadlockPreference: "advisor_tiebreaker",
      },
      roleScope: {
        primaryRole: session.role === "founder"
          ? "Founder"
          : "Collaborator",
        nonResponsibilities: [],
        accountabilityMilestones: [],
      },
      ipReadiness: {
        existingAssets: [],
        existingAssetsNotes: "",
        priorObligations: "none_known",
        readyToAssignIp: false,
      },
      links: {
        linkedin: "",
        github: "",
        portfolio: "",
        website: "",
      },
      hasIdea: session.role === "founder",
      wantsToJoinIdea: session.role !== "founder",
      values: [],
      workStylePreferences: [],
      privacy: {
        profileVisibility: "members",
        portfolioVisibility: "private",
        opportunityVisibility: "members",
        contactDetailsVisibleToMatchesOnly: true,
        contactRevealStage: "matches",
      },
      verificationBadges: {
        profileComplete: false,
        emailVerified: verifiedEmail,
        linkedAccounts: false,
      },
      intent: {
        startTimeline: "exploring",
        companyPreferences: [],
        nonNegotiables: [],
        introCapacity: "",
      },
      trustSignals: {
        replyRatePercent: 0,
        medianReplyHours: 48,
        lastActiveAt: createdAt,
        identityVerified: false,
        workHistoryVerified: false,
        phoneVerified: false,
        linkedInVerified: false,
        githubVerified: false,
        workDomainVerified: false,
        websiteVerified: false,
        governmentIdVerified: false,
        builderProofs: [],
      },
      availability: "Profile still in progress.",
      portfolio: [],
      ventures: [],
      summaryHighlights: ["Finish onboarding to appear in recommendations"],
    },
    subscription: {
      id: `subscription_${session.id}`,
      userId: session.id,
      plan: session.subscriptionPlan,
      status: "active",
      billingCycle: "monthly",
      renewsAt: null,
      cancelAtPeriodEnd: false,
      visibilityBoost: false,
      unlimitedMessaging: false,
      proposalWorkflow: false,
      contractBuilder: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCheckoutSessionId: null,
      stripeCurrentPeriodEnd: null,
      stripeStatus: null,
    },
    opportunities: [],
    bookmarks: [],
    savedSearches: [],
  }
}

export function buildMemberWorkspaceState(seed: WorkspaceSeed, userId: string): MemberWorkspaceState | null {
  const user = getUserById(seed, userId)
  const profile = getProfileByUserId(seed, userId)
  const subscription = getSubscriptionByUserId(seed, userId)

  if (!user || !profile || !subscription)
    return null

  return {
    user: cloneValue(user),
    profile: cloneValue(profile),
    subscription: cloneValue(subscription),
    opportunities: cloneValue(seed.opportunities.filter(opportunity => opportunity.ownerUserId === userId)),
    bookmarks: cloneValue(seed.bookmarks.filter(bookmark => bookmark.userId === userId)),
    savedSearches: cloneValue(seed.savedSearches.filter(search => search.userId === userId)),
  }
}

function replaceSingleById<T extends { id: string }>(items: T[], nextItem: T) {
  const nextItems = items.filter(item => item.id !== nextItem.id)
  nextItems.push(cloneValue(nextItem))
  return nextItems
}

function replaceAllForUserId<T extends { userId: string }>(items: T[], userId: string, nextItems: T[]) {
  return [
    ...items.filter(item => item.userId !== userId),
    ...cloneValue(nextItems),
  ]
}

function replaceAllForOwnerUserId<T extends { ownerUserId: string }>(items: T[], ownerUserId: string, nextItems: T[]) {
  return [
    ...items.filter(item => item.ownerUserId !== ownerUserId),
    ...cloneValue(nextItems),
  ]
}

export function mergeMemberWorkspaceState(seed: WorkspaceSeed, state: MemberWorkspaceState) {
  const nextSeed = cloneValue(seed)
  nextSeed.users = replaceSingleById(nextSeed.users, state.user)
  nextSeed.profiles = replaceSingleById(nextSeed.profiles, state.profile)
  nextSeed.subscriptions = replaceSingleById(nextSeed.subscriptions, state.subscription)
  nextSeed.opportunities = replaceAllForOwnerUserId(nextSeed.opportunities, state.user.id, state.opportunities)
  nextSeed.bookmarks = replaceAllForUserId(nextSeed.bookmarks, state.user.id, state.bookmarks)
  nextSeed.savedSearches = replaceAllForUserId(nextSeed.savedSearches, state.user.id, state.savedSearches)
  return nextSeed
}

export function buildMemberWorkspaceWritePayload(seed: WorkspaceSeed, userId: string): MemberWorkspaceWritePayload | null {
  const state = buildMemberWorkspaceState(seed, userId)
  if (!state)
    return null

  return {
    onboardingCompleted: state.user.onboardingCompleted,
    notificationPreferences: normalizeNotificationPreferences(state.user.notificationPreferences),
    profile: state.profile,
    opportunities: state.opportunities,
    bookmarks: state.bookmarks,
    savedSearches: state.savedSearches,
  }
}

export function buildPersistedWorkspaceForSession(seed: WorkspaceSeed, input: SessionResolutionInput) {
  const session = resolveSessionUserFromWorkspace(seed, input)
  return {
    seed,
    session,
    state: buildMemberWorkspaceState(seed, session.id) || buildDraftMemberWorkspaceState(session),
  }
}

export function sanitizeUserOwnedBookmarks(bookmarks: Bookmark[], userId: string) {
  return bookmarks
    .filter(bookmark => bookmark.userId === userId)
    .map(bookmark => ({ ...bookmark, userId }))
}

export function sanitizeUserOwnedSavedSearches(savedSearches: SavedSearch[], userId: string) {
  return savedSearches
    .filter(search => search.userId === userId)
    .map(search => ({ ...search, userId }))
}

export function sanitizeUserOwnedOpportunities(opportunities: StartupOpportunity[], userId: string) {
  return opportunities
    .filter(opportunity => opportunity.ownerUserId === userId)
    .map(opportunity => ({ ...opportunity, ownerUserId: userId }))
}

export function sanitizeOwnedProfile(profile: Profile, userId: string) {
  return {
    ...profile,
    userId,
  }
}
