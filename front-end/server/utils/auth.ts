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
import { createSupabaseServerClient, isSupabaseEnabled } from "./supabase"

interface RegisteredAccount extends AuthAccount {
  name: string
}

const registeredAccounts = new Map<string, RegisteredAccount>()
const registeredSessions = new Map<string, SessionUser>()

function getSessionSignatureSecret() {
  return process.env.NUXT_SESSION_SIGNING_SECRET || process.env.SESSION_SIGNING_SECRET || "cofoundry-mock-session-signing-secret"
}

function createSessionSignature(session: Pick<SessionUser, "id" | "email">) {
  return createHmac("sha256", getSessionSignatureSecret())
    .update(`${session.id}:${session.email.toLowerCase()}`)
    .digest("base64url")
}

function verifySessionSignature(session: Pick<SessionUser, "id" | "email">, signature?: string | null) {
  if (!signature)
    return false

  const expected = createSessionSignature(session)
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)

  if (left.length !== right.length)
    return false

  return timingSafeEqual(left, right)
}

function getAuthoritativeSessionByUserId(userId: string) {
  return registeredSessions.get(userId) || buildSessionUser(workspaceSeed, userId)
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

export function assertAccountAccessEnabled() {
  if (areAccountsEnabledForCurrentEnvironment())
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

  const authoritativeSession = getAuthoritativeSessionByUserId(decodedSession.id)
  if (!authoritativeSession)
    return null

  if (authoritativeSession.email !== decodedSession.email)
    return null

  return authoritativeSession
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
  return getAuthoritativeSessionByUserId(userId)
}

export function getSessionForEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  const seededAccount = workspaceSeed.authAccounts.find(account => account.email === normalizedEmail)
  if (seededAccount)
    return getMockSessionByUserId(seededAccount.userId)

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

    if (result?.error)
      throw createError({ statusCode: 401, statusMessage: result.error.message })
  }

  const seededAccount = workspaceSeed.authAccounts.find(account => account.email === normalizedEmail)
  if (seededAccount && seededAccount.password === password)
    return seededAccount.userId

  const registeredAccount = registeredAccounts.get(normalizedEmail)
  if (registeredAccount && registeredAccount.password === password)
    return registeredAccount.userId

  throw createError({
    statusCode: 401,
    statusMessage: "Incorrect email or password.",
  })
}

export async function createMockAccount(event: H3Event, payload: { name: string, email: string, password: string }) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const existing = getSessionForEmail(normalizedEmail)
  if (existing)
    throw createError({ statusCode: 409, statusMessage: "An account with that email already exists." })

  if (isSupabaseEnabled(event)) {
    const client = createSupabaseServerClient(event)
    const result = await client?.auth.signUp({
      email: normalizedEmail,
      password: payload.password,
    })

    if (result?.error)
      throw createError({ statusCode: 400, statusMessage: result.error.message })
  }

  const userId = `user_${crypto.randomUUID().replaceAll("-", "")}`
  const session: SessionUser = {
    id: userId,
    email: normalizedEmail,
    name: payload.name,
    role: "founder",
    onboardingCompleted: false,
    subscriptionPlan: "free",
  }

  registeredAccounts.set(normalizedEmail, {
    email: normalizedEmail,
    password: payload.password,
    providers: ["email"],
    userId,
    name: payload.name,
  })
  registeredSessions.set(userId, session)
  writeSession(event, session)

  return session
}

export function completeOnboarding(event: H3Event, nextSession: SessionUser) {
  const updatedSession = {
    ...nextSession,
    onboardingCompleted: true,
  }

  registeredSessions.set(updatedSession.id, updatedSession)
  writeSession(event, updatedSession)
  return updatedSession
}
