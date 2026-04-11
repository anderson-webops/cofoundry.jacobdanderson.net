import type { H3Event } from "h3"
import type { AuthAccount, SessionUser } from "~/shared/types/domain"
import process from "node:process"
import { workspaceSeed } from "~/shared/data/seed"
import { decodeSessionUser, encodeSessionUser, sessionCookieName } from "~/shared/utils/session"
import { signInSchema, signUpSchema } from "~/shared/utils/validation"
import { buildSessionUser } from "~/shared/utils/workspace"
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase"

interface RegisteredAccount extends AuthAccount {
  name: string
}

const registeredAccounts = new Map<string, RegisteredAccount>()
const registeredSessions = new Map<string, SessionUser>()

export function readSession(event: H3Event) {
  return decodeSessionUser(getCookie(event, sessionCookieName))
}

export function writeSession(event: H3Event, session: SessionUser) {
  setCookie(event, sessionCookieName, encodeSessionUser(session), {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, sessionCookieName, { path: "/" })
}

export function getMockSessionByUserId(userId: string) {
  return registeredSessions.get(userId) || buildSessionUser(workspaceSeed, userId)
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

  if (isSupabaseConfigured(event)) {
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

  if (isSupabaseConfigured(event)) {
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
