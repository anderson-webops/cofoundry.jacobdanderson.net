import type { H3Event } from "h3"
import type { SessionUser } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createFileUploadPolicy } from "../../server/utils/file-uploads"
import { clearLocalOperationsStoreForTests } from "../../server/utils/local-operations-store"

let dataDirectory: string

const session: SessionUser = {
  email: "uploads-test@cofoundry.local",
  id: "user_uploads_test",
  name: "Uploads Test",
  onboardingCompleted: true,
  role: "member",
  subscriptionPlan: "free",
}

describe("file upload policies", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-uploads-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appUrl: "https://cofoundry.example",
        backendMode: "mock",
      },
    }))
    await clearLocalOperationsStoreForTests()
  })

  afterEach(async () => {
    await clearLocalOperationsStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    vi.unstubAllGlobals()
  })

  it("sanitizes dot-prefixed filenames without crashing in mock mode", async () => {
    const policy = await createFileUploadPolicy({} as H3Event, session, {
      filename: "..trust evidence.txt",
      mimeType: "text/plain",
      purpose: "trust_evidence",
      relatedId: "profile_user_uploads_test",
      relatedType: "profile",
      sizeBytes: 32,
    })

    expect(policy.objectPath).toMatch(/^user_uploads_test\/\d{4}-\d{2}-\d{2}\//)
    expect(policy.objectPath).toContain("-trust-evidence.txt")
    expect(policy.signedUploadUrl).toContain("https://cofoundry.example/api/files/local-upload/")
    expect(policy.uploadToken).toEqual(expect.any(String))
  })
})
