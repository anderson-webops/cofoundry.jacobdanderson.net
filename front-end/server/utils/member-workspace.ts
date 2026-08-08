import type { H3Event } from "h3"
import type { MemberWorkspaceState, MemberWorkspaceWritePayload, Profile, SavedSearch, SessionUser, StartupOpportunity, Subscription, User, WorkspaceSeed } from "../../shared/types/domain"
import { randomUUID } from "node:crypto"
import { createError } from "h3"
import { checkSavedSearchCount } from "../../shared/utils/billing"
import { buildOpportunityRiskFlags, buildProfileReadiness, resolveNewOpportunityVerificationStatus } from "../../shared/utils/formation"
import { normalizeNotificationPreferences } from "../../shared/utils/notification-preferences"
import { canAccessCoreMemberWorkspace } from "../../shared/utils/session-authority"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceState, mergeMemberWorkspaceState, resolveSessionUserFromWorkspace } from "../../shared/utils/workspace-persistence"
import { mergeLocalAdminAuditState } from "./local-admin-audit"
import { loadLocalCollaborationState } from "./local-collaboration-store"
import { persistLocalMemberWorkspaceState, readLocalMemberWorkspaceState, readLocalMemberWorkspaceStates } from "./local-member-workspace"
import { listLocalTrustVerificationEvents } from "./local-operations-store"
import { loadServerCollaborationState, mergeServerCollaborationState } from "./member-collaboration"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"
import { createInitialWorkspaceDocument } from "./workspace-seed"

interface PersistedIdentityInput {
  email: string
  id: string
  name: string
  onboardingCompleted: boolean
  role: User["role"]
  subscriptionPlan: Subscription["plan"]
  verifiedEmail?: boolean
}

interface LoadMemberWorkspaceOptions {
  allowUserBootstrap?: boolean
}

interface PersistedProfileStateRow {
  profile: Profile
  updated_at: string
  user_id: string
}

interface PersistedSubscriptionRow {
  billing_cycle: Subscription["billingCycle"]
  cancel_at_period_end: boolean
  contract_builder: boolean
  id: string
  plan: Subscription["plan"]
  proposal_workflow: boolean
  renews_at: string | null
  status: Subscription["status"]
  stripe_checkout_session_id?: string | null
  stripe_current_period_end?: string | null
  stripe_customer_id?: string | null
  stripe_price_id?: string | null
  stripe_status?: string | null
  stripe_subscription_id?: string | null
  unlimited_messaging: boolean
  user_id: string
  visibility_boost: boolean
}

interface PersistedUserRow {
  created_at: string
  email: string
  email_digest_enabled?: boolean | null
  id: string
  linked_providers: User["linkedProviders"]
  onboarding_completed: boolean
  role: User["role"]
  suspended_at: string | null
  verified_email: boolean
  workflow_email_enabled?: boolean | null
}

interface PersistedBookmarkRow {
  created_at: string
  id: string
  target_id: string
  target_type: "profile" | "opportunity"
  user_id: string
}

interface PersistedSavedSearchRow {
  created_at: string
  filters: SavedSearch["filters"]
  id: string
  label: string
  scope: SavedSearch["scope"]
  user_id: string
}

interface PersistedOpportunityRow {
  compensation_structure: StartupOpportunity["compensationStructure"]
  created_at: string
  equity_range: string
  expected_commitment: StartupOpportunity["expectedCommitment"]
  id: string
  industries: string[]
  is_open: boolean
  location: string
  official_website: string
  one_line_pitch: string
  owner_user_id: string
  problem: string
  remote_preference: StartupOpportunity["remotePreference"]
  risk_flags: string[]
  roles_needed: string[]
  slug: string
  stage: StartupOpportunity["stage"]
  startup_name: string
  target_users: string
  traction: string
  updated_at: string
  verification_method: StartupOpportunity["verificationMethod"]
  verification_status: StartupOpportunity["verificationStatus"]
}

export interface PersistedTrustVerificationRow {
  occurred_at: string
  status: "verified" | "failed" | "manual_review" | "expired"
  target_id: string
  target_type: "profile" | "user" | "opportunity"
  verification_type: "identity" | "work_history" | "phone" | "linkedin" | "github" | "work_domain" | "website" | "government_id" | "email" | "opportunity_domain" | "opportunity_owner"
}

export interface AdminOpportunityWorkspaceSlice {
  opportunities: StartupOpportunity[]
  profiles: Profile[]
  users: User[]
}

function createBaseSeed() {
  return createInitialWorkspaceDocument()
}

function safeBootstrapRole(role: User["role"]): "collaborator" | "founder" {
  return role === "collaborator" ? "collaborator" : "founder"
}

function buildBootstrapSession(
  identity: PersistedIdentityInput,
  options: { preserveAuthoritativeRole?: boolean } = {},
): SessionUser {
  const email = identity.email.trim().toLowerCase()
  return {
    email,
    id: identity.id,
    name: identity.name.trim() || email.split("@")[0] || "Member",
    onboardingCompleted: options.preserveAuthoritativeRole ? identity.onboardingCompleted : false,
    role: options.preserveAuthoritativeRole ? identity.role : safeBootstrapRole(identity.role),
    subscriptionPlan: "free",
  }
}

export function buildBootstrapState(
  identity: PersistedIdentityInput,
  options: { preserveAuthoritativeRole?: boolean } = {},
) {
  const resolvedSession = buildBootstrapSession(identity, options)
  return buildDraftMemberWorkspaceState(resolvedSession, undefined, {
    verifiedEmail: identity.verifiedEmail,
  })
}

function buildMergedSeed(state: MemberWorkspaceState) {
  return mergeMemberWorkspaceState(createBaseSeed(), syncWorkspaceVerificationState(state))
}

function contractParticipantUserIds(seed: WorkspaceSeed) {
  const participantIds = new Set<string>()

  for (const contract of seed.contracts) {
    const proposal = seed.proposals.find(item => item.id === contract.proposalId)
    if (!proposal)
      continue

    participantIds.add(proposal.createdByUserId)
    participantIds.add(proposal.recipientUserId)
  }

  return participantIds
}

function replaceParticipantSubscriptions(
  seed: WorkspaceSeed,
  participantIds: Set<string>,
  subscriptions: Subscription[],
) {
  return {
    ...seed,
    subscriptions: [
      ...seed.subscriptions.filter(subscription => !participantIds.has(subscription.userId)),
      ...subscriptions,
    ],
  }
}

async function mergeLocalParticipantSubscriptions(seed: WorkspaceSeed) {
  const participantIds = contractParticipantUserIds(seed)
  if (!participantIds.size)
    return seed

  const subscriptionsByUserId = new Map(
    seed.subscriptions
      .filter(subscription => participantIds.has(subscription.userId))
      .map(subscription => [subscription.userId, subscription]),
  )
  for (const state of await readLocalMemberWorkspaceStates()) {
    if (participantIds.has(state.user.id))
      subscriptionsByUserId.set(state.user.id, state.subscription)
  }

  return replaceParticipantSubscriptions(seed, participantIds, [...subscriptionsByUserId.values()])
}

function syncWorkspaceVerificationState(state: MemberWorkspaceState): MemberWorkspaceState {
  return {
    ...state,
    profile: {
      ...state.profile,
      verificationBadges: {
        ...state.profile.verificationBadges,
        emailVerified: state.user.verifiedEmail,
      },
    },
  }
}

export function applyAuthoritativeTrustEvents(state: MemberWorkspaceState, events: PersistedTrustVerificationRow[]): MemberWorkspaceState {
  const relevantEvents = events
    .filter(event =>
      (event.target_type === "profile" && event.target_id === state.profile.id)
      || (event.target_type === "user" && event.target_id === state.user.id),
    )
    .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime())
  const latestByType = new Map<string, PersistedTrustVerificationRow>()

  for (const event of relevantEvents) {
    if (!latestByType.has(event.verification_type))
      latestByType.set(event.verification_type, event)
  }

  const verified = (verificationType: PersistedTrustVerificationRow["verification_type"]) =>
    latestByType.get(verificationType)?.status === "verified"
  const governmentIdVerified = verified("government_id")
  const linkedInVerified = verified("linkedin")
  const githubVerified = verified("github")
  const workDomainVerified = verified("work_domain")
  const websiteVerified = verified("website")

  return {
    ...state,
    profile: {
      ...state.profile,
      trustSignals: {
        ...state.profile.trustSignals,
        githubVerified,
        governmentIdVerified,
        identityVerified: verified("identity") || governmentIdVerified,
        linkedInVerified,
        phoneVerified: verified("phone"),
        websiteVerified,
        workDomainVerified,
        workHistoryVerified: verified("work_history"),
      },
      verificationBadges: {
        ...state.profile.verificationBadges,
        emailVerified: state.user.verifiedEmail,
        linkedAccounts: [linkedInVerified, githubVerified, workDomainVerified, websiteVerified].some(Boolean),
      },
    },
  }
}

async function loadAuthoritativeTrustState(event: H3Event, state: MemberWorkspaceState) {
  const targetIds = [state.user.id, state.profile.id]
  if (!isSupabaseEnabled(event)) {
    const events = await listLocalTrustVerificationEvents(targetIds)
    return applyAuthoritativeTrustEvents(state, events)
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("trust_verification_events")
    .select("target_type,target_id,verification_type,status,occurred_at")
    .in("target_id", targetIds)
    .in("target_type", ["profile", "user"])
    .order("occurred_at", { ascending: false })
    .limit(100)

  if (error)
    throw error

  return applyAuthoritativeTrustEvents(state, (data || []) as PersistedTrustVerificationRow[])
}

async function buildLocalRuntimeSeed(state: MemberWorkspaceState) {
  let seed = buildMergedSeed(state)
  const authoritativeSeed = await mergeLocalAdminAuditState(seed)
  const authoritativeUser = authoritativeSeed.users.find(user => user.id === state.user.id)
  const collaborationState = await loadLocalCollaborationState(state.user.id, {
    includeAdministrativeData: authoritativeUser?.role === "admin" && !authoritativeUser.suspendedAt && authoritativeUser.verifiedEmail,
  })

  if (collaborationState)
    seed = mergeServerCollaborationState(seed, collaborationState)

  return mergeLocalParticipantSubscriptions(await mergeLocalAdminAuditState(seed))
}

function toUserRow(user: User): PersistedUserRow {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.createdAt,
    linked_providers: user.linkedProviders,
    verified_email: user.verifiedEmail,
    onboarding_completed: user.onboardingCompleted,
    email_digest_enabled: user.notificationPreferences.unreadDigestEmail,
    workflow_email_enabled: user.notificationPreferences.workflowEmail,
    suspended_at: user.suspendedAt,
  }
}

function fromUserRow(row: PersistedUserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    linkedProviders: row.linked_providers,
    verifiedEmail: row.verified_email,
    onboardingCompleted: row.onboarding_completed,
    notificationPreferences: normalizeNotificationPreferences({
      unreadDigestEmail: row.email_digest_enabled ?? false,
      workflowEmail: row.workflow_email_enabled ?? false,
    }),
    suspendedAt: row.suspended_at,
  }
}

function toSubscriptionRow(subscription: Subscription): PersistedSubscriptionRow {
  return {
    id: subscription.id,
    user_id: subscription.userId,
    plan: subscription.plan,
    status: subscription.status,
    billing_cycle: subscription.billingCycle,
    renews_at: subscription.renewsAt,
    cancel_at_period_end: subscription.cancelAtPeriodEnd,
    visibility_boost: subscription.visibilityBoost,
    unlimited_messaging: subscription.unlimitedMessaging,
    proposal_workflow: subscription.proposalWorkflow,
    contract_builder: subscription.contractBuilder,
    stripe_customer_id: subscription.stripeCustomerId || null,
    stripe_subscription_id: subscription.stripeSubscriptionId || null,
    stripe_price_id: subscription.stripePriceId || null,
    stripe_checkout_session_id: subscription.stripeCheckoutSessionId || null,
    stripe_current_period_end: subscription.stripeCurrentPeriodEnd || null,
    stripe_status: subscription.stripeStatus || null,
  }
}

function fromSubscriptionRow(row: PersistedSubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    billingCycle: row.billing_cycle,
    renewsAt: row.renews_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    visibilityBoost: row.visibility_boost,
    unlimitedMessaging: row.unlimited_messaging,
    proposalWorkflow: row.proposal_workflow,
    contractBuilder: row.contract_builder,
    stripeCustomerId: row.stripe_customer_id || null,
    stripeSubscriptionId: row.stripe_subscription_id || null,
    stripePriceId: row.stripe_price_id || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripeCurrentPeriodEnd: row.stripe_current_period_end || null,
    stripeStatus: row.stripe_status || null,
  }
}

function toBookmarkRows(userId: string, bookmarks: MemberWorkspaceState["bookmarks"]): PersistedBookmarkRow[] {
  return bookmarks.map(bookmark => ({
    id: bookmark.id,
    user_id: userId,
    target_type: bookmark.targetType,
    target_id: bookmark.targetId,
    created_at: bookmark.createdAt,
  }))
}

function fromBookmarkRows(rows: PersistedBookmarkRow[]): MemberWorkspaceState["bookmarks"] {
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at,
  }))
}

function toSavedSearchRows(userId: string, savedSearches: MemberWorkspaceState["savedSearches"]): PersistedSavedSearchRow[] {
  return savedSearches.map(search => ({
    id: search.id,
    user_id: userId,
    label: search.label,
    scope: search.scope,
    filters: search.filters,
    created_at: search.createdAt,
  }))
}

function fromSavedSearchRows(rows: PersistedSavedSearchRow[]): MemberWorkspaceState["savedSearches"] {
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    label: row.label,
    scope: row.scope,
    filters: row.filters,
    createdAt: row.created_at,
  }))
}

function toOpportunityRows(userId: string, opportunities: StartupOpportunity[]): PersistedOpportunityRow[] {
  return opportunities.map(opportunity => ({
    id: opportunity.id,
    owner_user_id: userId,
    startup_name: opportunity.startupName,
    slug: opportunity.slug,
    one_line_pitch: opportunity.oneLinePitch,
    problem: opportunity.problem,
    target_users: opportunity.targetUsers,
    stage: opportunity.stage,
    traction: opportunity.traction,
    roles_needed: opportunity.rolesNeeded,
    expected_commitment: opportunity.expectedCommitment,
    compensation_structure: opportunity.compensationStructure,
    equity_range: opportunity.equityRange,
    industries: opportunity.industries,
    location: opportunity.location,
    remote_preference: opportunity.remotePreference,
    official_website: opportunity.officialWebsite,
    verification_method: opportunity.verificationMethod,
    verification_status: opportunity.verificationStatus,
    risk_flags: opportunity.riskFlags,
    created_at: opportunity.createdAt,
    updated_at: opportunity.updatedAt,
    is_open: opportunity.isOpen,
  }))
}

function fromOpportunityRows(rows: PersistedOpportunityRow[]): StartupOpportunity[] {
  return rows.map(row => ({
    id: row.id,
    ownerUserId: row.owner_user_id,
    startupName: row.startup_name,
    slug: row.slug,
    oneLinePitch: row.one_line_pitch,
    problem: row.problem,
    targetUsers: row.target_users,
    stage: row.stage,
    traction: row.traction,
    rolesNeeded: row.roles_needed,
    expectedCommitment: row.expected_commitment,
    compensationStructure: row.compensation_structure,
    equityRange: row.equity_range,
    industries: row.industries,
    location: row.location,
    remotePreference: row.remote_preference,
    officialWebsite: row.official_website,
    verificationMethod: row.verification_method,
    verificationStatus: row.verification_status,
    riskFlags: row.risk_flags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOpen: row.is_open,
  }))
}

async function selectUser(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle<PersistedUserRow>()

  if (error)
    throw error

  return data
}

async function selectUserByEmail(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, email: string) {
  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle<PersistedUserRow>()

  if (error)
    throw error

  return data
}

async function selectProfileState(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const { data, error } = await adminClient
    .from("member_profile_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<PersistedProfileStateRow>()

  if (error)
    throw error

  return data
}

async function selectSubscription(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<PersistedSubscriptionRow>()

  if (error)
    throw error

  return data
}

async function selectSubscriptions(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userIds: string[]) {
  if (!userIds.length)
    return []

  const { data, error } = await adminClient
    .from("subscriptions")
    .select("*")
    .in("user_id", userIds)

  if (error)
    throw error

  return (data || []) as PersistedSubscriptionRow[]
}

async function mergeSupabaseParticipantSubscriptions(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  seed: WorkspaceSeed,
) {
  const participantIds = contractParticipantUserIds(seed)
  if (!participantIds.size)
    return seed

  const rows = await selectSubscriptions(adminClient, [...participantIds])
  return replaceParticipantSubscriptions(seed, participantIds, rows.map(fromSubscriptionRow))
}

async function selectBookmarks(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const { data, error } = await adminClient
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedBookmarkRow[]
}

async function selectSavedSearches(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const { data, error } = await adminClient
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedSavedSearchRow[]
}

async function selectOpportunities(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string) {
  const { data, error } = await adminClient
    .from("startup_opportunities")
    .select("*")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })

  if (error)
    throw error

  return (data || []) as PersistedOpportunityRow[]
}

async function selectAllOpportunities(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await adminClient
    .from("startup_opportunities")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500)

  if (error)
    throw error

  return (data || []) as PersistedOpportunityRow[]
}

async function selectUsersByIds(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userIds: string[]) {
  if (!userIds.length)
    return []

  const { data, error } = await adminClient
    .from("users")
    .select("*")
    .in("id", userIds)

  if (error)
    throw error

  return (data || []) as PersistedUserRow[]
}

async function selectProfileStatesByUserIds(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userIds: string[]) {
  if (!userIds.length)
    return []

  const { data, error } = await adminClient
    .from("member_profile_state")
    .select("*")
    .in("user_id", userIds)

  if (error)
    throw error

  return (data || []) as PersistedProfileStateRow[]
}

function mergeRowsById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const primaryIds = new Set(primary.map(row => row.id))
  return [
    ...primary,
    ...fallback.filter(row => !primaryIds.has(row.id)),
  ]
}

function sortOpportunitiesByUpdate(opportunities: StartupOpportunity[]) {
  return [...opportunities].sort((left, right) => {
    const rightTime = new Date(right.updatedAt || right.createdAt).getTime()
    const leftTime = new Date(left.updatedAt || left.createdAt).getTime()
    return rightTime - leftTime
  })
}

const opportunitySlugPattern = /[^a-z0-9]+/g
const opportunitySlugTrimPattern = /^-|-$/g

function createServerId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
}

function createOpportunitySlug(input: string) {
  return input.toLowerCase().replaceAll(opportunitySlugPattern, "-").replaceAll(opportunitySlugTrimPattern, "")
}

function opportunitySecurityFingerprint(opportunity: StartupOpportunity) {
  return JSON.stringify({
    compensationStructure: opportunity.compensationStructure,
    equityRange: opportunity.equityRange,
    expectedCommitment: opportunity.expectedCommitment,
    industries: opportunity.industries,
    location: opportunity.location,
    officialWebsite: opportunity.officialWebsite,
    oneLinePitch: opportunity.oneLinePitch,
    problem: opportunity.problem,
    remotePreference: opportunity.remotePreference,
    rolesNeeded: opportunity.rolesNeeded,
    stage: opportunity.stage,
    startupName: opportunity.startupName,
    targetUsers: opportunity.targetUsers,
    traction: opportunity.traction,
    verificationMethod: opportunity.verificationMethod,
  })
}

export function sanitizeProfileWrite(current: MemberWorkspaceState, incoming: Profile, updatedAt: string): Profile {
  const profile: Profile = {
    ...incoming,
    id: current.profile.id,
    userId: current.user.id,
    trustSignals: {
      ...current.profile.trustSignals,
      builderProofs: current.profile.trustSignals.builderProofs,
      lastActiveAt: updatedAt,
    },
    verificationBadges: {
      ...current.profile.verificationBadges,
      emailVerified: current.user.verifiedEmail,
      linkedAccounts: Boolean(
        current.profile.trustSignals.linkedInVerified
        || current.profile.trustSignals.githubVerified
        || current.profile.trustSignals.workDomainVerified
        || current.profile.trustSignals.websiteVerified,
      ),
      profileComplete: false,
    },
  }

  profile.verificationBadges.profileComplete = buildProfileReadiness(profile).profileComplete
  return profile
}

export function sanitizeOpportunityWrites(current: MemberWorkspaceState, incoming: StartupOpportunity[], updatedAt: string) {
  const seenIds = new Set<string>()

  return incoming.map((candidate) => {
    const existing = current.opportunities.find(opportunity => opportunity.id === candidate.id && !seenIds.has(opportunity.id))
    if (existing)
      seenIds.add(existing.id)

    const editable: StartupOpportunity = {
      ...candidate,
      id: existing?.id || createServerId("opportunity"),
      ownerUserId: current.user.id,
      slug: createOpportunitySlug(candidate.startupName),
      riskFlags: buildOpportunityRiskFlags(candidate),
      verificationStatus: "unverified",
      createdAt: existing?.createdAt || updatedAt,
      updatedAt,
    }
    const changed = !existing || opportunitySecurityFingerprint(existing) !== opportunitySecurityFingerprint(editable)
    editable.verificationStatus = changed
      ? resolveNewOpportunityVerificationStatus(editable.verificationMethod, editable.riskFlags)
      : existing.verificationStatus

    return editable
  })
}

function sanitizeBookmarkWrites(
  current: Awaited<ReturnType<typeof loadMemberWorkspaceState>>,
  incoming: MemberWorkspaceWritePayload["bookmarks"],
  createdAt: string,
) {
  const visible = projectWorkspaceForSession(current.seed, current.session)
  const visibleProfileIds = new Set(visible.profiles.map(profile => profile.id))
  const visibleOpportunityIds = new Set(visible.opportunities.map(opportunity => opportunity.id))
  const seenTargets = new Set<string>()

  return incoming.flatMap((bookmark) => {
    const targetKey = `${bookmark.targetType}:${bookmark.targetId}`
    const validTarget = bookmark.targetType === "profile"
      ? visibleProfileIds.has(bookmark.targetId)
      : visibleOpportunityIds.has(bookmark.targetId)

    if (!validTarget || seenTargets.has(targetKey))
      return []

    seenTargets.add(targetKey)
    const existing = current.state.bookmarks.find(item =>
      item.targetType === bookmark.targetType && item.targetId === bookmark.targetId,
    )
    return [{
      id: existing?.id || createServerId("bookmark"),
      userId: current.state.user.id,
      targetType: bookmark.targetType,
      targetId: bookmark.targetId,
      createdAt: existing?.createdAt || createdAt,
    }]
  })
}

function sanitizeSavedSearchWrites(current: MemberWorkspaceState, incoming: SavedSearch[], createdAt: string) {
  const seenIds = new Set<string>()

  return incoming.map((search) => {
    const existing = current.savedSearches.find(item => item.id === search.id && !seenIds.has(item.id))
    if (existing)
      seenIds.add(existing.id)

    return {
      ...search,
      id: existing?.id || createServerId("saved_search"),
      userId: current.user.id,
      createdAt: existing?.createdAt || createdAt,
    }
  })
}

export async function listAdminOpportunityWorkspaceSlice(event: H3Event): Promise<AdminOpportunityWorkspaceSlice> {
  const baseSeed = createBaseSeed()

  if (!isSupabaseEnabled(event)) {
    const localStates = (await readLocalMemberWorkspaceStates()).map(syncWorkspaceVerificationState)
    const auditedSeed = await mergeLocalAdminAuditState({
      ...baseSeed,
      opportunities: sortOpportunitiesByUpdate(mergeRowsById(
        localStates.flatMap(state => state.opportunities),
        baseSeed.opportunities,
      )),
      profiles: mergeRowsById(
        localStates.map(state => state.profile),
        baseSeed.profiles,
      ),
      users: mergeRowsById(
        localStates.map(state => state.user),
        baseSeed.users,
      ),
    })

    return {
      opportunities: sortOpportunitiesByUpdate(auditedSeed.opportunities),
      profiles: auditedSeed.profiles,
      users: auditedSeed.users,
    }
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const opportunityRows = await selectAllOpportunities(adminClient)
  const opportunities = fromOpportunityRows(opportunityRows)
  const ownerUserIds = [...new Set(opportunities.map(opportunity => opportunity.ownerUserId))]
  const [userRows, profileRows] = await Promise.all([
    selectUsersByIds(adminClient, ownerUserIds),
    selectProfileStatesByUserIds(adminClient, ownerUserIds),
  ])

  return {
    opportunities: sortOpportunitiesByUpdate(mergeRowsById(opportunities, baseSeed.opportunities)),
    profiles: mergeRowsById(profileRows.map(row => row.profile), baseSeed.profiles),
    users: mergeRowsById(userRows.map(fromUserRow), baseSeed.users),
  }
}

export async function persistWholeMemberWorkspaceState(
  event: H3Event,
  state: MemberWorkspaceState,
  options: {
    accessInvite?: {
      acceptedAt: string
      email: string
      tokenHash: string
    }
    replaceSubscription?: boolean
  } = {},
) {
  const nextState = syncWorkspaceVerificationState(state)

  if (!isSupabaseEnabled(event)) {
    await persistLocalMemberWorkspaceState(nextState)
    return
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const workspacePayload = {
    p_bookmarks: toBookmarkRows(nextState.user.id, nextState.bookmarks),
    p_opportunities: toOpportunityRows(nextState.user.id, nextState.opportunities),
    p_profile_state: {
      profile: nextState.profile,
      updated_at: new Date().toISOString(),
      user_id: nextState.profile.userId,
    },
    p_replace_subscription: options.replaceSubscription === true,
    p_saved_searches: toSavedSearchRows(nextState.user.id, nextState.savedSearches),
    p_subscription: toSubscriptionRow(nextState.subscription),
    p_user: toUserRow(nextState.user),
  }
  const { error } = options.accessInvite
    ? await adminClient.rpc("cofoundry_accept_access_invite_and_replace_member_workspace", {
        ...workspacePayload,
        p_accepted_at: options.accessInvite.acceptedAt,
        p_invite_email: options.accessInvite.email,
        p_invite_token_hash: options.accessInvite.tokenHash,
      })
    : await adminClient.rpc("cofoundry_replace_member_workspace", workspacePayload)

  if (error)
    throw error
}

export async function loadMemberWorkspaceState(
  event: H3Event,
  identity: PersistedIdentityInput,
  options: LoadMemberWorkspaceOptions = {},
) {
  if (!canAccessCoreMemberWorkspace(identity)) {
    throw createError({
      statusCode: 403,
      statusMessage: "Investment review accounts cannot access member workspaces.",
    })
  }

  const baseSeed = createBaseSeed()
  const seededState = buildMemberWorkspaceState(baseSeed, identity.id)
  const fallbackSession = seededState
    ? resolveSessionUserFromWorkspace(baseSeed, identity)
    : buildBootstrapSession(identity)
  const allowUserBootstrap = options.allowUserBootstrap !== false

  if (!isSupabaseEnabled(event)) {
    const persistedState = await readLocalMemberWorkspaceState(fallbackSession.id)
    if (!persistedState && !seededState && !allowUserBootstrap) {
      throw createError({
        statusCode: 403,
        statusMessage: "This account has not been provisioned for CoFoundry.",
      })
    }

    const baseState = persistedState
      || seededState
      || buildBootstrapState(identity)
    const state = persistedState
      ? await loadAuthoritativeTrustState(event, baseState)
      : baseState
    const seed = await buildLocalRuntimeSeed(state)

    return {
      seed,
      session: resolveSessionUserFromWorkspace(seed, fallbackSession),
      state,
    }
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  let userRow = await selectUser(adminClient, fallbackSession.id)
  if (!userRow) {
    const mappedUser = await selectUserByEmail(adminClient, fallbackSession.email)
    if (mappedUser)
      userRow = mappedUser
  }

  if (!userRow) {
    if (!allowUserBootstrap) {
      throw createError({
        statusCode: 403,
        statusMessage: "This account has not been provisioned for CoFoundry.",
      })
    }

    const bootstrapState = buildBootstrapState(identity)
    await persistWholeMemberWorkspaceState(event, bootstrapState)
    const seed = await mergeSupabaseParticipantSubscriptions(adminClient, buildMergedSeed(bootstrapState))

    return {
      seed,
      session: resolveSessionUserFromWorkspace(seed, fallbackSession),
      state: bootstrapState,
    }
  }

  const profileRow = await selectProfileState(adminClient, userRow.id)
  const subscriptionRow = await selectSubscription(adminClient, userRow.id)
  const bookmarks = await selectBookmarks(adminClient, userRow.id)
  const savedSearches = await selectSavedSearches(adminClient, userRow.id)
  const opportunities = await selectOpportunities(adminClient, userRow.id)

  if (!profileRow || !subscriptionRow) {
    const bootstrapState = buildBootstrapState({
      ...identity,
      email: userRow.email,
      id: userRow.id,
      onboardingCompleted: userRow.onboarding_completed,
      role: userRow.role,
      verifiedEmail: userRow.verified_email,
    }, { preserveAuthoritativeRole: true })
    await persistWholeMemberWorkspaceState(event, bootstrapState)
    const seed = await mergeSupabaseParticipantSubscriptions(adminClient, buildMergedSeed(bootstrapState))

    return {
      seed,
      session: resolveSessionUserFromWorkspace(seed, {
        ...fallbackSession,
        email: bootstrapState.user.email,
        id: bootstrapState.user.id,
        onboardingCompleted: bootstrapState.user.onboardingCompleted,
        role: bootstrapState.user.role,
        subscriptionPlan: bootstrapState.subscription.plan,
      }),
      state: bootstrapState,
    }
  }

  const state = await loadAuthoritativeTrustState(event, syncWorkspaceVerificationState({
    user: fromUserRow(userRow),
    profile: profileRow.profile,
    subscription: fromSubscriptionRow(subscriptionRow),
    opportunities: fromOpportunityRows(opportunities),
    bookmarks: fromBookmarkRows(bookmarks),
    savedSearches: fromSavedSearchRows(savedSearches),
  }))
  const mergedSeed = buildMergedSeed(state)
  const collaborationState = await loadServerCollaborationState(event, userRow.id, {
    includeAdministrativeData: userRow.role === "admin" && !userRow.suspended_at && userRow.verified_email,
  })
  const seed = await mergeSupabaseParticipantSubscriptions(
    adminClient,
    mergeServerCollaborationState(mergedSeed, collaborationState),
  )

  return {
    seed,
    session: resolveSessionUserFromWorkspace(seed, {
      ...fallbackSession,
      email: userRow.email,
      id: userRow.id,
      onboardingCompleted: userRow.onboarding_completed,
      role: userRow.role,
      subscriptionPlan: state.subscription.plan,
    }),
    state,
  }
}

export async function persistMemberWorkspaceWritePayload(event: H3Event, identity: PersistedIdentityInput, payload: MemberWorkspaceWritePayload) {
  const current = await loadMemberWorkspaceState(event, identity)
  const updatedAt = new Date().toISOString()
  const savedSearches = sanitizeSavedSearchWrites(current.state, payload.savedSearches, updatedAt)
  const savedSearchGate = checkSavedSearchCount(current.state.subscription, savedSearches.length)

  if (!savedSearchGate.allowed) {
    throw createError({
      statusCode: 402,
      statusMessage: savedSearchGate.reason || "Your plan does not allow this saved search change.",
    })
  }

  const nextState: MemberWorkspaceState = {
    ...current.state,
    user: {
      ...current.state.user,
      role: ["admin", "investor_admin"].includes(current.state.user.role)
        ? current.state.user.role
        : payload.profile.hasIdea ? "founder" : "collaborator",
      notificationPreferences: normalizeNotificationPreferences(payload.notificationPreferences),
    },
    profile: sanitizeProfileWrite(current.state, payload.profile, updatedAt),
    opportunities: sanitizeOpportunityWrites(current.state, payload.opportunities, updatedAt),
    bookmarks: sanitizeBookmarkWrites(current, payload.bookmarks, updatedAt),
    savedSearches,
  }

  await persistWholeMemberWorkspaceState(event, nextState)

  const seed = isSupabaseEnabled(event) ? buildMergedSeed(nextState) : await buildLocalRuntimeSeed(nextState)
  return {
    seed,
    session: resolveSessionUserFromWorkspace(seed, {
      ...identity,
      email: nextState.user.email,
      id: nextState.user.id,
      onboardingCompleted: nextState.user.onboardingCompleted,
      role: nextState.user.role,
      subscriptionPlan: nextState.subscription.plan,
    }),
    state: nextState,
  }
}
