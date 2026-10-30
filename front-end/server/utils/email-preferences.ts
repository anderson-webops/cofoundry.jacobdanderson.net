import type { H3Event } from "h3"
import type { NotificationPreferences } from "../../shared/types/domain"
import { Buffer } from "node:buffer"
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import process from "node:process"
import { createError } from "h3"
import { isLocalDevelopmentEnvironment } from "../../shared/utils/environment"
import { normalizeNotificationPreferences } from "../../shared/utils/notification-preferences"
import { loadMemberWorkspaceState, persistWholeMemberWorkspaceState } from "./member-workspace"

export type EmailPreferenceCategory = "digest" | "workflow"

interface EmailPreferenceTokenPayload {
  action: "disable"
  category: EmailPreferenceCategory
  email: string
  exp: number
  userId: string
  v: 1
}

export interface CreateEmailPreferenceTokenInput {
  category: EmailPreferenceCategory
  email: string
  userId: string
}

export interface CreateEmailPreferenceTokenOptions {
  expiresInDays?: number
  now?: number
}

interface ApplyEmailPreferenceResult {
  category: EmailPreferenceCategory
  email: string
  notificationPreferences: NotificationPreferences
  userId: string
}

const defaultPreferenceTokenDays = 180
const emailPreferenceLocalSigningSecret = randomBytes(32).toString("base64url")
const tokenSeparator = "."
const trailingSlashPattern = /\/+$/
const tokenSigningContext = "cofoundry:email-preference:v1"

function stripTrailingSlash(value?: string) {
  return value?.replace(trailingSlashPattern, "") || ""
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function readEmailPreferenceSigningSecret() {
  return process.env.NUXT_SESSION_SIGNING_SECRET
    || process.env.SESSION_SIGNING_SECRET
    || (isLocalDevelopmentEnvironment(process.env)
      ? emailPreferenceLocalSigningSecret
      : "")
}

function signEncodedPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${tokenSigningContext}\0${encodedPayload}`)
    .digest("base64url")
}

function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length)
    return false

  return timingSafeEqual(leftBuffer, rightBuffer)
}

function encodePayload(payload: EmailPreferenceTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

function parsePayload(encodedPayload: string): EmailPreferenceTokenPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<EmailPreferenceTokenPayload>

    if (payload.v !== 1)
      return null

    if (payload.action !== "disable")
      return null

    if (payload.category !== "digest" && payload.category !== "workflow")
      return null

    if (!payload.userId?.trim() || !payload.email?.trim() || typeof payload.exp !== "number")
      return null

    return {
      action: payload.action,
      category: payload.category,
      email: normalizeEmail(payload.email),
      exp: payload.exp,
      userId: payload.userId.trim(),
      v: 1,
    }
  }
  catch {
    return null
  }
}

function categoryPreferenceKey(category: EmailPreferenceCategory) {
  return category === "digest"
    ? "unreadDigestEmail"
    : "workflowEmail"
}

function displayNameForEmail(email: string) {
  return email.split("@")[0] || "CoFoundry member"
}

function verificationError(reason: string, statusCode = 400) {
  return createError({
    statusCode,
    statusMessage: reason,
  })
}

export function createEmailPreferenceToken(input: CreateEmailPreferenceTokenInput, options: CreateEmailPreferenceTokenOptions = {}) {
  const secret = readEmailPreferenceSigningSecret()
  if (!secret)
    return null

  const now = options.now ?? Date.now()
  const expiresInDays = options.expiresInDays ?? defaultPreferenceTokenDays
  const payload: EmailPreferenceTokenPayload = {
    action: "disable",
    category: input.category,
    email: normalizeEmail(input.email),
    exp: now + expiresInDays * 24 * 60 * 60 * 1000,
    userId: input.userId,
    v: 1,
  }
  const encodedPayload = encodePayload(payload)
  const signature = signEncodedPayload(encodedPayload, secret)

  return `${encodedPayload}${tokenSeparator}${signature}`
}

export function verifyEmailPreferenceToken(token: string, options: { now?: number } = {}) {
  const secret = readEmailPreferenceSigningSecret()
  if (!secret)
    return { ok: false as const, reason: "Email preference signing is not configured." }

  const [encodedPayload, signature, ...extraParts] = token.trim().split(tokenSeparator)
  if (!encodedPayload || !signature || extraParts.length)
    return { ok: false as const, reason: "Email preference link is invalid." }

  const expectedSignature = signEncodedPayload(encodedPayload, secret)
  if (!signaturesMatch(signature, expectedSignature))
    return { ok: false as const, reason: "Email preference link is invalid." }

  const payload = parsePayload(encodedPayload)
  if (!payload)
    return { ok: false as const, reason: "Email preference link is invalid." }

  if (payload.exp < (options.now ?? Date.now()))
    return { ok: false as const, reason: "Email preference link has expired.", statusCode: 410 }

  return { ok: true as const, payload }
}

export function createEmailPreferenceManagementUrl(
  input: CreateEmailPreferenceTokenInput,
  options: CreateEmailPreferenceTokenOptions & { appUrl?: string, fallbackUrl?: string } = {},
) {
  const token = createEmailPreferenceToken(input, options)
  if (!token)
    return options.fallbackUrl || "/app/settings"

  const query = new URLSearchParams({ token }).toString()
  const path = `/email/preferences?${query}`
  const appUrl = stripTrailingSlash(options.appUrl)

  return appUrl
    ? `${appUrl}${path}`
    : path
}

export async function applyEmailPreferenceToken(event: H3Event, token: string): Promise<ApplyEmailPreferenceResult> {
  const verified = verifyEmailPreferenceToken(token)
  if (!verified.ok) {
    throw verificationError(verified.reason, "statusCode" in verified
      ? verified.statusCode
      : 400)
  }

  const workspace = await loadMemberWorkspaceState(
    event,
    {
      email: verified.payload.email,
      id: verified.payload.userId,
      name: displayNameForEmail(verified.payload.email),
      onboardingCompleted: true,
      role: "founder",
      subscriptionPlan: "free",
    },
    {
      allowUserBootstrap: false,
    },
  )

  if (workspace.state.user.id !== verified.payload.userId || normalizeEmail(workspace.state.user.email) !== verified.payload.email) {
    throw verificationError("Email preference link does not match an active member record.", 403)
  }

  const preferenceKey = categoryPreferenceKey(verified.payload.category)
  const notificationPreferences = {
    ...normalizeNotificationPreferences(workspace.state.user.notificationPreferences),
    [preferenceKey]: false,
  }

  await persistWholeMemberWorkspaceState(event, {
    ...workspace.state,
    user: {
      ...workspace.state.user,
      notificationPreferences,
    },
  })

  return {
    category: verified.payload.category,
    email: workspace.state.user.email,
    notificationPreferences,
    userId: workspace.state.user.id,
  }
}
