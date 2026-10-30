import type { H3Event } from "h3"
import type { ContractLegalReview } from "../../shared/types/domain"
import { Buffer } from "node:buffer"
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import process from "node:process"
import { isLocalDevelopmentEnvironment } from "../../shared/utils/environment"
import { resolveServerAppUrl } from "./app-url"

interface ContractLegalReviewTokenPayload {
  contractId: string
  contractVersionId: string
  exp: number
  reviewId: string
  reviewerEmailDigest: string
  v: 1
}

const tokenSeparator = "."
const tokenContext = "cofoundry:contract-legal-review:v1"
const localSigningSecret = randomBytes(32).toString("base64url")

function signingSecret() {
  return process.env.NUXT_SESSION_SIGNING_SECRET
    || process.env.SESSION_SIGNING_SECRET
    || (isLocalDevelopmentEnvironment(process.env)
      ? localSigningSecret
      : "")
}

function digestEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("base64url")
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${tokenContext}\0${encodedPayload}`)
    .digest("base64url")
}

function signaturesMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function parsePayload(encodedPayload: string): ContractLegalReviewTokenPayload | null {
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<ContractLegalReviewTokenPayload>
    if (
      payload.v !== 1
      || !payload.reviewId?.trim()
      || !payload.contractId?.trim()
      || !payload.contractVersionId?.trim()
      || !payload.reviewerEmailDigest?.trim()
      || typeof payload.exp !== "number"
    ) {
      return null
    }

    return payload as ContractLegalReviewTokenPayload
  }
  catch {
    return null
  }
}

export function createContractLegalReviewToken(review: ContractLegalReview) {
  const secret = signingSecret()
  if (!secret)
    return null

  const payload: ContractLegalReviewTokenPayload = {
    contractId: review.contractId,
    contractVersionId: review.contractVersionId,
    exp: new Date(review.expiresAt).getTime(),
    reviewId: review.id,
    reviewerEmailDigest: digestEmail(review.reviewerEmail),
    v: 1,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  return `${encodedPayload}${tokenSeparator}${sign(encodedPayload, secret)}`
}

export function contractLegalReviewRateLimitKey(token: string) {
  return createHash("sha256")
    .update(`${tokenContext}\0rate-limit\0${token.trim()}`)
    .digest("base64url")
}

export function verifyContractLegalReviewToken(token: string, now = Date.now()) {
  const secret = signingSecret()
  if (!secret)
    return { ok: false as const, reason: "Legal review signing is not configured.", statusCode: 503 }

  const [encodedPayload, signature, ...extraParts] = token.trim().split(tokenSeparator)
  if (!encodedPayload || !signature || extraParts.length)
    return { ok: false as const, reason: "This legal review link is invalid.", statusCode: 404 }

  const expectedSignature = sign(encodedPayload, secret)
  if (!signaturesMatch(signature, expectedSignature))
    return { ok: false as const, reason: "This legal review link is invalid.", statusCode: 404 }

  const payload = parsePayload(encodedPayload)
  if (!payload)
    return { ok: false as const, reason: "This legal review link is invalid.", statusCode: 404 }
  if (payload.exp <= now)
    return { ok: false as const, reason: "This legal review link has expired.", statusCode: 410 }

  return { ok: true as const, payload }
}

export function contractLegalReviewTokenMatchesReview(
  payload: ContractLegalReviewTokenPayload,
  review: ContractLegalReview,
) {
  return payload.reviewId === review.id
    && payload.contractId === review.contractId
    && payload.contractVersionId === review.contractVersionId
    && payload.exp === new Date(review.expiresAt).getTime()
    && payload.reviewerEmailDigest === digestEmail(review.reviewerEmail)
}

export function createContractLegalReviewUrl(event: H3Event, review: ContractLegalReview) {
  const token = createContractLegalReviewToken(review)
  if (!token)
    return null

  return new URL(`/legal-review/${encodeURIComponent(token)}`, resolveServerAppUrl(event)).toString()
}
