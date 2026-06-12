import type { H3Event } from "h3"
import type { AuthAccount, SessionUser } from "~/shared/types/domain"
import { Buffer } from "node:buffer"
import { createHmac, timingSafeEqual } from "node:crypto"
import process from "node:process"
import { workspaceSeed } from "~/shared/data/seed"
import { isLocalDevelopmentEnvironment, readPublicEnvironment } from "~/shared/utils/environment"
import { resolveProductAccessPolicy } from "~/shared/utils/product-access"
import { decodeSessionUser, encodeSessionUser, sessionCookieName, sessionSignatureCookieName } from "~/shared/utils/session"
import { signInSchema, signUpSchema } from "~/shared/utils/validation"
import { buildSessionUser } from "~/shared/utils/workspace"
import { buildDraftMemberWorkspaceState, buildMemberWorkspaceState, resolveSessionUserFromWorkspace } from "~/shared/utils/workspace-persistence"
import { markAccessInviteAccepted, validateAccessInvite } from "./access-requests"
import { createLocalAuthAccount, findLocalAuthSessionByEmail, findLocalAuthSessionById, updateLocalAuthOnboarding, verifyLocalAuthCredentials } from "./local-auth-store"
import { loadMemberWorkspaceState, persistWholeMemberWorkspaceState } from "./member-workspace"
import { createSupabaseAdminClient, createSupabaseServerClient, isSupabaseEnabled } from "./supabase"

interface RegisteredAccount extends AuthAccount {
  name: string
}

const registeredAccounts = new Map<string, RegisteredAccount>()
const registeredSessions = new Map<string, SessionUser>()
const localSessionSigningSecret = "cofoundry-local-session-signing-secret"

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

function areAccountsEnabledForCurrentEnvironment() {
  const publicEnvironment = readPublicEnvironment(process.env)
  const policy = resolveProductAccessPolicy({
    backendMode: publicEnvironment.backendMode,
    billingMode: publicEnvironment.billingMode,
    enableDemoAccess: publicEnvironment.enableDemoAccess,
  }, isLocalDevelopmentEnvironment(process.env))

  return policy.accountsEnabled
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

    const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(baseSession))
    return session.email === decodedSession.email ? session : null
  }

  const { session } = await loadMemberWorkspaceState(event, buildIdentityInput(decodedSession))
  if (session.email !== decodedSession.email)
    return null

  return session
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

    const { session } = await loadMemberWorkspaceState(event, {
      id: result.data.user.id,
      email: normalizedEmail,
      name: typeof result.data.user.user_metadata?.name === "string" ? result.data.user.user_metadata.name : normalizedEmail.split("@")[0] || "CoFoundry member",
      onboardingCompleted: false,
      role: "founder",
      subscriptionPlan: "free",
    })

    return session
  }

  const seededAccount = workspaceSeed.authAccounts.find(account => account.email === normalizedEmail)
  if (seededAccount && seededAccount.password === password) {
    const session = getMockSessionBySeedUserId(seededAccount.userId)
    if (session)
      return session
  }

  const registeredAccount = registeredAccounts.get(normalizedEmail)
  if (registeredAccount && registeredAccount.password === password) {
    const session = registeredSessions.get(registeredAccount.userId)
    if (session)
      return session
  }

  const localSession = await verifyLocalAuthCredentials(normalizedEmail, password)
  if (localSession)
    return localSession

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

  if (isSupabaseEnabled(event)) {
    const adminClient = createSupabaseAdminClient(event)
    const result = await adminClient?.auth.admin.createUser({
      email: normalizedEmail,
      password: payload.password,
      email_confirm: true,
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
    const bootstrapState = buildMemberWorkspaceState(workspaceSeed, fallbackSession.id) || buildDraftMemberWorkspaceState(fallbackSession)
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

  await persistWholeMemberWorkspaceState(event, buildDraftMemberWorkspaceState(session))
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
