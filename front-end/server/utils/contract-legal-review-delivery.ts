import type { H3Event } from "h3"
import type { Contract, ContractLegalReview, ContractVersion, MemberWorkspaceState } from "../../shared/types/domain"
import { formatContractLegalReviewerType, formatContractLegalReviewScope } from "../../shared/utils/legal-reviews"
import { isContactMailConfigured, sendPlainTextEmail } from "./contact"
import { createContractLegalReviewUrl } from "./contract-legal-review-tokens"

export async function deliverContractLegalReviewInvite(
  event: H3Event,
  review: ContractLegalReview,
  contract: Contract,
  version: ContractVersion,
  requester: MemberWorkspaceState,
  preparedInviteUrl?: string,
) {
  const inviteUrl = preparedInviteUrl || createContractLegalReviewUrl(event, review)
  if (!inviteUrl)
    throw new Error("Legal review link signing is not configured.")

  if (!isContactMailConfigured())
    return { delivery: "manual" as const, inviteUrl }

  const scope = review.scope.map(formatContractLegalReviewScope).join(", ")
  const body = [
    `${review.reviewerName},`,
    "",
    `${requester.profile.displayName} invited you to review ${contract.title}, version ${version.versionNumber}, through CoFoundry.`,
    `Reviewer relationship: ${formatContractLegalReviewerType(review.reviewerType)}`,
    `Requested scope: ${scope}`,
    `Invite expires: ${review.expiresAt}`,
    "",
    "Context from the requester:",
    review.message,
    "",
    "Open the version-bound review link:",
    inviteUrl,
    "",
    "Treat this bearer link as confidential. It only opens the agreement version named above and stops working if that version is replaced, the request is canceled, or the invite expires.",
    "",
    "CoFoundry is transmitting an editable agreement template and your response at the parties' request. CoFoundry is not a law firm, does not provide legal advice, does not verify reviewer identity or licensure, and does not create an attorney-client relationship. Any professional relationship is between you and the parties under your separate engagement terms.",
  ].join("\n")

  try {
    await sendPlainTextEmail({
      body,
      subject: `Review requested: ${contract.title} v${version.versionNumber}`,
      toEmail: review.reviewerEmail,
    })
    return { delivery: "sent" as const, inviteUrl }
  }
  catch (error) {
    console.warn("[contract-legal-review] Invite email failed; returning a manual share link.", error)
    return { delivery: "manual" as const, inviteUrl }
  }
}
