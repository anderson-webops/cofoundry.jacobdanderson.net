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
  listLocalPrivacyRequestsForUser,
  persistLocalPrivacyRequestStatusAction,
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

    const reviewed = await persistLocalPrivacyRequestStatusAction({
      action: {
        adminUserId: "user_ava",
        createdAt: "2026-01-10T00:00:00.000Z",
        id: "privacy_action_review",
        notes: "Evidence package reviewed; waiting for provider result.",
        targetId: request.id,
        targetType: "privacy_request",
        type: "review_privacy_request",
      },
      completionConfirmed: false,
      expectedStatus: "open",
      status: "reviewed",
    })

    expect(reviewed).toMatchObject({
      reviewNotes: "Evidence package reviewed; waiting for provider result.",
      reviewedAt: "2026-01-10T00:00:00.000Z",
      reviewedByUserId: "user_ava",
      status: "reviewed",
    })

    await expect(persistLocalPrivacyRequestStatusAction({
      action: {
        adminUserId: "user_ava",
        createdAt: "2026-01-10T12:00:00.000Z",
        id: "privacy_action_unconfirmed",
        notes: "Entered a note without completing the requested action.",
        targetId: request.id,
        targetType: "privacy_request",
        type: "resolve_privacy_request",
      },
      completionConfirmed: false,
      expectedStatus: "reviewed",
      status: "resolved",
    })).rejects.toMatchObject({
      statusCode: 400,
    })

    const resolved = await persistLocalPrivacyRequestStatusAction({
      action: {
        adminUserId: "user_ava",
        createdAt: "2026-01-11T00:00:00.000Z",
        id: "privacy_action_resolve",
        notes: "Provider confirmed the evidence review.",
        targetId: request.id,
        targetType: "privacy_request",
        type: "resolve_privacy_request",
      },
      completionConfirmed: true,
      expectedStatus: "reviewed",
      status: "resolved",
    })

    expect(resolved).toMatchObject({
      resolutionNotes: "Provider confirmed the evidence review.",
      resolvedAt: "2026-01-11T00:00:00.000Z",
      resolvedByUserId: "user_ava",
      status: "resolved",
    })
  })

  it("returns null for missing requests and enforces retention", async () => {
    await expect(persistLocalPrivacyRequestStatusAction({
      action: {
        adminUserId: "user_ava",
        createdAt: "2026-01-10T00:00:00.000Z",
        id: "privacy_action_missing",
        notes: "Missing request.",
        targetId: "missing",
        targetType: "privacy_request",
        type: "review_privacy_request",
      },
      completionConfirmed: false,
      expectedStatus: "open",
      status: "reviewed",
    })).rejects.toMatchObject({
      statusCode: 404,
    })

    for (let index = 0; index < 10; index += 1)
      await createLocalPrivacyRequest(requestFixture(index))

    const requests = await listLocalPrivacyRequests()
    expect(requests).toHaveLength(5)
    expect(requests[0]?.id).toBe("privacy_9")
    expect(await listLocalPrivacyRequestsForUser("user_9")).toEqual([
      expect.objectContaining({
        id: "privacy_9",
        userId: "user_9",
      }),
    ])
    expect(await listLocalPrivacyRequestsForUser("user_0")).toEqual([])
  }, 15_000)
})
