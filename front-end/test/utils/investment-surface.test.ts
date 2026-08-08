import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  investmentApplicantMutationEnvelopeSchema,
  investmentReviewerMutationEnvelopeSchema,
} from "../../shared/utils/investment-validation"
import { fileUploadPolicySchema } from "../../shared/utils/validation"

const root = resolve(process.cwd())

function source(path: string) {
  return readFileSync(resolve(root, path), "utf8")
}

describe("investment workspace surface", () => {
  it("ships separate applicant and reviewer routes", () => {
    for (const path of [
      "src/pages/app/investment/index.vue",
      "src/pages/app/investment/[id].vue",
      "src/pages/investment-review/index.vue",
      "src/pages/investment-review/[id].vue",
      "src/layouts/investment-review.vue",
      "src/middleware/investment-review.ts",
      "server/api/investment/workspaces/index.get.ts",
      "server/api/investment/workspaces/index.post.ts",
      "server/api/investment/workspaces/[id]/mutations.post.ts",
      "server/api/investment-review/workspaces/index.get.ts",
      "server/api/investment-review/workspaces/[id].get.ts",
      "server/api/investment-review/workspaces/[id]/mutations.post.ts",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true)
    }
  })

  it("forwards authenticated request context during server-rendered workspace loads", () => {
    for (const path of [
      "src/stores/investmentWorkspaces.ts",
      "src/stores/investmentReview.ts",
      "src/stores/organizations.ts",
    ]) {
      expect(source(path)).toContain("useRequestHeaders([\"cookie\"])")
    }
  })

  it("retires the legacy one-shot submission path", () => {
    expect(source("server/api/investment-applications.post.ts")).toContain("statusCode: 410")
    expect(source("server/api/investment-applications.post.ts")).toContain("versioned investment workspace")
  })

  it("keeps review accounts out of the founder workspace and gates review by role and flag", () => {
    expect(source("src/middleware/auth.ts")).toContain("session.role === \"investor_admin\"")
    expect(source("src/middleware/investment-review.ts")).toContain("featureInvestmentModule")
    expect(source("src/middleware/investment-review.ts")).toContain("[\"admin\", \"investor_admin\"]")
    expect(source("server/utils/admin.ts")).toContain("requireInvestmentReviewerSession")
  })

  it("allows only the exact investment upload purpose and relation pairing", () => {
    expect(fileUploadPolicySchema.safeParse({
      filename: "deck.pdf",
      mimeType: "application/pdf",
      purpose: "investment_document",
      relatedId: "investment_workspace_1",
      relatedType: "investment_workspace",
      sizeBytes: 1024,
    }).success).toBe(true)
    expect(fileUploadPolicySchema.safeParse({
      filename: "deck.pdf",
      mimeType: "application/pdf",
      purpose: "investment_document",
      relatedId: "profile_1",
      relatedType: "profile",
      sizeBytes: 1024,
    }).success).toBe(false)
  })

  it("validates secure applicant and regulated-partner inputs", () => {
    expect(investmentApplicantMutationEnvelopeSchema.safeParse({
      expectedVersion: 1,
      mutation: {
        action: "add_data_room_item",
        category: "pitch",
        description: "A current program review deck.",
        externalUrl: "http://example.com/deck",
        fileUploadId: null,
        shareWithProgram: true,
        title: "Deck",
      },
    }).success).toBe(false)
    expect(investmentReviewerMutationEnvelopeSchema.safeParse({
      expectedVersion: 2,
      mutation: {
        action: "create_partner_handoff",
        internalNotes: "Use the partner onboarding process.",
        partnerName: "Registered Partner",
        partnerType: "broker_dealer",
        partnerUrl: "https://partner.example",
        sharedDataRoomItemIds: ["item_1"],
      },
    }).success).toBe(true)
  })

  it("downloads only clean, authorized, explicitly shared investment files", () => {
    const download = source("server/api/files/[id]/download.get.ts")
    expect(download).toContain("projectInvestmentWorkspaceForReviewer")
    expect(download).toContain("upload.status !== \"uploaded\"")
    expect(download).toContain("upload.scanStatus !== \"clean\"")
    expect(download).toContain("workspace?.applicantUserId === session.id")
    expect(download).toContain("upload.ownerUserId === workspace.applicantUserId")
    expect(download).toContain("upload.purpose === \"investment_document\"")
  })

  it("exports the applicant projection rather than staff-only review content", () => {
    expect(source("server/api/account/export.get.ts")).toContain("loadInvestmentApplicantExport")
    expect(source("server/utils/investment-workspaces.ts")).toContain("projectInvestmentWorkspaceForApplicant")
  })
})
