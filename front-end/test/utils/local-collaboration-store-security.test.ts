import type { InvestmentApplication } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalCollaborationStoreForTests,
  filterCollaborationStateForUser,
  loadLocalCollaborationState,
  persistLocalCollaborationStateForUsers,
  recordLocalInvestmentApplication,
} from "../../server/utils/local-collaboration-store"
import { extractUsersCollaborationState } from "../../server/utils/member-collaboration"
import { workspaceSeed } from "../../shared/data/seed"

let dataDirectory: string

function application(id: string, status: InvestmentApplication["status"] = "submitted"): InvestmentApplication {
  return {
    applicantUserId: "user_founder",
    createdAt: "2026-07-29T17:00:00.000Z",
    deckLink: "https://example.com/deck",
    id,
    opportunityId: "opportunity_founder",
    raiseAmount: "$500,000",
    reason: "We are ready to open a disciplined fundraising process.",
    status,
    teamSummary: "Two founders with complementary product and engineering experience.",
    traction: "Ten design partners and three paid pilots.",
  }
}

describe("local collaboration security boundaries", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-local-collaboration-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    await clearLocalCollaborationStoreForTests()
  })

  afterEach(async () => {
    await clearLocalCollaborationStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
  })

  it("rejects a second active investment application for the same member and opportunity", async () => {
    await recordLocalInvestmentApplication(application("application_one"))

    await expect(recordLocalInvestmentApplication(application("application_two"))).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it("allows a new investment application after a declined application", async () => {
    await recordLocalInvestmentApplication(application("application_declined", "declined"))

    await expect(recordLocalInvestmentApplication(application("application_new"))).resolves.toMatchObject({
      id: "application_new",
      status: "submitted",
    })
  })

  it("keeps other members' reports and investment applications out of member state", () => {
    const userId = "user_olivia"
    const extracted = extractUsersCollaborationState(workspaceSeed, [userId])
    const filtered = filterCollaborationStateForUser({
      ...extracted,
      investmentApplications: workspaceSeed.investmentApplications,
      notifications: workspaceSeed.notifications,
      reports: workspaceSeed.reports,
    }, userId)

    expect(extracted.reports.every(report => report.reporterUserId === userId)).toBe(true)
    expect(extracted.investmentApplications.every(item => item.applicantUserId === userId)).toBe(true)
    expect(filtered.reports.every(report => report.reporterUserId === userId)).toBe(true)
    expect(filtered.investmentApplications.every(item => item.applicantUserId === userId)).toBe(true)
  })

  it("retains the full moderation and investment queues only for an authorized admin load", () => {
    const filtered = filterCollaborationStateForUser({
      ...extractUsersCollaborationState(workspaceSeed, ["user_ava"]),
      investmentApplications: workspaceSeed.investmentApplications,
      reports: workspaceSeed.reports,
    }, "user_ava", { includeAdministrativeData: true })

    expect(filtered.reports).toHaveLength(workspaceSeed.reports.length)
    expect(filtered.investmentApplications).toHaveLength(workspaceSeed.investmentApplications.length)
  })

  it("rejects a collaboration write based on a stale affected-user snapshot", async () => {
    const userIds = ["user_olivia", "user_ava"]
    const expected = extractUsersCollaborationState(workspaceSeed, userIds)
    const firstWrite = structuredClone(expected)
    const staleWrite = structuredClone(expected)
    const conversation = firstWrite.conversations[0]
    const staleConversation = staleWrite.conversations[0]

    expect(conversation).toBeDefined()
    expect(staleConversation).toBeDefined()
    await persistLocalCollaborationStateForUsers(userIds, expected)

    conversation!.lastMessageAt = "2026-07-29T18:00:00.000Z"
    await persistLocalCollaborationStateForUsers(userIds, firstWrite, {
      expectedState: expected,
    })

    staleConversation!.lastMessageAt = "2026-07-29T18:05:00.000Z"
    await expect(persistLocalCollaborationStateForUsers(userIds, staleWrite, {
      expectedState: expected,
    })).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it("preserves private counterparty rows that the actor did not observe", async () => {
    const malikExpected = extractUsersCollaborationState(workspaceSeed, ["user_malik"])
    const malikNext = structuredClone(malikExpected)
    malikNext.notifications.unshift({
      body: "Private counterparty update",
      createdAt: "2026-07-29T18:00:00.000Z",
      href: "/app/contracts/contract_1",
      id: "notification_private_malik",
      readAt: null,
      title: "Agreement revision ready",
      type: "contract",
      userId: "user_malik",
    })
    await persistLocalCollaborationStateForUsers(["user_malik"], malikNext, {
      expectedState: malikExpected,
    })

    const oliviaExpected = extractUsersCollaborationState(workspaceSeed, ["user_olivia"])
    const oliviaNext = structuredClone(oliviaExpected)
    const contract = oliviaNext.contracts[0]
    expect(contract).toBeDefined()
    contract!.updatedAt = "2026-07-29T18:05:00.000Z"

    await persistLocalCollaborationStateForUsers(["user_olivia", "user_malik"], oliviaNext, {
      expectedState: oliviaExpected,
    })

    const malikState = await loadLocalCollaborationState("user_malik")
    expect(malikState).not.toBeNull()
    expect(malikState!.notifications).toContainEqual(expect.objectContaining({
      id: "notification_private_malik",
      title: "Agreement revision ready",
    }))
    expect(malikState!.contracts).toContainEqual(expect.objectContaining({
      id: contract!.id,
      updatedAt: "2026-07-29T18:05:00.000Z",
    }))
  })
})
