import type { SessionUser } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalInvestmentWorkspaceStoreForTests,
  createLocalInvestmentWorkspaceDocument,
  getLocalInvestmentWorkspaceDocument,
  getLocalInvestmentWorkspaceDocumentByApplicationId,
  listLocalInvestmentWorkspaceDocuments,
  updateLocalInvestmentWorkspaceDocument,
} from "../../server/utils/local-investment-workspaces"
import { createInvestmentWorkspaceDocument } from "../../shared/utils/investment-workspaces"

const applicant: SessionUser = {
  email: "founder@local.example",
  id: "user_local_investment_founder",
  name: "Local Founder",
  onboardingCompleted: true,
  role: "founder",
  subscriptionPlan: "team",
}

let dataDirectory = ""

function documentFixture() {
  let id = 0
  return createInvestmentWorkspaceDocument(applicant, {
    companyName: "Local Labs",
    opportunityId: "opportunity_local",
    organizationId: null,
  }, {
    createId: prefix => `${prefix}_${++id}`,
    now: "2026-08-08T12:00:00.000Z",
  })
}

describe("local investment workspace persistence", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-investment-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    await clearLocalInvestmentWorkspaceStoreForTests()
  })

  afterEach(async () => {
    await clearLocalInvestmentWorkspaceStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
  })

  it("creates one active workspace per applicant opportunity", async () => {
    const document = documentFixture()
    expect(await createLocalInvestmentWorkspaceDocument(document)).toMatchObject({ id: document.id })
    expect(await createLocalInvestmentWorkspaceDocument({ ...document, id: "investment_workspace_duplicate" })).toBeNull()
    expect(await getLocalInvestmentWorkspaceDocument(document.id)).toMatchObject({ companyName: "Local Labs" })
    expect(await getLocalInvestmentWorkspaceDocumentByApplicationId(document.application.id)).toMatchObject({ id: document.id })
  })

  it("allows a new workspace after the prior application is withdrawn", async () => {
    const document = documentFixture()
    await createLocalInvestmentWorkspaceDocument(document)
    const withdrawn = {
      ...document,
      application: { ...document.application, status: "withdrawn" as const },
      version: 2,
    }
    await updateLocalInvestmentWorkspaceDocument(withdrawn, 1)

    const replacement = {
      ...document,
      application: { ...document.application, id: "investment_application_replacement" },
      id: "investment_workspace_replacement",
    }
    expect(await createLocalInvestmentWorkspaceDocument(replacement)).toMatchObject({ id: replacement.id })
  })

  it("uses the aggregate version as a compare-and-swap boundary", async () => {
    const document = documentFixture()
    await createLocalInvestmentWorkspaceDocument(document)
    const updated = { ...document, status: "fundraising" as const, version: document.version + 1 }

    expect(await updateLocalInvestmentWorkspaceDocument(updated, document.version)).toMatchObject({ status: "fundraising", version: 2 })
    expect(await updateLocalInvestmentWorkspaceDocument({ ...updated, version: 3 }, document.version)).toBeNull()
    expect((await listLocalInvestmentWorkspaceDocuments()).find(item => item.id === document.id)?.version).toBe(2)
  })
})
