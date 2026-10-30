import type { H3Event } from "h3"
import type { ContractLegalReview, ContractVersion } from "../../shared/types/domain"
import { createError } from "h3"
import { getEffectiveContractLegalReviewStatus } from "../../shared/utils/legal-reviews"
import { getContractById, getCurrentContractVersion } from "../../shared/utils/workspace"
import { contractLegalReviewTokenMatchesReview, verifyContractLegalReviewToken } from "./contract-legal-review-tokens"
import { getContractLegalReview, updateContractLegalReview } from "./contract-legal-reviews"
import { loadMemberWorkspaceState } from "./member-workspace"

export function projectContractLegalReviewForReviewer(review: ContractLegalReview) {
  return {
    createdAt: review.createdAt,
    expiresAt: review.expiresAt,
    message: review.message,
    openedAt: review.openedAt,
    respondedAt: review.respondedAt,
    respondedByName: review.respondedByName,
    reviewerName: review.reviewerName,
    reviewerOrganization: review.reviewerOrganization,
    reviewerResponse: review.reviewerResponse,
    reviewerType: review.reviewerType,
    scope: review.scope,
    status: review.status,
    updatedAt: review.updatedAt,
  }
}

export function projectContractVersionForReviewer(version: ContractVersion) {
  return {
    compensation: version.compensation,
    confidentiality: version.confidentiality,
    createdAt: version.createdAt,
    decisionMaking: version.decisionMaking,
    disputeResolution: version.disputeResolution,
    equity: version.equity,
    ipAssignment: version.ipAssignment,
    notes: version.notes,
    parties: version.parties,
    roleTitle: version.roleTitle,
    scope: version.scope,
    termination: version.termination,
    timeCommitment: version.timeCommitment,
    versionNumber: version.versionNumber,
    vesting: version.vesting,
  }
}

export async function loadContractLegalReviewAccess(event: H3Event, token: string) {
  const verified = verifyContractLegalReviewToken(token)
  if (!verified.ok)
    throw createError({ statusCode: verified.statusCode, statusMessage: verified.reason })

  const review = await getContractLegalReview(event, verified.payload.reviewId)
  if (!review || !contractLegalReviewTokenMatchesReview(verified.payload, review))
    throw createError({ statusCode: 404, statusMessage: "This legal review link is invalid." })

  const workspace = await loadMemberWorkspaceState(event, {
    email: "agreement-review@cofoundry.invalid",
    id: review.requestedByUserId,
    name: "Agreement participant",
    onboardingCompleted: true,
    role: "founder",
    subscriptionPlan: "free",
  }, { allowUserBootstrap: false })
  const contract = getContractById(workspace.seed, review.contractId)
  const currentVersion = contract
    ? getCurrentContractVersion(workspace.seed, contract)
    : null
  const requestedVersion = workspace.seed.contractVersions.find(version => version.id === review.contractVersionId)

  if (!contract || !currentVersion || !requestedVersion)
    throw createError({ statusCode: 404, statusMessage: "The agreement for this review is unavailable." })

  const effectiveStatus = getEffectiveContractLegalReviewStatus(review, currentVersion.id)
  if (effectiveStatus === "superseded" || effectiveStatus === "expired") {
    if (review.status !== effectiveStatus) {
      await updateContractLegalReview(event, review, {
        status: effectiveStatus,
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined)
    }
    throw createError({
      statusCode: 410,
      statusMessage: effectiveStatus === "expired"
        ? "This legal review link has expired. Ask the agreement participant for a new invite."
        : "This agreement version has been superseded. Ask the agreement participant for a new review invite.",
    })
  }

  if (effectiveStatus === "canceled")
    throw createError({ statusCode: 410, statusMessage: "This legal review request was canceled." })

  return {
    contract,
    review: { ...review, status: effectiveStatus },
    version: requestedVersion,
    workspace,
  }
}
