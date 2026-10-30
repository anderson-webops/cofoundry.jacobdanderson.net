import { Buffer } from "node:buffer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { assertLocalFileUploadToken, clearLocalOperationsStoreForTests, findLocalEmailSuppression, hashLocalUploadToken, listLocalContractEnvelopeEvents, listLocalFileUploadsByRelated, listLocalPendingFileScans, readLocalFileUploadContent, readLocalOperationsRows, recordLocalBackupRun, recordLocalContractEnvelopeEvent, recordLocalEmailSuppression, recordLocalFileScanResult, recordLocalFileUploadPolicy, recordLocalNotificationDelivery, recordLocalOperationalEvent, recordLocalTrustVerificationEvent, writeLocalFileUploadContent } from "../../server/utils/local-operations-store"

let dataDirectory: string

const session = {
  email: "operations-test@cofoundry.local",
  id: "user_operations_test",
  name: "Operations Test",
  onboardingCompleted: true,
  role: "admin" as const,
  subscriptionPlan: "free" as const,
}

describe("local operations telemetry store", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-operations-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    process.env.COFOUNDRY_OPERATIONS_RETENTION_LIMIT = "10"
    await clearLocalOperationsStoreForTests()
  })

  afterEach(async () => {
    await clearLocalOperationsStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    delete process.env.COFOUNDRY_OPERATIONS_RETENTION_LIMIT
  })

  it("returns worker-reported rows through the mock admin operations payload", async () => {
    await recordLocalBackupRun({
      artifactUri: "file:///srv/backups/cofoundry-test.sql.gz",
      completedAt: "2026-04-29T10:05:00.000Z",
      id: "backup_test",
      metadata: { bytes: 1024 },
      notes: "Test backup completed.",
      provider: "local-test",
      startedAt: "2026-04-29T10:00:00.000Z",
      status: "succeeded",
    })
    await recordLocalOperationalEvent({
      eventType: "scanner.completed",
      metadata: { uploadId: "upload_test" },
      severity: "info",
      source: "vitest",
    })
    await recordLocalFileUploadPolicy(session, {
      bucket: "cofoundry-private",
      id: "upload_test",
      objectPath: "users/user_operations_test/upload_test/evidence.pdf",
    }, {
      filename: "evidence.pdf",
      mimeType: "application/pdf",
      purpose: "trust_evidence",
      relatedId: "profile_user_operations_test",
      relatedType: "profile",
      sizeBytes: 1024,
    })
    await recordLocalFileScanResult("upload_test", {
      notes: "Clean test scan.",
      scanStatus: "clean",
    })
    await recordLocalNotificationDelivery(session, {
      bodyPreview: "Malik updated a proposal.",
      configured: false,
      delivered: false,
      error: "Dry run; no email sent.",
      eventType: "proposal.updated",
      metadata: { source: "vitest" },
      subject: "CoFoundry: scheduled digest run",
      targetId: "proposal_ledgerloop_cto",
      targetType: "proposal",
      unreadCount: 3,
    })
    await recordLocalEmailSuppression({
      category: "workflow",
      email: "Operations-Test@CoFoundry.Local",
      metadata: { event: "complaint" },
      provider: "postmark",
      reason: "complaint",
      sourceEventId: "provider-event-1",
      suppressedAt: "2026-04-29T11:00:00.000Z",
    })
    await recordLocalEmailSuppression({
      category: "all",
      email: "different@example.com",
      metadata: { replay: true },
      provider: "POSTMARK",
      reason: "bounce",
      sourceEventId: "provider-event-1",
      suppressedAt: "2026-04-29T11:30:00.000Z",
    })
    await recordLocalContractEnvelopeEvent({
      completedPdfFileUploadId: "upload_completed_pdf",
      completedPdfSha256: "b".repeat(64),
      contractId: "contract_ledgerloop",
      contractVersionId: "contract_ledgerloop_version_1",
      metadata: { providerStatus: "completed" },
      occurredAt: "2026-04-29T12:00:00.000Z",
      provider: "docusign",
      providerEnvelopeId: "envelope_123",
      signedByUserIds: ["user_olivia", "user_malik"],
      sourceEventId: "provider-envelope-event-1",
      status: "completed",
    })
    await recordLocalContractEnvelopeEvent({
      completedPdfFileUploadId: null,
      completedPdfSha256: null,
      contractId: "contract_changed",
      contractVersionId: "contract_changed_version",
      metadata: { replay: true },
      occurredAt: "2026-04-29T12:30:00.000Z",
      provider: "DOCUSIGN",
      providerEnvelopeId: "envelope_changed",
      signedByUserIds: [],
      sourceEventId: "provider-envelope-event-1",
      status: "failed",
    })
    await recordLocalTrustVerificationEvent({
      confidence: 0.94,
      evidenceFileUploadId: "upload_trust_evidence",
      metadata: { providerResult: "domain_match" },
      occurredAt: "2026-04-29T13:00:00.000Z",
      provider: "persona",
      providerSubjectId: "inquiry_123",
      sourceEventId: "provider-trust-event-1",
      status: "verified",
      targetId: "profile_user_olivia",
      targetType: "profile",
      verificationType: "government_id",
    })
    await recordLocalTrustVerificationEvent({
      confidence: 0.1,
      evidenceFileUploadId: null,
      metadata: { replay: true },
      occurredAt: "2026-04-29T13:30:00.000Z",
      provider: "PERSONA",
      providerSubjectId: "inquiry_changed",
      sourceEventId: "provider-trust-event-1",
      status: "failed",
      targetId: "profile_changed",
      targetType: "profile",
      verificationType: "government_id",
    })

    const payload = await readLocalOperationsRows()

    expect(payload.mode).toBe("mock")
    expect(payload.backupRuns[0]).toMatchObject({ id: "backup_test", status: "succeeded" })
    expect(payload.operationalEvents[0]).toMatchObject({ event_type: "scanner.completed", source: "vitest" })
    expect(payload.fileUploads[0]).toMatchObject({ id: "upload_test", scan_status: "clean", status: "uploaded" })
    expect(payload.notificationDeliveries[0]).toMatchObject({
      body_preview: "Malik updated a proposal.",
      event_type: "proposal.updated",
      metadata: { source: "vitest" },
      notification_count: 3,
      status: "skipped",
      subject: "CoFoundry: scheduled digest run",
      target_id: "proposal_ledgerloop_cto",
      target_type: "proposal",
      user_id: "user_operations_test",
    })
    expect(payload.emailSuppressions[0]).toMatchObject({
      category: "workflow",
      email: "operations-test@cofoundry.local",
      metadata: { event: "complaint" },
      provider: "postmark",
      reason: "complaint",
      source_event_id: "provider-event-1",
      suppressed_at: "2026-04-29T11:00:00.000Z",
    })
    expect(payload.emailSuppressions).toHaveLength(1)

    const matchedSuppression = await findLocalEmailSuppression("OPERATIONS-TEST@cofoundry.local", "workflow")
    expect(matchedSuppression?.reason).toBe("complaint")
    expect(payload.contractEnvelopeEvents[0]).toMatchObject({
      completed_pdf_file_upload_id: "upload_completed_pdf",
      completed_pdf_sha256: "b".repeat(64),
      contract_id: "contract_ledgerloop",
      contract_version_id: "contract_ledgerloop_version_1",
      provider: "docusign",
      provider_envelope_id: "envelope_123",
      signed_by_user_ids: ["user_olivia", "user_malik"],
      source_event_id: "provider-envelope-event-1",
      status: "completed",
    })
    expect(payload.contractEnvelopeEvents).toHaveLength(1)
    expect(payload.trustVerificationEvents[0]).toMatchObject({
      confidence: 0.94,
      evidence_file_upload_id: "upload_trust_evidence",
      metadata: { providerResult: "domain_match" },
      provider: "persona",
      provider_subject_id: "inquiry_123",
      source_event_id: "provider-trust-event-1",
      status: "verified",
      target_id: "profile_user_olivia",
      target_type: "profile",
      verification_type: "government_id",
    })
    expect(payload.trustVerificationEvents).toHaveLength(1)

    const matchedEnvelopeEvents = await listLocalContractEnvelopeEvents("contract_ledgerloop", "contract_ledgerloop_version_1")
    expect(matchedEnvelopeEvents).toHaveLength(1)
  })

  it("enforces per-collection retention limits", async () => {
    for (let index = 0; index < 12; index += 1) {
      await recordLocalOperationalEvent({
        eventType: `retention.${index}`,
        metadata: { index },
        severity: "info",
        source: "vitest",
      })
    }

    const payload = await readLocalOperationsRows()

    expect(payload.operationalEvents).toHaveLength(10)
  })

  it("stores local upload content for worker scanner downloads in mock mode", async () => {
    const uploadToken = "local-upload-token"
    await recordLocalFileUploadPolicy(session, {
      bucket: "cofoundry-private-files",
      id: "upload_local",
      objectPath: "user_operations_test/2026-06-12/upload-local.txt",
      uploadTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      uploadTokenHash: hashLocalUploadToken(uploadToken),
    }, {
      filename: "upload-local.txt",
      mimeType: "text/plain",
      purpose: "trust_evidence",
      relatedId: "profile_user_operations_test",
      relatedType: "profile",
      sizeBytes: 8,
    })

    const pendingBeforeUpload = await listLocalPendingFileScans(10, { appUrl: "https://cofoundry.example" })
    expect(pendingBeforeUpload[0]).toMatchObject({
      id: "upload_local",
      signedDownloadError: "Local upload content has not been received.",
      signedDownloadUrl: null,
    })

    await expect(assertLocalFileUploadToken("upload_local", "wrong-token")).rejects.toThrow("Local upload token is invalid or expired.")
    await expect(assertLocalFileUploadToken("upload_local", uploadToken)).resolves.toEqual({
      sizeBytes: 8,
    })
    await expect(writeLocalFileUploadContent("upload_local", "wrong-token", Buffer.from("evidence"))).rejects.toThrow("Local upload token is invalid or expired.")

    await writeLocalFileUploadContent("upload_local", uploadToken, Buffer.from("evidence"))
    await expect(assertLocalFileUploadToken("upload_local", uploadToken)).rejects.toThrow("Local upload token is invalid or expired.")
    await expect(writeLocalFileUploadContent("upload_local", uploadToken, Buffer.from("evidence"))).rejects.toThrow("Local upload token is invalid or expired.")

    const content = await readLocalFileUploadContent("upload_local")
    expect(content?.bytes.toString("utf-8")).toBe("evidence")
    expect(content?.filename).toBe("upload-local.txt")

    const pendingAfterUpload = await listLocalPendingFileScans(10, { appUrl: "https://cofoundry.example" })
    expect(pendingAfterUpload[0]).toMatchObject({
      id: "upload_local",
      signedDownloadError: null,
      signedDownloadUrl: "https://cofoundry.example/api/operations/file-scans/upload_local/download",
    })
  })

  it("returns local upload records in the shared file-upload domain shape", async () => {
    await recordLocalFileUploadPolicy(session, {
      bucket: "cofoundry-private-files",
      id: "upload_relationship",
      objectPath: "user_operations_test/2026-06-12/relationship.pdf",
      uploadTokenHash: hashLocalUploadToken("relationship-token"),
    }, {
      filename: "relationship.pdf",
      mimeType: "application/pdf",
      purpose: "proposal_attachment",
      relatedId: "proposal_test",
      relatedType: "proposal",
      sizeBytes: 2048,
    })

    await recordLocalFileUploadPolicy(session, {
      bucket: "cofoundry-private-files",
      id: "upload_other",
      objectPath: "user_operations_test/2026-06-12/other.pdf",
      uploadTokenHash: hashLocalUploadToken("other-token"),
    }, {
      filename: "other.pdf",
      mimeType: "application/pdf",
      purpose: "trust_evidence",
      relatedId: "profile_test",
      relatedType: "profile",
      sizeBytes: 2048,
    })

    const uploads = await listLocalFileUploadsByRelated([
      { relatedId: "proposal_test", relatedType: "proposal" }
    ])

    expect(uploads).toHaveLength(1)
    expect(uploads[0]).toMatchObject({
      bucket: "cofoundry-private-files",
      id: "upload_relationship",
      originalFilename: "relationship.pdf",
      ownerUserId: "user_operations_test",
      purpose: "proposal_attachment",
      relatedId: "proposal_test",
      relatedType: "proposal",
      scanStatus: "pending",
      status: "pending",
    })
  })
})
