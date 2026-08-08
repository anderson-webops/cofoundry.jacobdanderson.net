import type { OrganizationWorkspaceDocument } from "../../shared/types/organizations"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { organizationWorkspaceSeedDocuments } from "../../shared/data/organization-seed"
import { cloneValue } from "../../shared/utils/clone"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

interface LocalOrganizationWorkspaceStore {
  documents: OrganizationWorkspaceDocument[]
  updatedAt: string
  version: 1
}

const localFilename = "organization-workspaces.json"
let writeQueue = Promise.resolve()

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), localFilename)
}

function emptyStore(): LocalOrganizationWorkspaceStore {
  return {
    documents: cloneValue(organizationWorkspaceSeedDocuments),
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

async function readStore() {
  const contents = await readPrivateTextFile(storePath())
  if (!contents)
    return emptyStore()

  const parsed = JSON.parse(contents) as Partial<LocalOrganizationWorkspaceStore>
  return {
    ...emptyStore(),
    ...parsed,
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
  } as LocalOrganizationWorkspaceStore
}

async function writeStore(store: LocalOrganizationWorkspaceStore) {
  store.updatedAt = new Date().toISOString()
  await writePrivateFileAtomic(storePath(), `${JSON.stringify(store, null, 2)}\n`)
}

async function updateStore<T>(updater: (store: LocalOrganizationWorkspaceStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function listLocalOrganizationWorkspaceDocuments() {
  return cloneValue((await readStore()).documents)
}

export async function getLocalOrganizationWorkspaceDocument(organizationId: string) {
  const document = (await readStore()).documents.find(item => item.organization.id === organizationId)
  return document ? cloneValue(document) : null
}

export async function createLocalOrganizationWorkspaceDocument(document: OrganizationWorkspaceDocument) {
  return updateStore((store) => {
    if (store.documents.some(item => item.organization.id === document.organization.id || item.organization.slug === document.organization.slug))
      return null
    store.documents.unshift(cloneValue(document))
    return cloneValue(document)
  })
}

export async function updateLocalOrganizationWorkspaceDocument(
  document: OrganizationWorkspaceDocument,
  expectedVersion: number,
) {
  return updateStore((store) => {
    const index = store.documents.findIndex(item => item.organization.id === document.organization.id)
    if (index < 0 || store.documents[index]?.version !== expectedVersion)
      return null
    store.documents.splice(index, 1, cloneValue(document))
    return cloneValue(document)
  })
}

export async function clearLocalOrganizationWorkspaceStoreForTests() {
  await rm(storePath(), { force: true })
}
