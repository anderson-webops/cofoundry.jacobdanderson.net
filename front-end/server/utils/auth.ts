import type { User as SupabaseAuthUser } from "@supabase/supabase-js"
import type { H3Event } from "h3"
import type { AuthAccount, AuthProvider, SessionUser } from "~/shared/types/domain"
import type { SupportedOAuthProvider } from "~/shared/utils/oauth-providers"
import { Buffer } from "node:buffer"
import { createHmac, timingSafeEqual } from "node:crypto"
import process from "node:process"
import { workspaceSeed } from "~/shared/data/seed"
import { isLocalDevelopmentEnvironment, readPublicEnvironment } from "~/shared/utils/environment"
import { isOAuthProviderEnabled, normalizeOAuthProvider } from "~/shared/utils/oauth-providers"
import { resolveProductAccessPolicy, areSeededReviewCredentialsEnabled as resolveSeededReviewCredentialsEnabled } from "~/shared/utils/product-access"
import { decodeSessionUser, encodeSessionUser, sessionCookieName, sessionSignatureCookieName } from "~/shared/utils/session"
import { resolveActiveSessionFromSeed } from "~/shared/utils/session-authority"
import { signInSchema, signUpSchema } from "~/shared/utils/validation"
import { buildSessionUser } from "~/shared/utils/workspace"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceState, resolveSessionUserFromWorkspace } from "~/shared/utils/workspace-persistence"
import { markAccessInviteAccepted, validateAccessInvite } from "./access-requests"
import { resolveServerAppUrl } from "./app-url"
import { createLocalAuthAccount, findLocalAuthSessionByEmail, findLocalAuthSessionById, updateLocalAuthOnboarding, verifyLocalAuthCredentials } from "./local-auth-store"
import { loadMemberWorkspaceState, persistWholeMemberWorkspaceState } from "./member-workspace"
import { recordOperationalEvent } from "./operations-persistence"
import { createSupabaseAdminClient, createSupabaseOAuthClient, createSupabaseServerClient, isSupabaseEnabled } from "./supabase"

interface RegisteredAccount extends AuthAccount {
  name: string
}

interface SupabaseSessionUserRow {
  email: string
  id: string
  onboarding_completed: boolean
  role: SessionUser["role"]
  suspended_at: string | null
  verified_email: boolean
}

const registeredAccounts = new Map<string, RegisteredAccount>()
const registeredSessions = new Map<string, SessionUser>()
const localSessionSigningSecret = "cofoundry-local-session-signing-secret"

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

function inferSupabaseOAuthProvider(user: SupabaseAuthUser, fallbackProvider?: SupportedOAuthProvider | null) {
  const candidates = [
    fallbackProvider,
    user.app_metadata?.provider,
    ...(Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : []),
    ...(Array.isArray(user.identities) ? user.identities.map(identity => identity.provider) : []),
  ]

  for (const candidate of candidates) {
    const provider = normalizeOAuthProvider(candidate)
    if (provider)
      return provider
  }

  return null
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

  return isLocalDevelopmentEnvironment(process.env) ? localSessionSigningSecret : ""
}

function createSessionSignature(session: Pick<SessionUser, "id" | "email">, secret = getSessionSignatureSecretForWrite()) {
  return createHmac("sha256", secret)
    .update(`${session.id}:${session.email.toLowerCase()}`)
    .digest("base64url")
}

function verifySessionSignature(session: Pick<SessionUser, "id" | "email">, signature?: string | null) {
  if (!signature)
    return false

  const secret = getSessionSignatureSecretForVerify()
  if (!secret)
    return false

  const expected = createSessionSignature(session, secret)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)

  if (left.length !== right.length)
    return false

  return timingSafeEqual(left, right)
}

function getMockSessionBySeedUserId(userId: string) {
  return registeredSessions.get(userId) || buildSessionUser(workspaceSeed, userId)
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
  const { seed, session, state } = await loadMemberWorkspaceState(event, {
    id: user.id,
    email: normalizedEmail,
    name: getSupabaseOAuthDisplayName(user, normalizedEmail),
    onboardingCompleted: false,
    role: "founder",
    subscriptionPlan: "free",
    verifiedEmail,
  })
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
  const decodedSession = decodeSessionUser(getCookie(event, sessionCookieName))
  const signature = getCookie(event, sessionSignatureCookieName)

  if (!decodedSession || !verifySessionSignature(decodedSession, signature))
    return null

  return decodedSession
}

export async function readAuthoritativeSession(event: H3Event) {
  const decodedSession = readSession(event)
  if (!decodedSession)
    return null

  if (!isSupabaseEnabled(event)) {
    const baseSession = getMockSessionBySeedUserId(decodedSession.id) || await findLocalAuthSessionById(decodedSession.id)
    if (!baseSession || baseSession.email !== decodedSession.email)
      return null

    const { seed, session } = await loadMemberWorkspaceState(event, buildIdentityInput(baseSession))
    const activeSession = resolveActiveSessionFromSeed(seed, session)
    return activeSession?.email === decodedSession.email ? activeSession : null
  }

  const persistedUser = await readSupabaseSessionUser(event, decodedSession)
  if (!persistedUser || persistedUser.email !== decodedSession.email || persistedUser.suspended_at)
    return null

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

  return activeSession?.email === decodedSession.email ? activeSession : null
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
  const signature = createSessionSignature(session)

  setCookie(event, sessionCookieName, encodeSessionUser(session), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  })

  setCookie(event, sessionSignatureCookieName, signature, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, sessionCookieName, { path: "/" })
  deleteCookie(event, sessionSignatureCookieName, { path: "/" })
}

export function getMockSessionByUserId(userId: string) {
  return getMockSessionBySeedUserId(userId)
}

export function getSessionForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  const seededAccount = workspaceSeed.authAccounts.find(account => account.email === normalizedEmail)
  if (seededAccount)
    return getMockSessionBySeedUserId(seededAccount.userId)

  const registeredAccount = registeredAccounts.get(normalizedEmail)
  if (registeredAccount)
    return registeredSessions.get(registeredAccount.userId) || null

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
      statusMessage: result.error?.message || "Unable to start OAuth sign-in.",
    })
  }

  return result.data.url
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
  const provider = user ? inferSupabaseOAuthProvider(user, providerHint) : null

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

    return getOAuthErrorRedirect(event, statusCode === 403 ? "account_inactive" : "oauth_failed")
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
        statusMessage: result?.error?.message || "Incorrect email or password.",
      })
    }

    return createSessionFromSupabaseAuthUser(event, result.data.user, "email")
  }

  if (areSeededReviewCredentialsEnabledForCurrentEnvironment()) {
    const seededAccount = workspaceSeed.authAccounts.find(account => account.email === normalizedEmail)
    if (seededAccount && seededAccount.password === password) {
      const session = getMockSessionBySeedUserId(seededAccount.userId)
      if (session)
        return requireActiveSessionFromWorkspace(event, session)
    }

    const registeredAccount = registeredAccounts.get(normalizedEmail)
    if (registeredAccount && registeredAccount.password === password) {
      const session = registeredSessions.get(registeredAccount.userId)
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

export async function createMockAccount(event: H3Event, payload: { email: string, inviteToken?: string, name: string, password: string }) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const existing = getSessionForEmail(normalizedEmail)
  if (existing)
    throw createError({ statusCode: 409, statusMessage: "An account with that email already exists." })

  if (await findLocalAuthSessionByEmail(normalizedEmail))
    throw createError({ statusCode: 409, statusMessage: "An account with that email already exists." })

  const acceptedInvite = payload.inviteToken
    ? await validateAccessInvite(event, payload.inviteToken, normalizedEmail)
    : null
  const verifiedEmail = Boolean(acceptedInvite)

  if (isSupabaseEnabled(event)) {
    const adminClient = createSupabaseAdminClient(event)
    const result = await adminClient?.auth.admin.createUser({
      email: normalizedEmail,
      password: payload.password,
      email_confirm: verifiedEmail,
      user_metadata: { name: payload.name },
    })

    if (result?.error || !result?.data.user) {
      throw createError({
        statusCode: 400,
        statusMessage: result?.error?.message || "Unable to create the account.",
      })
    }

    const fallbackSession = resolveSessionUserFromWorkspace(workspaceSeed, {
      id: result.data.user.id,
      email: normalizedEmail,
      name: payload.name,
      onboardingCompleted: false,
      role: "founder",
      subscriptionPlan: "free",
    })
    const bootstrapState = buildMemberWorkspaceState(workspaceSeed, fallbackSession.id) || buildDraftMemberWorkspaceState(fallbackSession, undefined, { verifiedEmail })
    await persistWholeMemberWorkspaceState(event, bootstrapState)

    const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(fallbackSession))
    if (payload.inviteToken)
      await markAccessInviteAccepted(event, payload.inviteToken)

    writeSession(event, session)
    return session
  }

  const session = await createLocalAuthAccount(payload)
  if (!session)
    throw createError({ statusCode: 409, statusMessage: "An account with that email already exists." })

  registeredAccounts.set(normalizedEmail, {
    email: normalizedEmail,
    password: payload.password,
    providers: ["email"],
    userId: session.id,
    name: payload.name,
  })
  registeredSessions.set(session.id, session)

  if (payload.inviteToken)
    await markAccessInviteAccepted(event, payload.inviteToken)

  await persistWholeMemberWorkspaceState(event, buildDraftMemberWorkspaceState(session, undefined, { verifiedEmail }))
  const { session: authoritativeSession } = await loadMemberWorkspaceState(event, buildIdentityInput(session))

  writeSession(event, authoritativeSession)

  return authoritativeSession
}

export async function completeOnboarding(event: H3Event, nextSession: SessionUser) {
  const updatedSession = {
    ...nextSession,
    onboardingCompleted: true,
  }

  if (isSupabaseEnabled(event)) {
    const current = await loadMemberWorkspaceState(event, buildIdentityInput(updatedSession))
    await persistWholeMemberWorkspaceState(event, {
      ...current.state,
      user: {
        ...current.state.user,
        onboardingCompleted: true,
      },
    })
    const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(updatedSession))
    writeSession(event, session)
    return session
  }

  registeredSessions.set(updatedSession.id, updatedSession)
  await updateLocalAuthOnboarding(updatedSession)
  const current = await loadMemberWorkspaceState(event, buildIdentityInput(updatedSession))
  await persistWholeMemberWorkspaceState(event, {
    ...current.state,
    user: {
      ...current.state.user,
      onboardingCompleted: true,
    },
  })
  const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(updatedSession))
  writeSession(event, session)
  return session
}
