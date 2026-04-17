import type { H3Event } from "h3"
import type { MemberWorkspaceState, MemberWorkspaceWritePayload, Profile, SavedSearch, StartupOpportunity, Subscription, User } from "~/shared/types/domain"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceState, createInitialWorkspaceDocument, mergeMemberWorkspaceState, resolveSessionUserFromWorkspace, sanitizeOwnedProfile, sanitizeUserOwnedBookmarks, sanitizeUserOwnedOpportunities, sanitizeUserOwnedSavedSearches } from "~/shared/utils/workspace-persistence"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

interface PersistedIdentityInput {
  email: string
  id: string
  name: string
  onboardingCompleted: boolean
  role: User["role"]
  subscriptionPlan: Subscription["plan"]
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
  unlimited_messaging: boolean
  user_id: string
  visibility_boost: boolean
}

interface PersistedUserRow {
  created_at: string
  email: string
  id: string
  linked_providers: User["linkedProviders"]
  onboarding_completed: boolean
  role: User["role"]
  suspended_at: string | null
  verified_email: boolean
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

function createBaseSeed() {
  return createInitialWorkspaceDocument()
}

function buildBootstrapState(identity: PersistedIdentityInput) {
  const baseSeed = createBaseSeed()
  const resolvedSession = resolveSessionUserFromWorkspace(baseSeed, identity)
  return buildMemberWorkspaceState(baseSeed, resolvedSession.id) || buildDraftMemberWorkspaceState(resolvedSession)
}

function buildMergedSeed(state: MemberWorkspaceState) {
  return mergeMemberWorkspaceState(createBaseSeed(), state)
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

async function upsertUser(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, user: User) {
  const { error } = await adminClient
    .from("users")
    .upsert(toUserRow(user), { onConflict: "id" })

  if (error)
    throw error
}

async function upsertProfileState(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, profile: Profile) {
  const { error } = await adminClient
    .from("member_profile_state")
    .upsert({
      user_id: profile.userId,
      profile,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error)
    throw error
}

async function upsertSubscription(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, subscription: Subscription) {
  const { error } = await adminClient
    .from("subscriptions")
    .upsert(toSubscriptionRow(subscription), { onConflict: "user_id" })

  if (error)
    throw error
}

async function replaceBookmarks(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string, bookmarks: MemberWorkspaceState["bookmarks"]) {
  const { error: deleteError } = await adminClient
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)

  if (deleteError)
    throw deleteError

  if (!bookmarks.length)
    return

  const { error } = await adminClient
    .from("bookmarks")
    .insert(toBookmarkRows(userId, bookmarks))

  if (error)
    throw error
}

async function replaceSavedSearches(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string, savedSearches: MemberWorkspaceState["savedSearches"]) {
  const { error: deleteError } = await adminClient
    .from("saved_searches")
    .delete()
    .eq("user_id", userId)

  if (deleteError)
    throw deleteError

  if (!savedSearches.length)
    return

  const { error } = await adminClient
    .from("saved_searches")
    .insert(toSavedSearchRows(userId, savedSearches))

  if (error)
    throw error
}

async function replaceOpportunities(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, userId: string, opportunities: StartupOpportunity[]) {
  const { error: deleteError } = await adminClient
    .from("startup_opportunities")
    .delete()
    .eq("owner_user_id", userId)

  if (deleteError)
    throw deleteError

  if (!opportunities.length)
    return

  const { error } = await adminClient
    .from("startup_opportunities")
    .insert(toOpportunityRows(userId, opportunities))

  if (error)
    throw error
}

export async function persistWholeMemberWorkspaceState(event: H3Event, state: MemberWorkspaceState) {
  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  await upsertUser(adminClient, state.user)
  await upsertProfileState(adminClient, state.profile)
  await upsertSubscription(adminClient, state.subscription)
  await replaceBookmarks(adminClient, state.user.id, state.bookmarks)
  await replaceSavedSearches(adminClient, state.user.id, state.savedSearches)
  await replaceOpportunities(adminClient, state.user.id, state.opportunities)
}

export async function loadMemberWorkspaceState(event: H3Event, identity: PersistedIdentityInput) {
  const baseSeed = createBaseSeed()
  const fallbackSession = resolveSessionUserFromWorkspace(baseSeed, identity)

  if (!isSupabaseEnabled(event)) {
    const state = buildMemberWorkspaceState(baseSeed, fallbackSession.id) || buildDraftMemberWorkspaceState(fallbackSession)
    const seed = buildMergedSeed(state)

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
    const bootstrapState = buildBootstrapState(identity)
    await persistWholeMemberWorkspaceState(event, bootstrapState)
    const seed = buildMergedSeed(bootstrapState)

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
    })
    await persistWholeMemberWorkspaceState(event, bootstrapState)
    const seed = buildMergedSeed(bootstrapState)

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

  const state: MemberWorkspaceState = {
    user: fromUserRow(userRow),
    profile: profileRow.profile,
    subscription: fromSubscriptionRow(subscriptionRow),
    opportunities: fromOpportunityRows(opportunities),
    bookmarks: fromBookmarkRows(bookmarks),
    savedSearches: fromSavedSearchRows(savedSearches),
  }
  const seed = buildMergedSeed(state)

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
  const nextState: MemberWorkspaceState = {
    ...current.state,
    user: {
      ...current.state.user,
      onboardingCompleted: payload.onboardingCompleted,
    },
    profile: sanitizeOwnedProfile(payload.profile, current.state.user.id),
    opportunities: sanitizeUserOwnedOpportunities(payload.opportunities, current.state.user.id),
    bookmarks: sanitizeUserOwnedBookmarks(payload.bookmarks, current.state.user.id),
    savedSearches: sanitizeUserOwnedSavedSearches(payload.savedSearches, current.state.user.id),
  }

  await persistWholeMemberWorkspaceState(event, nextState)

  const seed = buildMergedSeed(nextState)
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
