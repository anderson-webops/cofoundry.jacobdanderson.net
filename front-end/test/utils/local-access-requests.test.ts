import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalAccessRequestStoreForTests,
  createLocalAccessInvite,
  createLocalAccessRequest,
  listLocalAccessRequests,
  markLocalAccessInviteAccepted,
  updateLocalAccessRequestStatus,
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
    process.env.COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT = "50"
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

    const approved = await updateLocalAccessRequestStatus(request.id, {
      adminNotes: "Approved after fit review.",
      reviewedByUserId: "user_admin",
      status: "approved",
    })

    expect(approved).toMatchObject({
      adminNotes: "Approved after fit review.",
      reviewedByUserId: "user_admin",
      status: "approved",
    })

    const invite = await createLocalAccessInvite(request.id, {
      adminNotes: "Issued invite after approval.",
      appUrl: "https://cofoundry.example",
      reviewedByUserId: "user_admin",
    })

    expect(invite?.inviteToken).toHaveLength(43)
    expect(invite?.inviteUrl).toContain("https://cofoundry.example/auth/sign-up?invite=")
    expect(invite?.request.status).toBe("invited")

    const validInvite = await validateLocalAccessInvite(invite!.inviteToken, "founder@example.com")
    expect(validInvite?.id).toBe(request.id)

    const wrongEmailInvite = await validateLocalAccessInvite(invite!.inviteToken, "other@example.com")
    expect(wrongEmailInvite).toBeNull()

    const accepted = await markLocalAccessInviteAccepted(invite!.inviteToken)
    expect(accepted?.inviteAcceptedAt).toBeTruthy()

    const reusedInvite = await validateLocalAccessInvite(invite!.inviteToken, "founder@example.com")
    expect(reusedInvite).toBeNull()
  })

  it("updates duplicate open requests and enforces retention", async () => {
    const first = await createLocalAccessRequest(basePayload)
    const updated = await createLocalAccessRequest({
      ...basePayload,
      company: "SignalDeck",
      name: "Olivia C.",
      useCase: "I need a durable workspace access review for a later-stage collaborator search with proposals and contracts.",
    })

    expect(updated.id).toBe(first.id)
    expect(updated.company).toBe("SignalDeck")

    for (let index = 0; index < 55; index += 1) {
      await createLocalAccessRequest({
        ...basePayload,
        email: `founder-${index}@example.com`,
        name: `Founder ${index}`,
      })
    }

    expect(await listLocalAccessRequests()).toHaveLength(50)
  }, 15_000)
})
