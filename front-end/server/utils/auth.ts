import type { User as SupabaseAuthUser } from "@supabase/supabase-js"
import type { H3Event } from "h3"
import type { AuthProvider, SessionUser } from "~/shared/types/domain"
import type { SupportedOAuthProvider } from "~/shared/utils/oauth-providers"
import { randomBytes } from "node:crypto"
import process from "node:process"
import { createError, deleteCookie, getCookie, setCookie } from "h3"
import { useRuntimeConfig } from "nitropack/runtime"
import { workspaceSeed } from "~/shared/data/seed"
import { getSessionCookieSecurityOptions, getSessionCookieWriteOptions } from "~/shared/utils/cookie-policy"
import { isLocalDevelopmentEnvironment, readPublicEnvironment } from "~/shared/utils/environment"
import { isOAuthProviderEnabled, normalizeOAuthProvider } from "~/shared/utils/oauth-providers"
import { resolveProductAccessPolicy, areSeededReviewCredentialsEnabled as resolveSeededReviewCredentialsEnabled } from "~/shared/utils/product-access"
import { decodeSessionUser, encodeSessionUser, sessionCookieName, sessionSignatureCookieName } from "~/shared/utils/session"
import { resolveActiveSessionFromSeed, resolveSeededStaffSessionFromSeed } from "~/shared/utils/session-authority"
import { signInSchema, signUpSchema } from "~/shared/utils/validation"
import { buildSessionUser } from "~/shared/utils/workspace"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceState, resolveSessionUserFromWorkspace } from "~/shared/utils/workspace-persistence"
import { demoAuthAccounts } from "../data/demo-auth-accounts"
import { hashAccessInviteToken, validateAccessInvite } from "./access-requests"
import { resolveServerAppUrl } from "./app-url"
import { markLocalAccessInviteAccepted } from "./local-access-requests"
import { createLocalAuthAccount, deleteLocalAuthAccount, findLocalAuthSessionByEmail, findLocalAuthSessionById, updateLocalAuthOnboarding, verifyLocalAuthCredentials } from "./local-auth-store"
import { deleteLocalMemberWorkspaceState } from "./local-member-workspace"
import { loadMemberWorkspaceState, persistWholeMemberWorkspaceState } from "./member-workspace"
import { recordOperationalEvent } from "./operations-persistence"
import { createTimedSessionSignature, sessionCookieMaxAgeSeconds, verifyTimedSessionSignature } from "./session-signature"
import { createSupabaseAdminClient, createSupabaseOAuthClient, createSupabaseServerClient, isSupabaseEnabled } from "./supabase"

interface SupabaseSessionUserRow {
  email: string
  id: string
  onboarding_completed: boolean
  role: SessionUser["role"]
  suspended_at: string | null
  verified_email: boolean
}

export function resolveProvisionedInvestmentReviewerSession(
  persistedUser: SupabaseSessionUserRow | null,
  input: SessionUser,
) {
  if (
    !persistedUser
    || persistedUser.role !== "investor_admin"
    || persistedUser.suspended_at
    || !persistedUser.verified_email
    || persistedUser.email.trim().toLowerCase() !== input.email.trim().toLowerCase()
  ) {
    return null
  }

  return {
    ...input,
    email: persistedUser.email.trim().toLowerCase(),
    id: persistedUser.id,
    onboardingCompleted: persistedUser.onboarding_completed,
    role: persistedUser.role,
  } satisfies SessionUser
}

const localSessionSigningSecret = randomBytes(32).toString("base64url")

function formatOAuthCallbackUrl(event: H3Event, provider: SupportedOAuthProvider) {
  const callbackUrl = new URL("/api/auth/oauth/callback", resolveServerAppUrl(event))
  callbackUrl.searchParams.set("provider", provider)
  return callbackUrl.toString()
}

function getOAuthErrorRedirect(event: H3Event, code: string) {
  const redirectUrl = new URL("/auth/sign-in", resolveServerAppUrl(event))
  redirectUrl.searchParams.set("error", code)
  return redirectUrl.toString()
}

function getOAuthSuccessRedirect(event: H3Event, session: SessionUser) {
  return new URL(session.onboardingCompleted ? "/app" : "/onboarding", resolveServerAppUrl(event)).toString()
}

function getSupabaseOAuthDisplayName(user: SupabaseAuthUser, email: string) {
  const metadata = user.user_metadata || {}
  const candidate = metadata.name || metadata.full_name || metadata.user_name || metadata.preferred_username
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : email.split("@")[0] || "CoFoundry member"
}

function isSupabaseEmailVerified(user: SupabaseAuthUser) {
  return Boolean(user.email_confirmed_at || user.confirmed_at)
}

export function inferSupabaseOAuthProvider(user: SupabaseAuthUser, fallbackProvider?: SupportedOAuthProvider | null) {
  const candidates = [
    user.app_metadata?.provider,
    ...(Array.isArray(user.app_metadata?.providers)
      ? user.app_metadata.providers
      : []),
    ...(Array.isArray(user.identities)
      ? user.identities.map(identity => identity.provider)
      : []),
    fallbackProvider,
  ]

  for (const candidate of candidates) {
    const provider = normalizeOAuthProvider(candidate)
    if (provider)
      return provider
  }

  return null
}

export function validateSupabaseOAuthRedirectUrl(
  value: string,
  configuredSupabaseUrl: string,
  provider: SupportedOAuthProvider,
) {
  try {
    const redirectUrl = new URL(value)
    const supabaseUrl = new URL(configuredSupabaseUrl)
    const localSupabase = ["localhost", "127.0.0.1", "::1"].includes(supabaseUrl.hostname)
    const expectedPath = `${supabaseUrl.pathname.replace(/\/+$/, "")}/auth/v1/authorize`

    if (
      redirectUrl.origin !== supabaseUrl.origin
      || redirectUrl.pathname !== expectedPath
      || redirectUrl.searchParams.get("provider") !== provider
      || redirectUrl.username
      || redirectUrl.password
      || redirectUrl.hash
      || (!localSupabase && redirectUrl.protocol !== "https:")
    ) {
      return null
    }

    return redirectUrl.toString()
  }
  catch {
    return null
  }
}

function readConfiguredSessionSignatureSecret() {
  return process.env.NUXT_SESSION_SIGNING_SECRET || process.env.SESSION_SIGNING_SECRET || ""
}

function getSessionSignatureSecretForWrite() {
  const configuredSecret = readConfiguredSessionSignatureSecret()
  if (configuredSecret)
    return configuredSecret

  if (isLocalDevelopmentEnvironment(process.env))
    return localSessionSigningSecret

  throw createError({
    statusCode: 500,
    statusMessage: "SESSION_SIGNING_SECRET is required before account sessions can be created in this environment.",
  })
}

function getSessionSignatureSecretForVerify() {
  const configuredSecret = readConfiguredSessionSignatureSecret()
  if (configuredSecret)
    return configuredSecret

  return isLocalDevelopmentEnvironment(process.env)
    ? localSessionSigningSecret
    : ""
}

function createSessionSignature(encodedSession: string, secret = getSessionSignatureSecretForWrite()) {
  return createTimedSessionSignature(encodedSession, secret)
}

function verifySessionSignature(encodedSession: string, signature?: string | null) {
  if (!signature)
    return false

  const secret = getSessionSignatureSecretForVerify()
  if (!secret)
    return false

  return verifyTimedSessionSignature(encodedSession, signature, secret)
}

function getMockSessionBySeedUserId(userId: string) {
  return buildSessionUser(workspaceSeed, userId)
}

function buildIdentityInput(session: SessionUser) {
  return {
    id: session.id,
    email: session.email,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

async function readSupabaseSessionUser(event: H3Event, decodedSession: SessionUser) {
  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("users")
    .select("id,email,role,onboarding_completed,suspended_at,verified_email")
    .eq("id", decodedSession.id)
    .maybeSingle<SupabaseSessionUserRow>()

  if (error)
    throw error

  return data
}

async function requireActiveSessionFromWorkspace(event: H3Event, session: SessionUser) {
  const seededStaffSession = resolveSeededStaffSessionFromSeed(workspaceSeed, session)
  if (seededStaffSession)
    return seededStaffSession

  const workspace = await loadMemberWorkspaceState(event, buildIdentityInput(session))
  const activeSession = resolveActiveSessionFromSeed(workspace.seed, workspace.session)

  if (!activeSession || activeSession.email !== session.email) {
    throw createError({
      statusCode: 403,
      statusMessage: "This account is not active.",
    })
  }

  return activeSession
}

async function recordOAuthTelemetry(event: H3Event, session: SessionUser, provider: SupportedOAuthProvider, verifiedEmail: boolean) {
  try {
    await recordOperationalEvent(event, {
      actorUserId: session.id,
      eventType: "auth.oauth.signed_in",
      metadata: {
        emailVerified: verifiedEmail,
        provider,
      },
      severity: "info",
      source: "auth.oauth",
      targetId: session.id,
      targetType: "user",
    })
  }
  catch (error) {
    console.warn("[auth] Unable to record OAuth sign-in telemetry.", error)
  }
}

async function createSessionFromSupabaseAuthUser(event: H3Event, user: SupabaseAuthUser, provider?: AuthProvider) {
  const normalizedEmail = user.email?.trim().toLowerCase()
  if (!normalizedEmail) {
    throw createError({
      statusCode: 400,
      statusMessage: "The OAuth provider did not return a verified email address.",
    })
  }

  const verifiedEmail = isSupabaseEmailVerified(user)
  if (!verifiedEmail) {
    throw createError({
      statusCode: 403,
      statusMessage: "Confirm your email address before signing in.",
    })
  }

  const authSession: SessionUser = {
    id: user.id,
    email: normalizedEmail,
    name: getSupabaseOAuthDisplayName(user, normalizedEmail),
    onboardingCompleted: false,
    role: "founder",
    subscriptionPlan: "free",
  }
  const persistedUser = await readSupabaseSessionUser(event, authSession)
  if (persistedUser?.role === "investor_admin") {
    const reviewerSession = resolveProvisionedInvestmentReviewerSession(persistedUser, authSession)
    if (!reviewerSession) {
      throw createError({
        statusCode: 403,
        statusMessage: "This account is not active.",
      })
    }
    return reviewerSession
  }

  const { seed, session, state } = await loadMemberWorkspaceState(
    event,
    {
      ...authSession,
      verifiedEmail,
    },
    {
      allowUserBootstrap: areAccountsEnabledForCurrentEnvironment(),
    },
  )
  const activeSession = resolveActiveSessionFromSeed(seed, session)

  if (!activeSession) {
    throw createError({
      statusCode: 403,
      statusMessage: "This account is not active.",
    })
  }

  const linkedProviders = new Set<AuthProvider>(state.user.linkedProviders)
  if (provider)
    linkedProviders.add(provider)

  const nextVerifiedEmail = state.user.verifiedEmail || verifiedEmail
  const nextLinkedProviders = [...linkedProviders]
  const providerChanged = nextLinkedProviders.some(item => !state.user.linkedProviders.includes(item))
    || nextLinkedProviders.length !== state.user.linkedProviders.length
  const verifiedEmailChanged = nextVerifiedEmail !== state.user.verifiedEmail

  if (providerChanged || verifiedEmailChanged) {
    await persistWholeMemberWorkspaceState(event, {
      ...state,
      user: {
        ...state.user,
        linkedProviders: nextLinkedProviders,
        verifiedEmail: nextVerifiedEmail,
      },
    })
    const refreshed = await loadMemberWorkspaceState(event, {
      ...buildIdentityInput(activeSession),
      verifiedEmail: nextVerifiedEmail,
    })
    const refreshedSession = resolveActiveSessionFromSeed(refreshed.seed, refreshed.session)

    if (!refreshedSession) {
      throw createError({
        statusCode: 403,
        statusMessage: "This account is not active.",
      })
    }

    return refreshedSession
  }

  return activeSession
}

function areAccountsEnabledForCurrentEnvironment() {
  const publicEnvironment = readPublicEnvironment(process.env)
  const policy = resolveProductAccessPolicy({
    backendMode: publicEnvironment.backendMode,
    billingMode: publicEnvironment.billingMode,
    enableDemoAccess: publicEnvironment.enableDemoAccess,
  }, isLocalDevelopmentEnvironment(process.env))

  return policy.accountsEnabled
}

function areSeededReviewCredentialsEnabledForCurrentEnvironment(env: Record<string, string | undefined> = process.env) {
  const publicEnvironment = readPublicEnvironment(env)
  return resolveSeededReviewCredentialsEnabled({
    backendMode: publicEnvironment.backendMode,
    billingMode: publicEnvironment.billingMode,
    enableDemoAccess: publicEnvironment.enableDemoAccess,
  }, isLocalDevelopmentEnvironment(env))
}

export function assertSignInAccessEnabled() {}

export async function assertAccountAccessEnabled(event: H3Event, inviteToken?: string, email?: string) {
  if (areAccountsEnabledForCurrentEnvironment())
    return

  if (inviteToken && await validateAccessInvite(event, inviteToken, email))
    return

  throw createError({
    statusCode: 403,
    statusMessage: "Workspace access is opening in phases. Request access from the CoFoundry team.",
  })
}

export function readSession(event: H3Event) {
  const encodedSession = getCookie(event, sessionCookieName)
  const signature = getCookie(event, sessionSignatureCookieName)

  if (!encodedSession || !verifySessionSignature(encodedSession, signature))
    return null

  return decodeSessionUser(encodedSession)
}

export async function readAuthoritativeSession(event: H3Event) {
  const decodedSession = readSession(event)
  if (!decodedSession)
    return null

  if (!isSupabaseEnabled(event)) {
    const baseSession = getMockSessionBySeedUserId(decodedSession.id) || await findLocalAuthSessionById(decodedSession.id)
    if (!baseSession || baseSession.email !== decodedSession.email)
      return null

    const seededStaffSession = resolveSeededStaffSessionFromSeed(workspaceSeed, baseSession)
    if (seededStaffSession)
      return seededStaffSession

    const { seed, session } = await loadMemberWorkspaceState(event, buildIdentityInput(baseSession))
    const activeSession = resolveActiveSessionFromSeed(seed, session)
    return activeSession?.email === decodedSession.email
      ? activeSession
      : null
  }

  const persistedUser = await readSupabaseSessionUser(event, decodedSession)
  if (!persistedUser || persistedUser.email !== decodedSession.email || persistedUser.suspended_at)
    return null

  if (persistedUser.role === "investor_admin")
    return resolveProvisionedInvestmentReviewerSession(persistedUser, decodedSession)

  const { seed, session } = await loadMemberWorkspaceState(event, {
    id: persistedUser.id,
    email: persistedUser.email,
    name: decodedSession.name,
    onboardingCompleted: persistedUser.onboarding_completed,
    role: persistedUser.role,
    subscriptionPlan: decodedSession.subscriptionPlan,
    verifiedEmail: persistedUser.verified_email,
  })
  const activeSession = resolveActiveSessionFromSeed(seed, session)

  return activeSession?.email === decodedSession.email
    ? activeSession
    : null
}

export async function requireAuthenticatedSession(event: H3Event) {
  const session = await readAuthoritativeSession(event)

  if (!session) {
    clearSessionCookie(event)
    throw createError({ statusCode: 401, statusMessage: "Sign in to continue." })
  }

  return session
}

export function writeSession(event: H3Event, session: SessionUser) {
  const encodedSession = encodeSessionUser(session)
  const signature = createSessionSignature(encodedSession)
  const secure = !isLocalDevelopmentEnvironment(process.env)

  setCookie(event, sessionCookieName, encodedSession, getSessionCookieWriteOptions(secure, sessionCookieMaxAgeSeconds))
  setCookie(event, sessionSignatureCookieName, signature, getSessionCookieWriteOptions(secure, sessionCookieMaxAgeSeconds))
}

export function clearSessionCookie(event: H3Event) {
  const options = getSessionCookieSecurityOptions(!isLocalDevelopmentEnvironment(process.env))

  deleteCookie(event, sessionCookieName, options)
  deleteCookie(event, sessionSignatureCookieName, options)
}

export function getMockSessionByUserId(userId: string) {
  return getMockSessionBySeedUserId(userId)
}

export function getSessionForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  const seededAccount = demoAuthAccounts.find(account => account.email === normalizedEmail)
  if (seededAccount)
    return getMockSessionBySeedUserId(seededAccount.userId)

  return null
}

export function validateSignInPayload(payload: unknown) {
  return signInSchema.parse(payload)
}

export function validateSignUpPayload(payload: unknown) {
  return signUpSchema.parse(payload)
}

export async function beginSupabaseOAuthSignIn(event: H3Event, provider: SupportedOAuthProvider) {
  if (!isSupabaseEnabled(event)) {
    throw createError({
      statusCode: 501,
      statusMessage: "OAuth sign-in is not enabled for this deployment yet.",
    })
  }

  if (!isOAuthProviderEnabled(provider, process.env)) {
    throw createError({
      statusCode: 501,
      statusMessage: "OAuth sign-in is not enabled for this provider yet.",
    })
  }

  const client = createSupabaseOAuthClient(event)
  if (!client)
    throw createError({ statusCode: 500, statusMessage: "Supabase OAuth client is unavailable." })

  const result = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: formatOAuthCallbackUrl(event, provider),
    },
  })

  if (result.error || !result.data.url) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unable to start OAuth sign-in.",
    })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const redirectUrl = validateSupabaseOAuthRedirectUrl(
    result.data.url,
    String(runtimeConfig.public.supabaseUrl || ""),
    provider,
  )
  if (!redirectUrl) {
    throw createError({
      statusCode: 502,
      statusMessage: "The OAuth provider returned an invalid authorization URL.",
    })
  }

  return redirectUrl
}

export async function completeSupabaseOAuthCallback(event: H3Event, code: string, providerHint?: SupportedOAuthProvider | null) {
  if (!isSupabaseEnabled(event))
    return getOAuthErrorRedirect(event, "oauth_unavailable")

  if (!code)
    return getOAuthErrorRedirect(event, "oauth_failed")

  const client = createSupabaseOAuthClient(event)
  if (!client)
    return getOAuthErrorRedirect(event, "oauth_unavailable")

  const result = await client.auth.exchangeCodeForSession(code)
  const user = result.data.user
  const provider = user
    ? inferSupabaseOAuthProvider(user, providerHint)
    : null

  if (result.error || !user || !provider)
    return getOAuthErrorRedirect(event, "oauth_failed")

  if (!isOAuthProviderEnabled(provider, process.env))
    return getOAuthErrorRedirect(event, "oauth_provider_disabled")

  try {
    const session = await createSessionFromSupabaseAuthUser(event, user, provider)
    writeSession(event, session)
    await recordOAuthTelemetry(event, session, provider, isSupabaseEmailVerified(user))
    return getOAuthSuccessRedirect(event, session)
  }
  catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number(error.statusCode)
      : 500

    return getOAuthErrorRedirect(event, statusCode === 403
      ? "account_inactive"
      : "oauth_failed")
  }
  finally {
    try {
      const signOutResult = await client.auth.signOut({ scope: "local" })
      if (signOutResult.error)
        console.warn("[auth] Supabase OAuth session cookies could not be cleared after callback.", signOutResult.error)
    }
    catch (error) {
      console.warn("[auth] Supabase OAuth session cleanup failed after callback.", error)
    }
  }
}

export async function verifyCredentials(event: H3Event, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (isSupabaseEnabled(event)) {
    const client = createSupabaseServerClient(event)
    const result = await client?.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    if (result?.error || !result?.data.user) {
      throw createError({
        statusCode: 401,
        statusMessage: "Incorrect email or password.",
      })
    }

    return createSessionFromSupabaseAuthUser(event, result.data.user, "email")
  }

  if (areSeededReviewCredentialsEnabledForCurrentEnvironment()) {
    const seededAccount = demoAuthAccounts.find(account => account.email === normalizedEmail)
    if (seededAccount && seededAccount.password === password) {
      const session = getMockSessionBySeedUserId(seededAccount.userId)
      if (session)
        return requireActiveSessionFromWorkspace(event, session)
    }
  }

  const localSession = await verifyLocalAuthCredentials(normalizedEmail, password)
  if (localSession)
    return requireActiveSessionFromWorkspace(event, localSession)

  throw createError({
    statusCode: 401,
    statusMessage: "Incorrect email or password.",
  })
}

async function createSupabaseAccount(
  event: H3Event,
  payload: Parameters<typeof createMockAccount>[1],
  acceptedInvite: Awaited<ReturnType<typeof validateAccessInvite>>,
) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const verifiedEmail = Boolean(acceptedInvite)
  const adminClient = createSupabaseAdminClient(event)
  const result = verifiedEmail
    ? await adminClient?.auth.admin.createUser({
        email: normalizedEmail,
        password: payload.password,
        email_confirm: true,
        user_metadata: { name: payload.name },
      })
    : await createSupabaseServerClient(event)?.auth.signUp({
        email: normalizedEmail,
        password: payload.password,
        options: {
          data: { name: payload.name },
          emailRedirectTo: new URL("/auth/sign-in?confirmed=1", resolveServerAppUrl(event)).toString(),
        },
      })

  if (result?.error || !result?.data.user) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unable to create the account. Sign in or use account recovery if this email is already registered.",
    })
  }

  if (!isSupabaseEmailVerified(result.data.user))
    return null

  const fallbackSession = resolveSessionUserFromWorkspace(workspaceSeed, {
    id: result.data.user.id,
    email: normalizedEmail,
    name: payload.name,
    onboardingCompleted: false,
    role: "founder",
    subscriptionPlan: "free",
  })
  const bootstrapState = buildMemberWorkspaceState(workspaceSeed, fallbackSession.id) || buildDraftMemberWorkspaceState(fallbackSession, undefined, { verifiedEmail })
  try {
    await persistWholeMemberWorkspaceState(event, bootstrapState, acceptedInvite && payload.inviteToken
      ? {
          accessInvite: {
            acceptedAt: new Date().toISOString(),
            email: normalizedEmail,
            tokenHash: hashAccessInviteToken(payload.inviteToken),
          },
        }
      : {})
  }
  catch (error) {
    try {
      await adminClient?.auth.admin.deleteUser(result.data.user.id)
    }
    catch (cleanupError) {
      console.warn("[auth] Account provisioning failed and the Supabase Auth user could not be cleaned up.", cleanupError)
    }

    if (acceptedInvite) {
      throw createError({
        statusCode: 409,
        statusMessage: "The access invite is invalid or no longer available.",
      })
    }
    console.error("[auth] Account workspace provisioning failed.", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to finish account setup. Please try again.",
    })
  }

  const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(fallbackSession))
  writeSession(event, session)
  return session
}

export async function createMockAccount(event: H3Event, payload: { email: string, inviteToken?: string, name: string, password: string }) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const existing = getSessionForEmail(normalizedEmail)
  if (existing)
    throw createError({ statusCode: 400, statusMessage: "Unable to create the account. Sign in or use account recovery if this email is already registered." })

  if (await findLocalAuthSessionByEmail(normalizedEmail))
    throw createError({ statusCode: 400, statusMessage: "Unable to create the account. Sign in or use account recovery if this email is already registered." })

  const acceptedInvite = payload.inviteToken
    ? await validateAccessInvite(event, payload.inviteToken, normalizedEmail)
    : null
  if (payload.inviteToken && !acceptedInvite) {
    throw createError({
      statusCode: 403,
      statusMessage: "The access invite is invalid or no longer available.",
    })
  }
  const verifiedEmail = Boolean(acceptedInvite)

  if (isSupabaseEnabled(event))
    return createSupabaseAccount(event, payload, acceptedInvite)

  const session = await createLocalAuthAccount(payload)
  if (!session)
    throw createError({ statusCode: 400, statusMessage: "Unable to create the account. Sign in or use account recovery if this email is already registered." })

  try {
    await persistWholeMemberWorkspaceState(event, buildDraftMemberWorkspaceState(session, undefined, { verifiedEmail }))
    if (payload.inviteToken && !await markLocalAccessInviteAccepted(payload.inviteToken, normalizedEmail)) {
      throw createError({
        statusCode: 409,
        statusMessage: "The access invite is invalid or no longer available.",
      })
    }
  }
  catch (error) {
    try {
      await deleteLocalAuthAccount(session.id)
      await deleteLocalMemberWorkspaceState(session.id)
    }
    catch (cleanupError) {
      console.warn("[auth] Account provisioning failed and local account state could not be cleaned up.", cleanupError)
    }
    throw error
  }

  const { session: authoritativeSession } = await loadMemberWorkspaceState(event, buildIdentityInput(session))

  writeSession(event, authoritativeSession)

  return authoritativeSession
}

export async function completeOnboarding(event: H3Event, currentSession: SessionUser) {
  const current = await loadMemberWorkspaceState(event, buildIdentityInput(currentSession))
  const memberRole = current.state.profile.hasIdea ? "founder" : "collaborator"
  const role = ["admin", "investor_admin"].includes(current.state.user.role)
    ? current.state.user.role
    : memberRole
  const updatedSession: SessionUser = {
    ...currentSession,
    name: current.state.profile.displayName.trim() || currentSession.name,
    onboardingCompleted: true,
    role,
    subscriptionPlan: current.state.subscription.plan,
  }

  if (isSupabaseEnabled(event)) {
    await persistWholeMemberWorkspaceState(event, {
      ...current.state,
      user: {
        ...current.state.user,
        onboardingCompleted: true,
        role,
      },
    })
    const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(updatedSession))
    writeSession(event, session)
    return session
  }

  await updateLocalAuthOnboarding(updatedSession)
  await persistWholeMemberWorkspaceState(event, {
    ...current.state,
    user: {
      ...current.state.user,
      onboardingCompleted: true,
      role,
    },
  })
  const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(updatedSession))
  writeSession(event, session)
  return session
}
