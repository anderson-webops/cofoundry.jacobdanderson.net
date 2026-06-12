import type { AdminAction, PrivacyRequest } from "../../shared/types/domain"
import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { buildAdminEvidencePackages } from "../../shared/utils/evidence"

describe("evidence utilities", () => {
  it("normalizes operations file-upload rows into trust evidence packages", () => {
    const packages = buildAdminEvidencePackages({
      fileUploads: [{
        id: "upload_pending",
        owner_user_id: "user_olivia",
        original_filename: "identity-evidence.pdf",
        mime_type: "application/pdf",
        size_bytes: 102400,
        purpose: "trust_evidence",
        related_type: "profile",
        related_id: "profile_olivia",
        status: "uploaded",
        scan_status: "pending",
        scan_notes: "Scanner has not returned a result yet.",
        created_at: "2026-06-10T12:00:00.000Z",
        updated_at: "2026-06-10T12:00:00.000Z",
      }],
      seed: workspaceSeed,
    })
    const upload = packages.find(item => item.targetId === "upload_pending")

    expect(upload?.ownerLabel).toBe("Olivia Chen")
    expect(upload?.state).toBe("needs_scan")
    expect(upload?.filename).toBe("identity-evidence.pdf")
  })

  it("derives flagged, needs-review, and reviewed upload states", () => {
    const reviewAction: AdminAction = {
      adminUserId: "user_ava",
      createdAt: "2026-06-11T10:00:00.000Z",
      id: "action_review_clean_upload",
      notes: "Reviewed clean trust evidence file.",
      targetId: "upload_clean_reviewed",
      targetType: "file_upload",
      type: "review_evidence",
    }
    const packages = buildAdminEvidencePackages({
      adminActions: [reviewAction],
      fileUploads: [
        {
          id: "upload_flagged",
          owner_user_id: "user_olivia",
          original_filename: "flagged.pdf",
          purpose: "trust_evidence",
          status: "blocked",
          scan_status: "flagged",
          created_at: "2026-06-10T11:00:00.000Z",
          updated_at: "2026-06-10T11:00:00.000Z",
        },
        {
          id: "upload_clean_needs_review",
          owner_user_id: "user_olivia",
          original_filename: "clean-needs-review.pdf",
          purpose: "trust_evidence",
          status: "uploaded",
          scan_status: "clean",
          created_at: "2026-06-10T12:00:00.000Z",
          updated_at: "2026-06-10T12:00:00.000Z",
        },
        {
          id: "upload_clean_reviewed",
          owner_user_id: "user_olivia",
          original_filename: "clean-reviewed.pdf",
          purpose: "trust_evidence",
          status: "uploaded",
          scan_status: "clean",
          created_at: "2026-06-10T13:00:00.000Z",
          updated_at: "2026-06-10T13:00:00.000Z",
        },
      ],
      seed: {
        ...workspaceSeed,
        fileUploads: [],
      },
    })

    expect(packages.find(item => item.targetId === "upload_flagged")?.state).toBe("flagged")
    expect(packages.find(item => item.targetId === "upload_clean_needs_review")?.state).toBe("needs_review")
    expect(packages.find(item => item.targetId === "upload_clean_reviewed")?.state).toBe("reviewed")
    expect(packages.find(item => item.targetId === "upload_clean_reviewed")?.reviewedByLabel).toBe("Ava Morgan")
  })

  it("creates request-only packages for safety/privacy requests without an upload", () => {
    const request: PrivacyRequest = {
      createdAt: "2026-06-10T12:00:00.000Z",
      details: "Please review my profile visibility and trust evidence before public display.",
      id: "privacy_safety_without_upload",
      resolutionNotes: null,
      resolvedAt: null,
      resolvedByUserId: null,
      reviewNotes: null,
      reviewedAt: null,
      reviewedByUserId: null,
      status: "open",
      type: "safety_privacy",
      userId: "user_olivia",
    }
    const packages = buildAdminEvidencePackages({
      privacyRequests: [request],
      seed: {
        ...workspaceSeed,
        fileUploads: [],
      },
    })
    const evidenceRequest = packages.find(item => item.targetId === request.id)

    expect(evidenceRequest?.targetType).toBe("privacy_request")
    expect(evidenceRequest?.state).toBe("request_only")
    expect(evidenceRequest?.privacyRequestStatus).toBe("open")
  })
})
