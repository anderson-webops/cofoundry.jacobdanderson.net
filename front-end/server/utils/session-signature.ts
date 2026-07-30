import { Buffer } from "node:buffer"
import { createHmac, timingSafeEqual } from "node:crypto"

export const sessionCookieMaxAgeSeconds = 12 * 60 * 60
const allowedClockSkewSeconds = 5 * 60
const signatureSeparator = "."
const signatureContext = "cofoundry:session:v1"

function createDigest(encodedSession: string, issuedAtSeconds: number, secret: string) {
  return createHmac("sha256", secret)
    .update(`${signatureContext}\0${issuedAtSeconds}${signatureSeparator}${encodedSession}`)
    .digest("base64url")
}

export function createTimedSessionSignature(
  encodedSession: string,
  secret: string,
  now = Date.now(),
) {
  const issuedAtSeconds = Math.floor(now / 1000)
  return `${issuedAtSeconds}${signatureSeparator}${createDigest(encodedSession, issuedAtSeconds, secret)}`
}

export function verifyTimedSessionSignature(
  encodedSession: string,
  signature: string | null | undefined,
  secret: string,
  now = Date.now(),
) {
  if (!signature || !secret)
    return false

  const parts = signature.split(signatureSeparator)
  if (parts.length !== 2 || !/^\d+$/.test(parts[0] || ""))
    return false

  const issuedAtSeconds = Number.parseInt(parts[0]!, 10)
  const nowSeconds = Math.floor(now / 1000)
  if (
    issuedAtSeconds > nowSeconds + allowedClockSkewSeconds
    || nowSeconds - issuedAtSeconds > sessionCookieMaxAgeSeconds
  ) {
    return false
  }

  const expected = Buffer.from(createDigest(encodedSession, issuedAtSeconds, secret))
  const supplied = Buffer.from(parts[1] || "")
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}
