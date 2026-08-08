import type { H3Event } from "h3"
import type { ContractLegalReview } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearContractLegalReviewStoreForTests,
  createContractLegalReview,
  getContractLegalReview,
  listContractLegalReviews,
  listContractLegalReviewsForContracts,
  supersedeContractLegalReviews,
  updateContractLegalReview,
} from "../../server/utils/contract-legal-reviews"

const event = {} as H3Event
let dataDirectory = ""

function reviewFixture(overrides: Partial<ContractLegalReview> = {}): ContractLegalReview {
  return {
    canceledAt: null,
    contractId: "contract_ledgerloop",
    contractVersionId: "contract_version_ledgerloop_1",
    createdAt: "2026-08-08T12:00:00.000Z",
    expiresAt: "2026-08-22T12:00:00.000Z",
    id: "review_ledgerloop_counsel",
    message: "Review the current founder agreement with attention to equity, vesting, and intellectual-property assignment.",
    openedAt: null,
    requestedByUserId: "user_olivia",
    respondedAt: null,
    reviewerEmail: "Counsel@Example.com",
    reviewerName: "Alex Counsel",
    reviewerOrganization: "Example Startup Law",
    reviewerResponse: null,
    respondedByName: null,
    reviewerType: "outside_counsel",
    scope: ["full_agreement"],
    status: "requested",
    updatedAt: "2026-08-08T12:00:00.000Z",
    ...overrides,
  }
}

describe("contract legal-review persistence", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-contract-legal-reviews-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    vi.stubGlobal("useRuntimeConfig", () => ({ public: { backendMode: "mock" } }))
    await clearContractLegalReviewStoreForTests()
  })

  afterEach(async () => {
    await clearContractLegalReviewStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    vi.unstubAllGlobals()
  })

  it("normalizes reviewer email, rejects active duplicates, and lists only requested contracts", async () => {
    const created = await createContractLegalReview(event, reviewFixture())
    expect(created.reviewerEmail).toBe("counsel@example.com")

    await expect(createContractLegalReview(event, reviewFixture({ id: "review_duplicate" }))).rejects.toMatchObject({
      statusCode: 409,
    })
    expect(await listContractLegalReviews(event, "contract_ledgerloop")).toEqual([
      expect.objectContaining({ id: created.id }),
    ])
    expect(await listContractLegalReviewsForContracts(event, ["contract_other"])).toEqual([])
    expect(await listContractLegalReviewsForContracts(event, ["contract_ledgerloop"])).toHaveLength(1)
  })

  it("uses optimistic status checks and supersedes records from earlier agreement versions", async () => {
    const created = await createContractLegalReview(event, reviewFixture())
    const opened = await updateContractLegalReview(event, created, {
      openedAt: "2026-08-08T12:05:00.000Z",
      status: "opened",
      updatedAt: "2026-08-08T12:05:00.000Z",
    })
    expect(opened).toMatchObject({
      openedAt: "2026-08-08T12:05:00.000Z",
      status: "opened",
    })

    await expect(updateContractLegalReview(event, created, {
      status: "approved",
      updatedAt: "2026-08-08T12:06:00.000Z",
    })).rejects.toMatchObject({ statusCode: 409 })

    expect(await supersedeContractLegalReviews(
      event,
      created.contractId,
      "contract_version_ledgerloop_2",
      "2026-08-08T12:10:00.000Z",
    )).toBe(1)
    expect(await getContractLegalReview(event, created.id)).toMatchObject({
      status: "superseded",
      updatedAt: "2026-08-08T12:10:00.000Z",
    })
  })
})
