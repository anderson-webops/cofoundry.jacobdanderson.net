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
    delete process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT
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

  it("keeps another agreement's current version after a member adds many revisions", async () => {
    process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT = "100"
    const victimUsers = ["user_emma", "user_sofia"]
    const victimExpected = extractUsersCollaborationState(workspaceSeed, victimUsers)
    const victimState = structuredClone(victimExpected)
    const sourceContract = workspaceSeed.contracts[0]!
    const sourceVersion = workspaceSeed.contractVersions[0]!
    victimState.contracts.push({
      ...sourceContract,
      id: "contract_trialwire",
      proposalId: "proposal_trialwire_design",
      currentVersionId: "contract_version_trialwire_1",
    })
    victimState.contractVersions.push({
      ...sourceVersion,
      id: "contract_version_trialwire_1",
      contractId: "contract_trialwire",
      createdAt: "2025-01-01T00:00:00.000Z",
    })
    victimState.signatures.push({
      ...workspaceSeed.signatures[0]!,
      id: "signature_trialwire_1",
      contractId: "contract_trialwire",
      contractVersionId: "contract_version_trialwire_1",
      userId: "user_emma",
      signedAt: "2025-01-01T00:01:00.000Z",
    })
    await persistLocalCollaborationStateForUsers(victimUsers, victimState, {
      expectedState: victimExpected,
    })

    const attackerUsers = ["user_olivia", "user_malik"]
    const attackerExpected = extractUsersCollaborationState(workspaceSeed, attackerUsers)
    const attackerState = structuredClone(attackerExpected)
    const attackerContract = attackerState.contracts.find(contract => contract.id === sourceContract.id)!
    attackerState.contractVersions.push(...Array.from({ length: 99 }, (_, index) => ({
      ...sourceVersion,
      id: `contract_version_ledgerloop_${index + 2}`,
      versionNumber: index + 2,
      createdAt: "2026-09-29T12:00:00.000Z",
    })))
    attackerState.signatures.push(...Array.from({ length: 99 }, (_, index) => ({
      ...workspaceSeed.signatures[0]!,
      id: `signature_ledgerloop_${index + 2}`,
      contractVersionId: `contract_version_ledgerloop_${index + 2}`,
      signedAt: "2026-09-29T12:01:00.000Z",
    })))
    attackerContract.currentVersionId = "contract_version_ledgerloop_100"
    attackerContract.updatedAt = "2026-09-29T12:00:00.000Z"
    await persistLocalCollaborationStateForUsers(attackerUsers, attackerState, {
      expectedState: attackerExpected,
    })

    const savedVictim = await loadLocalCollaborationState("user_emma")
    expect(savedVictim?.contracts).toContainEqual(expect.objectContaining({
      id: "contract_trialwire",
      currentVersionId: "contract_version_trialwire_1",
    }))
    expect(savedVictim?.contractVersions).toContainEqual(expect.objectContaining({
      id: "contract_version_trialwire_1",
    }))
    expect(savedVictim?.signatures).toContainEqual(expect.objectContaining({
      id: "signature_trialwire_1",
      contractVersionId: "contract_version_trialwire_1",
    }))

    const overLimit = structuredClone(attackerState)
    overLimit.contractVersions.push({
      ...sourceVersion,
      id: "contract_version_ledgerloop_101",
      versionNumber: 101,
      createdAt: "2026-09-29T12:01:00.000Z",
    })
    overLimit.contracts.find(contract => contract.id === sourceContract.id)!.currentVersionId = "contract_version_ledgerloop_101"
    await expect(persistLocalCollaborationStateForUsers(attackerUsers, overLimit, {
      expectedState: attackerState,
    })).rejects.toMatchObject({ statusCode: 409 })
    expect((await loadLocalCollaborationState("user_emma"))?.contractVersions).toContainEqual(expect.objectContaining({
      id: "contract_version_trialwire_1",
    }))
    expect((await loadLocalCollaborationState("user_emma"))?.signatures).toContainEqual(expect.objectContaining({
      id: "signature_trialwire_1",
    }))
    expect((await loadLocalCollaborationState("user_olivia"))?.contracts).toContainEqual(expect.objectContaining({
      id: sourceContract.id,
      currentVersionId: "contract_version_ledgerloop_100",
    }))
  })

  it("keeps proposal history independent of another proposal's revision growth", async () => {
    process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT = "100"
    const victimUsers = ["user_emma", "user_sofia"]
    const victimExpected = extractUsersCollaborationState(workspaceSeed, victimUsers)
    const victimState = structuredClone(victimExpected)
    victimState.proposalVersions.forEach((version) => {
      version.createdAt = "2025-01-01T00:00:00.000Z"
    })
    await persistLocalCollaborationStateForUsers(victimUsers, victimState, {
      expectedState: victimExpected,
    })

    const attackerUsers = ["user_olivia", "user_malik"]
    const attackerExpected = extractUsersCollaborationState(workspaceSeed, attackerUsers)
    const attackerState = structuredClone(attackerExpected)
    const sourceVersion = attackerState.proposalVersions.find(version => version.proposalId === "proposal_ledgerloop_cto")!
    attackerState.proposalVersions.push(...Array.from({ length: 98 }, (_, index) => ({
      ...sourceVersion,
      id: `proposal_version_ledgerloop_${index + 3}`,
      versionNumber: index + 3,
      createdAt: "2026-09-29T12:00:00.000Z",
    })))
    attackerState.proposals.find(proposal => proposal.id === "proposal_ledgerloop_cto")!.currentVersionId = "proposal_version_ledgerloop_100"
    await persistLocalCollaborationStateForUsers(attackerUsers, attackerState, {
      expectedState: attackerExpected,
    })

    const savedVictim = await loadLocalCollaborationState("user_emma")
    expect(savedVictim?.proposals).toContainEqual(expect.objectContaining({
      id: "proposal_trialwire_design",
      currentVersionId: "proposal_version_trialwire_2",
    }))
    expect(savedVictim?.proposalVersions).toContainEqual(expect.objectContaining({
      id: "proposal_version_trialwire_2",
    }))

    const overLimit = structuredClone(attackerState)
    overLimit.proposalVersions.push({
      ...sourceVersion,
      id: "proposal_version_ledgerloop_101",
      versionNumber: 101,
      createdAt: "2026-09-29T12:01:00.000Z",
    })
    overLimit.proposals.find(proposal => proposal.id === "proposal_ledgerloop_cto")!.currentVersionId = "proposal_version_ledgerloop_101"
    await expect(persistLocalCollaborationStateForUsers(attackerUsers, overLimit, {
      expectedState: attackerState,
    })).rejects.toMatchObject({ statusCode: 409 })
    expect((await loadLocalCollaborationState("user_emma"))?.proposalVersions).toContainEqual(expect.objectContaining({
      id: "proposal_version_trialwire_2",
    }))
  })

  it("preserves older agreements when another member fills their own contract quota", async () => {
    process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT = "100"
    const victimUsers = ["user_emma", "user_sofia"]
    const victimExpected = extractUsersCollaborationState(workspaceSeed, victimUsers)
    const victimState = structuredClone(victimExpected)
    const sourceContract = workspaceSeed.contracts[0]!
    const sourceVersion = workspaceSeed.contractVersions[0]!
    victimState.contracts.push({
      ...sourceContract,
      id: "contract_trialwire",
      proposalId: "proposal_trialwire_design",
      currentVersionId: "contract_version_trialwire_1",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    })
    victimState.contractVersions.push({
      ...sourceVersion,
      id: "contract_version_trialwire_1",
      contractId: "contract_trialwire",
      createdAt: "2025-01-01T00:00:00.000Z",
    })
    await persistLocalCollaborationStateForUsers(victimUsers, victimState, { expectedState: victimExpected })

    const attackerUsers = ["user_olivia", "user_malik"]
    const attackerExpected = extractUsersCollaborationState(workspaceSeed, attackerUsers)
    const attackerState = structuredClone(attackerExpected)
    attackerState.contracts.push(...Array.from({ length: 99 }, (_, index) => ({
      ...sourceContract,
      id: `contract_ledgerloop_${index + 2}`,
      currentVersionId: `contract_version_ledgerloop_${index + 2}`,
      createdAt: "2026-09-29T12:00:00.000Z",
      updatedAt: "2026-09-29T12:00:00.000Z",
    })))
    attackerState.contractVersions.push(...Array.from({ length: 99 }, (_, index) => ({
      ...sourceVersion,
      id: `contract_version_ledgerloop_${index + 2}`,
      contractId: `contract_ledgerloop_${index + 2}`,
      createdAt: "2026-09-29T12:00:00.000Z",
    })))
    await persistLocalCollaborationStateForUsers(attackerUsers, attackerState, { expectedState: attackerExpected })

    expect((await loadLocalCollaborationState("user_emma"))?.contracts).toContainEqual(expect.objectContaining({
      id: "contract_trialwire",
      currentVersionId: "contract_version_trialwire_1",
    }))
    expect((await loadLocalCollaborationState("user_emma"))?.contractVersions).toContainEqual(expect.objectContaining({
      id: "contract_version_trialwire_1",
    }))

    const overLimit = structuredClone(attackerState)
    overLimit.contracts.push({
      ...sourceContract,
      id: "contract_ledgerloop_101",
      currentVersionId: "contract_version_ledgerloop_101",
      createdAt: "2026-09-29T12:01:00.000Z",
      updatedAt: "2026-09-29T12:01:00.000Z",
    })
    overLimit.contractVersions.push({
      ...sourceVersion,
      id: "contract_version_ledgerloop_101",
      contractId: "contract_ledgerloop_101",
      createdAt: "2026-09-29T12:01:00.000Z",
    })
    await expect(persistLocalCollaborationStateForUsers(attackerUsers, overLimit, {
      expectedState: attackerState,
    })).rejects.toMatchObject({ statusCode: 409 })
    expect((await loadLocalCollaborationState("user_emma"))?.contracts).toContainEqual(expect.objectContaining({
      id: "contract_trialwire",
    }))
  })

  it("keeps existing histories readable when an operator lowers the local limit", async () => {
    process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT = "101"
    const userIds = ["user_olivia", "user_malik"]
    const expected = extractUsersCollaborationState(workspaceSeed, userIds)
    const state = structuredClone(expected)
    const sourceVersion = state.contractVersions.find(version => version.contractId === "contract_ledgerloop")!
    state.contractVersions.push(...Array.from({ length: 100 }, (_, index) => ({
      ...sourceVersion,
      id: `contract_version_ledgerloop_${index + 2}`,
      versionNumber: index + 2,
      createdAt: "2026-09-29T12:00:00.000Z",
    })))
    state.contracts.find(contract => contract.id === "contract_ledgerloop")!.currentVersionId = "contract_version_ledgerloop_101"
    await persistLocalCollaborationStateForUsers(userIds, state, { expectedState: expected })

    process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT = "100"
    expect((await loadLocalCollaborationState("user_olivia"))?.contractVersions).toHaveLength(101)
    await recordLocalInvestmentApplication(application("application_after_limit_change"))
    expect((await loadLocalCollaborationState("user_olivia"))?.contractVersions).toHaveLength(101)

    const overLimit = structuredClone(state)
    overLimit.contractVersions.push({
      ...sourceVersion,
      id: "contract_version_ledgerloop_102",
      versionNumber: 102,
      createdAt: "2026-09-29T12:01:00.000Z",
    })
    await expect(persistLocalCollaborationStateForUsers(userIds, overLimit, {
      expectedState: state,
    })).rejects.toMatchObject({ statusCode: 409 })
    expect((await loadLocalCollaborationState("user_olivia"))?.contractVersions).toHaveLength(101)
  })
})
