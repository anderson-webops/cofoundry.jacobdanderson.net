import type { ContractLegalReview } from "../../shared/types/domain"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { projectContractLegalReviewForReviewer, projectContractVersionForReviewer } from "../../server/utils/contract-legal-review-access"
import {
  contractLegalReviewRateLimitKey,
  contractLegalReviewTokenMatchesReview,
  createContractLegalReviewToken,
  verifyContractLegalReviewToken,
} from "../../server/utils/contract-legal-review-tokens"
import { workspaceSeed } from "../../shared/data/seed"
import {
  formatContractLegalReviewScope,
  formatContractLegalReviewStatus,
  getEffectiveContractLegalReviewStatus,
  hasBlockingContractLegalReview,
  isBlockingContractLegalReview,
} from "../../shared/utils/legal-reviews"

const reviewNow = Date.UTC(2026, 7, 8, 12)

function reviewFixture(overrides: Partial<ContractLegalReview> = {}): ContractLegalReview {
  return {
    canceledAt: null,
    contractId: "contract_ledgerloop",
    contractVersionId: "contract_version_ledgerloop_1",
    createdAt: new Date(reviewNow).toISOString(),
    expiresAt: new Date(reviewNow + 14 * 24 * 60 * 60 * 1000).toISOString(),
    id: "review_ledgerloop_counsel",
    message: "Review the agreement with particular attention to founder equity, vesting, and intellectual-property assignment.",
    openedAt: null,
    requestedByUserId: "user_olivia",
    respondedAt: null,
    reviewerEmail: "counsel@example.com",
    reviewerName: "Alex Counsel",
    reviewerOrganization: "Example Startup Law",
    reviewerResponse: null,
    respondedByName: null,
    reviewerType: "outside_counsel",
    scope: ["equity_vesting", "ip_confidentiality"],
    status: "requested",
    updatedAt: new Date(reviewNow).toISOString(),
    ...overrides,
  }
}

describe("contract legal reviews", () => {
  beforeEach(() => {
    process.env.SESSION_SIGNING_SECRET = "cofoundry-legal-review-test-secret-that-is-long-enough"
  })

  afterEach(() => {
    delete process.env.SESSION_SIGNING_SECRET
  })

  it("derives signing holds only for unresolved reviews on the current agreement version", () => {
    const requested = reviewFixture()
    const opened = reviewFixture({ id: "review_opened", status: "opened" })
    const changesRequested = reviewFixture({ id: "review_changes", status: "changes_requested" })
    const approved = reviewFixture({ id: "review_approved", status: "approved" })

    expect(isBlockingContractLegalReview(requested, requested.contractVersionId, reviewNow)).toBe(true)
    expect(isBlockingContractLegalReview(opened, opened.contractVersionId, reviewNow)).toBe(true)
    expect(isBlockingContractLegalReview(changesRequested, changesRequested.contractVersionId, reviewNow)).toBe(true)
    expect(isBlockingContractLegalReview(approved, approved.contractVersionId, reviewNow)).toBe(false)
    expect(hasBlockingContractLegalReview([approved, changesRequested], changesRequested.contractVersionId, reviewNow)).toBe(true)
    expect(getEffectiveContractLegalReviewStatus(requested, "contract_version_ledgerloop_2", reviewNow)).toBe("superseded")
    expect(getEffectiveContractLegalReviewStatus(
      requested,
      requested.contractVersionId,
      new Date(requested.expiresAt).getTime(),
    )).toBe("expired")
  })

  it("signs a bearer claim and rejects tampering, expiry, or record mismatch", () => {
    const review = reviewFixture()
    const token = createContractLegalReviewToken(review)
    const secondToken = createContractLegalReviewToken(reviewFixture({ id: "review_second" }))

    expect(token).toBeTruthy()
    expect(secondToken).toBeTruthy()
    expect(contractLegalReviewRateLimitKey(token!)).not.toBe(contractLegalReviewRateLimitKey(secondToken!))
    expect(contractLegalReviewRateLimitKey(token!)).not.toContain(token!)
    const verified = verifyContractLegalReviewToken(token!, reviewNow)
    expect(verified.ok).toBe(true)
    if (!verified.ok)
      throw new Error("Expected the legal-review token to verify.")

    expect(contractLegalReviewTokenMatchesReview(verified.payload, review)).toBe(true)
    expect(contractLegalReviewTokenMatchesReview(verified.payload, {
      ...review,
      reviewerEmail: "different@example.com",
    })).toBe(false)

    const finalCharacter = token!.at(-1)
    const tamperedToken = `${token!.slice(0, -1)}${finalCharacter === "a" ? "b" : "a"}`
    expect(verifyContractLegalReviewToken(tamperedToken, reviewNow)).toMatchObject({
      ok: false,
      statusCode: 404,
    })
    expect(verifyContractLegalReviewToken(token!, new Date(review.expiresAt).getTime())).toMatchObject({
      ok: false,
      statusCode: 410,
    })
  })

  it("uses clear reviewer-facing status and scope labels", () => {
    expect(formatContractLegalReviewStatus("changes_requested")).toBe("Changes requested")
    expect(formatContractLegalReviewStatus("approved")).toBe("Reviewer approved requested scope")
    expect(formatContractLegalReviewScope("ip_confidentiality")).toBe("IP and confidentiality")
  })

  it("projects only the agreement terms and review fields needed by the bearer page", () => {
    const review = reviewFixture({ respondedByName: "Alex Counsel" })
    const version = workspaceSeed.contractVersions.find(item => item.id === review.contractVersionId)!
    const projectedReview = projectContractLegalReviewForReviewer(review)
    const projectedVersion = projectContractVersionForReviewer(version)

    expect(projectedReview).toMatchObject({
      respondedByName: "Alex Counsel",
      reviewerName: review.reviewerName,
      status: review.status,
    })
    expect(projectedReview).not.toHaveProperty("reviewerEmail")
    expect(projectedReview).not.toHaveProperty("requestedByUserId")
    expect(projectedVersion).not.toHaveProperty("contractId")
    expect(projectedVersion).not.toHaveProperty("generatedFromProposalVersionId")
    expect(projectedVersion).not.toHaveProperty("id")
  })
})
