import type { SessionUser } from "../types/domain"

export const sessionCookieName = "cofoundry_session"
export const sessionSignatureCookieName = "cofoundry_session_sig"

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
  if (!rawValue)
    return null

  try {
    return JSON.parse(decodeBase64Url(rawValue)) as SessionUser
  }
  catch {
    return null
  }
}
