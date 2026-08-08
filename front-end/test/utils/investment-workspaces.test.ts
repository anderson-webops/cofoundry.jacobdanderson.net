import type { FileUpload, SessionUser } from "../../shared/types/domain"
import type { InvestmentApplicantMutation, InvestmentReviewerMutation, InvestmentWorkspaceDocument } from "../../shared/types/investment-workspaces"
import { describe, expect, it } from "vitest"
import { investmentWorkspaceSeedDocuments } from "../../shared/data/investment-workspace-seed"
import { cloneValue } from "../../shared/utils/clone"
import {
  applyInvestmentApplicantMutation,
  applyInvestmentReviewerMutation,
  createInvestmentWorkspaceDocument,
  investmentSupplementalTermsVersion,
  projectInvestmentFileUpload,
  projectInvestmentWorkspaceForApplicant,
  projectInvestmentWorkspaceForReviewer,
} from "../../shared/utils/investment-workspaces"

const applicant: SessionUser = {
  email: "founder@example.com",
  id: "user_founder",
  name: "Founder Example",
  onboardingCompleted: true,
  role: "founder",
  subscriptionPlan: "team",
}

const reviewer: SessionUser = {
  email: "reviewer@example.com",
  id: "user_reviewer",
  name: "Reviewer Example",
  onboardingCompleted: true,
  role: "investor_admin",
  subscriptionPlan: "free",
}

function idFactory() {
  let index = 0
  return (prefix: string) => `${prefix}_${++index}`
}

function createDocument() {
  return createInvestmentWorkspaceDocument(applicant, {
    companyName: "Example Labs",
    opportunityId: "opportunity_example",
    organizationId: null,
  }, {
    createId: idFactory(),
    now: "2026-08-08T12:00:00.000Z",
  })
}

function applyApplicant(document: InvestmentWorkspaceDocument, mutation: InvestmentApplicantMutation, minute: number) {
  return applyInvestmentApplicantMutation(document, applicant, mutation, {
    createId: idFactory(),
    now: `2026-08-08T12:${String(minute).padStart(2, "0")}:00.000Z`,
  })
}

function applyReviewer(document: InvestmentWorkspaceDocument, mutation: InvestmentReviewerMutation, minute: number) {
  return applyInvestmentReviewerMutation(document, reviewer, mutation, {
    createId: idFactory(),
    now: `2026-08-08T13:${String(minute).padStart(2, "0")}:00.000Z`,
  })
}

describe("investment workspaces", () => {
  it("creates an applicant-owned draft with no implied partner consent", () => {
    const document = createDocument()

    expect(document.application).toMatchObject({
      status: "draft",
      supplementalTermsVersion: null,
      attestations: { regulatedPartnerSharingConsent: false },
    })
    expect(document.reviewNotes).toEqual([])
    expect(document.auditEvents[0]?.audience).toBe("all")
  })

  it("keeps applicant outreach and unshared records out of the staff projection", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    source.auditEvents.unshift({
      action: "investment.data_room_item_updated",
      actorUserId: source.applicantUserId,
      audience: "all",
      createdAt: source.updatedAt,
      id: "investment_audit_private_data_room",
      summary: "A previously shared private record changed.",
      targetId: "investment_data_room_trialwire_private_model",
      targetType: "investment_data_room_item",
    })
    const projected = projectInvestmentWorkspaceForReviewer(source)!

    expect(projected.prospects).toEqual([])
    expect(projected.interactions).toEqual([])
    expect(projected.dataRoomItems.map(item => item.id)).toEqual(["investment_data_room_trialwire_deck"])
    expect(projected.founderUpdates.map(item => item.id)).toEqual(["investment_update_trialwire_program"])
    expect(projected.auditEvents.some(event => event.id === "investment_audit_trialwire_private_prospect")).toBe(false)
    expect(projected.auditEvents.some(event => event.id === "investment_audit_private_data_room")).toBe(false)
  })

  it("shows staff the submitted application, readiness, and round snapshot instead of later changes", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    source.application.companySummary = "A later application draft that has not been resubmitted."
    source.application.deckUrl = "https://trialwire.health/unsubmitted-deck"
    source.readiness.notes = "A later applicant-only planning change."
    source.rounds[0]!.targetAmount = "$900,000"

    const projected = projectInvestmentWorkspaceForReviewer(source)!

    expect(projected.application.companySummary).toContain("clinical operations teams")
    expect(projected.application.deckUrl).toBe("https://trialwire.health/deck")
    expect(projected.readiness.notes).toContain("Counsel is reviewing")
    expect(projected.rounds[0]?.targetAmount).toBe("$350,000")
    expect(projected.application.submittedWorkspaceAt).toBe("2026-08-08T17:00:00.000Z")
  })

  it("keeps draft and withdrawn applications out of the staff queue", () => {
    const draft = createDocument()
    expect(projectInvestmentWorkspaceForReviewer(draft)).toBeNull()
    draft.application.status = "withdrawn"
    expect(projectInvestmentWorkspaceForReviewer(draft)).toBeNull()
  })

  it("keeps staff risk notes and internal rationale out of the applicant projection", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    source.decisions.push({
      decidedAt: "2026-08-08T18:00:00.000Z",
      decidedByUserId: reviewer.id,
      id: "decision_private",
      internalRationale: "Internal committee rationale",
      outcome: "hold",
      publicRationale: "Additional diligence is needed.",
    })
    const projected = projectInvestmentWorkspaceForApplicant(source, source.applicantUserId)!

    expect(projected.reviewNotes).toEqual([])
    expect(projected.review.riskFlags).toEqual([])
    expect(projected.review.stageSummary).toBe("")
    expect(projected.decisions[0]).toMatchObject({
      decidedByUserId: "",
      internalRationale: "",
      publicRationale: "Additional diligence is needed.",
    })
  })

  it("returns only user-facing investment file metadata", () => {
    const upload: FileUpload = {
      bucket: "private-bucket",
      createdAt: "2026-08-08T12:00:00.000Z",
      deletedAt: null,
      id: "upload_1",
      mimeType: "application/pdf",
      objectPath: "user/secret-object.pdf",
      originalFilename: "deck.pdf",
      ownerUserId: applicant.id,
      purpose: "investment_document",
      relatedId: "investment_workspace_1",
      relatedType: "investment_workspace",
      scanNotes: "Internal scanner detail",
      scanStatus: "clean",
      sizeBytes: 1024,
      status: "uploaded",
      updatedAt: "2026-08-08T12:01:00.000Z",
    }

    const projected = projectInvestmentFileUpload(upload)
    expect(projected).toMatchObject({ id: "upload_1", originalFilename: "deck.pdf", scanStatus: "clean" })
    expect(projected).not.toHaveProperty("bucket")
    expect(projected).not.toHaveProperty("objectPath")
    expect(projected).not.toHaveProperty("ownerUserId")
    expect(projected).not.toHaveProperty("scanNotes")
  })

  it("requires current supplemental terms and every required attestation before submission", () => {
    let document = createDocument()
    document = applyApplicant(document, {
      action: "update_application",
      companySummary: "A complete company summary for program review.",
      deckUrl: "https://example.com/deck",
      fundraisingHistory: "The company has been founder-funded to date.",
      instrument: "safe",
      reason: "The team wants structured readiness feedback before any partner handoff.",
      requestedAmount: "$500,000",
      teamSummary: "A founder and two experienced operators lead the company.",
      traction: "Ten paid customers and consistent month-over-month usage growth.",
      useOfFunds: "Product delivery, security readiness, and measured go-to-market expansion.",
    }, 1)

    expect(() => applyApplicant(document, { action: "submit_application" }, 2)).toThrow("supplemental terms")

    document = applyApplicant(document, {
      action: "accept_supplemental_terms",
      attestations: {
        authorizedToSubmit: true,
        informationAccurate: true,
        noFundingGuarantee: true,
        regulatedExecutionAcknowledged: true,
      },
    }, 2)
    document = applyApplicant(document, { action: "submit_application" }, 3)

    expect(document.application).toMatchObject({
      status: "submitted",
      submissionRevision: 1,
      supplementalTermsVersion: investmentSupplementalTermsVersion,
    })
  })

  it("requires separate sharing consent before staff can prepare a regulated-partner handoff", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    source.application.status = "accepted"

    expect(() => applyReviewer(source, {
      action: "create_partner_handoff",
      internalNotes: "Coordinate only after consent.",
      partnerName: "Registered Partner",
      partnerType: "broker_dealer",
      partnerUrl: "https://partner.example",
      sharedDataRoomItemIds: ["investment_data_room_trialwire_deck"],
    }, 1)).toThrow("separate regulated-partner sharing consent")

    source.application.attestations.regulatedPartnerSharingConsent = true
    const next = applyReviewer(source, {
      action: "create_partner_handoff",
      internalNotes: "Use the partner's controlled onboarding process.",
      partnerName: "Registered Partner",
      partnerType: "broker_dealer",
      partnerUrl: "https://partner.example",
      sharedDataRoomItemIds: ["investment_data_room_trialwire_deck"],
    }, 2)

    expect(next.partnerHandoffs[0]).toMatchObject({
      consentRecordedAt: "2026-08-08T13:02:00.000Z",
      status: "ready",
    })
  })

  it("freezes the selected records after a partner handoff is sent", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    source.applicantUserId = applicant.id
    source.application.status = "accepted"
    source.application.attestations.regulatedPartnerSharingConsent = true
    let next = applyReviewer(source, {
      action: "create_partner_handoff",
      internalNotes: "Prepare the controlled handoff.",
      partnerName: "Registered Partner",
      partnerType: "broker_dealer",
      partnerUrl: "https://partner.example",
      sharedDataRoomItemIds: ["investment_data_room_trialwire_deck"],
    }, 1)
    const handoff = next.partnerHandoffs[0]!
    next = applyReviewer(next, {
      action: "update_partner_handoff",
      externalReference: "partner-case-1",
      handoffId: handoff.id,
      internalNotes: handoff.internalNotes,
      sharedDataRoomItemIds: handoff.sharedDataRoomItemIds,
      status: "sent",
    }, 2)

    expect(() => applyReviewer(next, {
      action: "update_partner_handoff",
      externalReference: "partner-case-1",
      handoffId: handoff.id,
      internalNotes: handoff.internalNotes,
      sharedDataRoomItemIds: [],
      status: "acknowledged",
    }, 3)).toThrow("cannot be changed")

    expect(() => applyApplicant(next, {
      action: "update_data_room_item",
      category: "pitch_deck",
      dataRoomItemId: "investment_data_room_trialwire_deck",
      description: "A changed record after transmission.",
      externalUrl: "https://trialwire.health/revised-deck",
      shareWithProgram: true,
      title: "Revised program deck",
    }, 4)).toThrow("immutable")
  })

  it("halts pending partner handoffs when the applicant withdraws", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    source.applicantUserId = applicant.id
    source.application.status = "committee_review"
    source.application.attestations.regulatedPartnerSharingConsent = true
    let next = applyReviewer(source, {
      action: "create_partner_handoff",
      internalNotes: "Prepare only while the application remains active.",
      partnerName: "Registered Partner",
      partnerType: "broker_dealer",
      partnerUrl: "https://partner.example",
      sharedDataRoomItemIds: ["investment_data_room_trialwire_deck"],
    }, 1)

    next = applyApplicant(next, {
      action: "withdraw_application",
      reason: "The company is pausing its fundraising process.",
    }, 2)

    expect(next.application.status).toBe("withdrawn")
    expect(next.partnerHandoffs[0]?.status).toBe("canceled")
  })

  it("records next-stage acceptance without representing it as funding", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    const next = applyReviewer(source, {
      action: "record_decision",
      internalRationale: "The case is ready for a regulated partner to assess independently.",
      outcome: "refer_to_partner",
      publicRationale: "Accepted for next-stage regulated-partner preparation; no funding is promised.",
    }, 4)

    expect(next.application.status).toBe("accepted")
    expect(next.auditEvents[0]?.summary).toContain("not a funding commitment")
  })

  it("rejects invalid review status jumps", () => {
    const source = cloneValue(investmentWorkspaceSeedDocuments[0]!)
    expect(() => applyReviewer(source, { action: "set_application_status", status: "closed" }, 5)).toThrow("cannot move")
  })
})
