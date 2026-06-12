import { Buffer } from "node:buffer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { clearLocalOperationsStoreForTests, hashLocalUploadToken, listLocalPendingFileScans, readLocalFileUploadContent, readLocalOperationsRows, recordLocalBackupRun, recordLocalFileScanResult, recordLocalFileUploadPolicy, recordLocalNotificationDelivery, recordLocalOperationalEvent, writeLocalFileUploadContent } from "../../server/utils/local-operations-store"

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
    await recordLocalFileScanResult("upload_test", {
      notes: "Clean test scan.",
      scanStatus: "clean",
      status: "uploaded",
    })
    await recordLocalNotificationDelivery(session, {
      configured: false,
      delivered: false,
      error: "Dry run; no email sent.",
      subject: "CoFoundry: scheduled digest run",
      unreadCount: 3,
    })

    const payload = await readLocalOperationsRows()

    expect(payload.mode).toBe("mock")
    expect(payload.backupRuns[0]).toMatchObject({ id: "backup_test", status: "succeeded" })
    expect(payload.operationalEvents[0]).toMatchObject({ event_type: "scanner.completed", source: "vitest" })
    expect(payload.fileUploads[0]).toMatchObject({ id: "upload_test", scan_status: "clean", status: "uploaded" })
    expect(payload.notificationDeliveries[0]).toMatchObject({
      notification_count: 3,
      status: "skipped",
      subject: "CoFoundry: scheduled digest run",
      user_id: "user_operations_test",
    })
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
      uploadTokenHash: hashLocalUploadToken(uploadToken),
    }, {
      filename: "upload-local.txt",
      mimeType: "text/plain",
      purpose: "trust_evidence",
      relatedId: "profile_user_operations_test",
      relatedType: "profile",
      sizeBytes: 100,
    })

    const pendingBeforeUpload = await listLocalPendingFileScans(10, { appUrl: "https://cofoundry.example" })
    expect(pendingBeforeUpload[0]).toMatchObject({
      id: "upload_local",
      signedDownloadError: "Local upload content has not been received.",
      signedDownloadUrl: null,
    })

    await expect(writeLocalFileUploadContent("upload_local", "wrong-token", Buffer.from("evidence"))).rejects.toThrow("Local upload token is invalid.")

    await writeLocalFileUploadContent("upload_local", uploadToken, Buffer.from("evidence"))

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
})
