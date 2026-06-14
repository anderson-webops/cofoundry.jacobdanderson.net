import type { PrivacyRequest } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalPrivacyRequestStoreForTests,
  createLocalPrivacyRequest,
  listLocalPrivacyRequests,
  updateLocalPrivacyRequestStatus,
} from "../../server/utils/local-privacy-requests"

let dataDirectory: string

function requestFixture(index = 0): PrivacyRequest {
  return {
    createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    details: `Trust verification review requested for evidence package ${index}.`,
    id: `privacy_${index}`,
    resolutionNotes: null,
    resolvedAt: null,
    resolvedByUserId: null,
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    status: "open",
    type: "safety_privacy",
    userId: `user_${index}`,
  }
}

describe("local privacy request store", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-privacy-requests-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    process.env.COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT = "5"
    await clearLocalPrivacyRequestStoreForTests()
  })

  afterEach(async () => {
    await clearLocalPrivacyRequestStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    delete process.env.COFOUNDRY_PRIVACY_REQUEST_RETENTION_LIMIT
  })

  it("persists requests and status transitions", async () => {
    const request = await createLocalPrivacyRequest(requestFixture())

    expect(request).toMatchObject({
      status: "open",
      type: "safety_privacy",
      userId: "user_0",
    })
    expect(await listLocalPrivacyRequests()).toHaveLength(1)

    const reviewed = await updateLocalPrivacyRequestStatus({
      adminUserId: "user_admin",
      notes: "Evidence package reviewed; waiting for provider result.",
      requestId: request.id,
      status: "reviewed",
      timestamp: "2026-01-10T00:00:00.000Z",
    })

    expect(reviewed).toMatchObject({
      reviewNotes: "Evidence package reviewed; waiting for provider result.",
      reviewedAt: "2026-01-10T00:00:00.000Z",
      reviewedByUserId: "user_admin",
      status: "reviewed",
    })

    const resolved = await updateLocalPrivacyRequestStatus({
      adminUserId: "user_admin",
      notes: "Provider confirmed the evidence review.",
      requestId: request.id,
      status: "resolved",
      timestamp: "2026-01-11T00:00:00.000Z",
    })

    expect(resolved).toMatchObject({
      resolutionNotes: "Provider confirmed the evidence review.",
      resolvedAt: "2026-01-11T00:00:00.000Z",
      resolvedByUserId: "user_admin",
      status: "resolved",
    })
  })

  it("returns null for missing requests and enforces retention", async () => {
    expect(await updateLocalPrivacyRequestStatus({
      adminUserId: "user_admin",
      notes: "Missing request.",
      requestId: "missing",
      status: "reviewed",
      timestamp: "2026-01-10T00:00:00.000Z",
    })).toBeNull()

    for (let index = 0; index < 10; index += 1)
      await createLocalPrivacyRequest(requestFixture(index))

    const requests = await listLocalPrivacyRequests()
    expect(requests).toHaveLength(5)
    expect(requests[0]?.id).toBe("privacy_9")
  }, 15_000)
})
