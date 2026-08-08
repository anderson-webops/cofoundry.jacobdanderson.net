import type {
  ContractLegalReview,
  ContractLegalReviewerType,
  ContractLegalReviewScope,
  ContractLegalReviewStatus,
} from "../types/domain"

export const contractLegalReviewerTypeOptions: Array<{ label: string, value: ContractLegalReviewerType }> = [
  { label: "In-house or team counsel", value: "in_house_counsel" },
  { label: "Outside counsel", value: "outside_counsel" },
]

export const contractLegalReviewScopeOptions: Array<{ label: string, value: ContractLegalReviewScope }> = [
  { label: "Full agreement", value: "full_agreement" },
  { label: "Equity and vesting", value: "equity_vesting" },
  { label: "IP and confidentiality", value: "ip_confidentiality" },
  { label: "Governance and decisions", value: "governance" },
  { label: "Employment and tax flags", value: "employment_tax" },
  { label: "Formation documents", value: "formation" },
]

const blockingStatuses = new Set<ContractLegalReviewStatus>(["requested", "opened", "changes_requested"])

export function getEffectiveContractLegalReviewStatus(
  review: ContractLegalReview,
  currentVersionId: string,
  now = Date.now(),
): ContractLegalReviewStatus {
  if (review.contractVersionId !== currentVersionId)
    return "superseded"

  if (["requested", "opened"].includes(review.status) && new Date(review.expiresAt).getTime() <= now)
    return "expired"

  return review.status
}

export function isBlockingContractLegalReview(
  review: ContractLegalReview,
  currentVersionId: string,
  now = Date.now(),
) {
  return blockingStatuses.has(getEffectiveContractLegalReviewStatus(review, currentVersionId, now))
}

export function hasBlockingContractLegalReview(
  reviews: ContractLegalReview[],
  currentVersionId: string,
  now = Date.now(),
) {
  return reviews.some(review => isBlockingContractLegalReview(review, currentVersionId, now))
}

export function formatContractLegalReviewStatus(status: ContractLegalReviewStatus) {
  return ({
    approved: "Reviewer approved requested scope",
    canceled: "Canceled",
    changes_requested: "Changes requested",
    expired: "Invite expired",
    opened: "In review",
    requested: "Invite sent",
    superseded: "Superseded by a later version",
  } satisfies Record<ContractLegalReviewStatus, string>)[status]
}

export function formatContractLegalReviewerType(type: ContractLegalReviewerType) {
  return type === "in_house_counsel" ? "In-house or team counsel" : "Outside counsel"
}

export function formatContractLegalReviewScope(scope: ContractLegalReviewScope) {
  return contractLegalReviewScopeOptions.find(option => option.value === scope)?.label || scope.replaceAll("_", " ")
}
