import type { SessionUser } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  clearLocalOrganizationWorkspaceStoreForTests,
  createLocalOrganizationWorkspaceDocument,
  getLocalOrganizationWorkspaceDocument,
  listLocalOrganizationWorkspaceDocuments,
  updateLocalOrganizationWorkspaceDocument,
} from "../../server/utils/local-organization-workspaces"
import { createOrganizationWorkspaceDocument } from "../../shared/utils/organizations"

const owner: SessionUser = {
  email: "owner@local.example",
  id: "user_local_organization_owner",
  name: "Local Owner",
  onboardingCompleted: true,
  role: "founder",
  subscriptionPlan: "team",
}

let dataDirectory = ""

function documentFixture() {
  let id = 0
  return createOrganizationWorkspaceDocument(owner, {
    description: "A local organization document used to test private persistence and compare-and-swap updates.",
    kind: "startup_team",
    name: "Local Organization",
    slug: "local-organization",
    website: "https://local.example",
  }, {
    createId: prefix => `${prefix}_${++id}`,
    now: "2026-08-08T12:00:00.000Z",
  })
}

describe("local organization workspace persistence", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-organizations-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    await clearLocalOrganizationWorkspaceStoreForTests()
  })

  afterEach(async () => {
    await clearLocalOrganizationWorkspaceStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
  })

  it("creates private documents and rejects duplicate slugs", async () => {
    const document = documentFixture()
    expect(await createLocalOrganizationWorkspaceDocument(document)).toMatchObject({
      organization: { id: document.organization.id },
    })
    expect(await createLocalOrganizationWorkspaceDocument({
      ...document,
      organization: { ...document.organization, id: "organization_duplicate" },
    })).toBeNull()
    expect(await getLocalOrganizationWorkspaceDocument(document.organization.id)).toMatchObject({
      organization: { slug: "local-organization" },
    })
  })

  it("uses the document version as a compare-and-swap boundary", async () => {
    const document = documentFixture()
    await createLocalOrganizationWorkspaceDocument(document)
    const updated = {
      ...document,
      organization: { ...document.organization, name: "Updated Organization" },
      version: document.version + 1,
    }

    expect(await updateLocalOrganizationWorkspaceDocument(updated, document.version)).toMatchObject({
      organization: { name: "Updated Organization" },
      version: 2,
    })
    expect(await updateLocalOrganizationWorkspaceDocument({ ...updated, version: 3 }, document.version)).toBeNull()
    expect((await listLocalOrganizationWorkspaceDocuments()).find(item => item.organization.id === document.organization.id)?.version).toBe(2)
  })
})
