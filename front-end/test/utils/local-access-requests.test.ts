import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  applyLocalAdminAccessRequestStatus,
  clearLocalAccessRequestStoreForTests,
  createLocalAccessRequest,
  createLocalAccessRequestResult,
  issueLocalAdminAccessInvite,
  listLocalAccessRequests,
  markLocalAccessInviteAccepted,
  validateLocalAccessInvite,
} from "../../server/utils/local-access-requests"

let dataDirectory: string

const basePayload = {
  company: "LedgerLoop",
  companyStage: "prototype" as const,
  email: "founder@example.com",
  name: "Olivia Chen",
  role: "founder" as const,
  source: "vitest",
  timeline: "30_days" as const,
  useCase: "I need a serious cofounder workflow for evaluating collaborators, documenting proposal terms, and opening a workspace invite.",
  website: "",
}

describe("local access request store", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-access-requests-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    process.env.COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT = "5"
    await clearLocalAccessRequestStoreForTests()
  })

  afterEach(async () => {
    await clearLocalAccessRequestStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    delete process.env.COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT
  })

  it("reviews requests, issues invite tokens, and invalidates accepted invites", async () => {
    const request = await createLocalAccessRequest(basePayload)

    expect(request).toMatchObject({
      email: "founder@example.com",
      status: "open",
    })

    const approvedAt = "2026-07-29T19:00:00.000Z"
    const approved = await applyLocalAdminAccessRequestStatus(request.id, {
      action: {
        id: "action_approve_access",
        adminUserId: "user_ava",
        createdAt: approvedAt,
        metadata: { nextStatus: "approved" },
        notes: "Approved after fit review.",
        targetId: request.id,
        targetType: "access_request",
        type: "update_access_request",
      },
      expectedUpdatedAt: request.updatedAt,
      status: "approved",
    })

    expect(approved).toMatchObject({
      adminNotes: "Approved after fit review.",
      reviewedByUserId: "user_ava",
      status: "approved",
    })

    const invite = await issueLocalAdminAccessInvite(request.id, {
      action: {
        id: "action_issue_access",
        adminUserId: "user_ava",
        createdAt: "2026-07-29T19:05:00.000Z",
        metadata: { nextStatus: "invited" },
        notes: "Issued invite after approval.",
        targetId: request.id,
        targetType: "access_request",
        type: "issue_access_invite",
      },
      appUrl: "https://cofoundry.example",
      expectedUpdatedAt: approved!.updatedAt,
    })

    expect(invite?.inviteToken).toHaveLength(43)
    expect(invite?.inviteUrl).toContain("https://cofoundry.example/auth/sign-up?invite=")
    expect(invite?.request.status).toBe("invited")

    const validInvite = await validateLocalAccessInvite(invite!.inviteToken, "founder@example.com")
    expect(validInvite?.id).toBe(request.id)

    const wrongEmailInvite = await validateLocalAccessInvite(invite!.inviteToken, "other@example.com")
    expect(wrongEmailInvite).toBeNull()

    const publicResubmission = await createLocalAccessRequest({
      ...basePayload,
      company: "Attacker-controlled replacement",
      name: "Changed Name",
    })
    expect(publicResubmission).toMatchObject({
      company: "LedgerLoop",
      name: "Olivia Chen",
      status: "invited",
      updatedAt: invite?.request.updatedAt,
    })

    const wrongEmailAcceptance = await markLocalAccessInviteAccepted(invite!.inviteToken, "other@example.com")
    expect(wrongEmailAcceptance).toBeNull()

    const accepted = await markLocalAccessInviteAccepted(invite!.inviteToken, "founder@example.com")
    expect(accepted?.inviteAcceptedAt).toBeTruthy()
    expect(accepted?.inviteExpiresAt).toBeNull()

    const reusedInvite = await validateLocalAccessInvite(invite!.inviteToken, "founder@example.com")
    expect(reusedInvite).toBeNull()
  })

  it("does not let duplicate public submissions overwrite open requests and enforces retention", async () => {
    const firstResult = await createLocalAccessRequestResult(basePayload)
    const updatedResult = await createLocalAccessRequestResult({
      ...basePayload,
      company: "SignalDeck",
      name: "Olivia C.",
      useCase: "I need a durable workspace access review for a later-stage collaborator search with proposals and contracts.",
    })
    const first = firstResult.request
    const updated = updatedResult.request

    expect(firstResult.created).toBe(true)
    expect(updatedResult.created).toBe(false)
    expect(updated.id).toBe(first.id)
    expect(updated.company).toBe("LedgerLoop")
    expect(updated.name).toBe("Olivia Chen")

    for (let index = 0; index < 10; index += 1) {
      await createLocalAccessRequest({
        ...basePayload,
        email: `founder-${index}@example.com`,
        name: `Founder ${index}`,
      })
    }

    expect(await listLocalAccessRequests()).toHaveLength(5)
  }, 15_000)
})
