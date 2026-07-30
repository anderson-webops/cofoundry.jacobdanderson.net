import type { SessionUser } from "../types/domain"

export const sessionCookieName = "cofoundry_session"
export const sessionSignatureCookieName = "cofoundry_session_sig"
const allowedRoles = new Set<SessionUser["role"]>(["admin", "collaborator", "founder", "investor_admin"])
const allowedSubscriptionPlans = new Set<SessionUser["subscriptionPlan"]>(["free", "pro", "team"])

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeSessionUser(session: SessionUser) {
  return encodeBase64Url(JSON.stringify(session))
}

export function decodeSessionUser(rawValue?: string | null): SessionUser | null {
  if (!rawValue || rawValue.length > 4096)
    return null

  try {
    const value = JSON.parse(decodeBase64Url(rawValue)) as Record<string, unknown>
    if (
      !value
      || Array.isArray(value)
      || typeof value !== "object"
      || typeof value.id !== "string"
      || value.id.length < 1
      || value.id.length > 160
      || typeof value.email !== "string"
      || value.email.length < 3
      || value.email.length > 254
      || typeof value.name !== "string"
      || value.name.length < 1
      || value.name.length > 120
      || typeof value.onboardingCompleted !== "boolean"
      || typeof value.role !== "string"
      || !allowedRoles.has(value.role as SessionUser["role"])
      || typeof value.subscriptionPlan !== "string"
      || !allowedSubscriptionPlans.has(value.subscriptionPlan as SessionUser["subscriptionPlan"])
    ) {
      return null
    }

    return {
      email: value.email,
      id: value.id,
      name: value.name,
      onboardingCompleted: value.onboardingCompleted,
      role: value.role as SessionUser["role"],
      subscriptionPlan: value.subscriptionPlan as SessionUser["subscriptionPlan"],
    }
  }
  catch {
    return null
  }
}
