import type { InvestmentWorkspaceDocument } from "../../shared/types/investment-workspaces"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { investmentWorkspaceSeedDocuments } from "../../shared/data/investment-workspace-seed"
import { cloneValue } from "../../shared/utils/clone"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

interface LocalInvestmentWorkspaceStore {
  documents: InvestmentWorkspaceDocument[]
  updatedAt: string
  version: 1
}

const localFilename = "investment-workspaces.json"
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

function emptyStore(): LocalInvestmentWorkspaceStore {
  return {
    documents: cloneValue(investmentWorkspaceSeedDocuments),
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

async function readStore() {
  const contents = await readPrivateTextFile(storePath())
  if (!contents)
    return emptyStore()

  const parsed = JSON.parse(contents) as Partial<LocalInvestmentWorkspaceStore>
  return {
    ...emptyStore(),
    ...parsed,
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
  } as LocalInvestmentWorkspaceStore
}

async function writeStore(store: LocalInvestmentWorkspaceStore) {
  store.updatedAt = new Date().toISOString()
  await writePrivateFileAtomic(storePath(), `${JSON.stringify(store, null, 2)}\n`)
}

async function updateStore<T>(updater: (store: LocalInvestmentWorkspaceStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function listLocalInvestmentWorkspaceDocuments() {
  return cloneValue((await readStore()).documents)
}

export async function getLocalInvestmentWorkspaceDocument(workspaceId: string) {
  const document = (await readStore()).documents.find(item => item.id === workspaceId)
  return document ? cloneValue(document) : null
}

export async function getLocalInvestmentWorkspaceDocumentByApplicationId(applicationId: string) {
  const document = (await readStore()).documents.find(item => item.application.id === applicationId)
  return document ? cloneValue(document) : null
}

export async function createLocalInvestmentWorkspaceDocument(document: InvestmentWorkspaceDocument) {
  return updateStore((store) => {
    const duplicate = store.documents.some(item => item.id === document.id || (
      item.applicantUserId === document.applicantUserId
      && item.opportunityId === document.opportunityId
      && !["declined", "withdrawn", "closed"].includes(item.application.status)
    ))
    if (duplicate)
      return null
    store.documents.unshift(cloneValue(document))
    return cloneValue(document)
  })
}

export async function updateLocalInvestmentWorkspaceDocument(
  document: InvestmentWorkspaceDocument,
  expectedVersion: number,
) {
  return updateStore((store) => {
    const index = store.documents.findIndex(item => item.id === document.id)
    if (index < 0 || store.documents[index]?.version !== expectedVersion)
      return null
    store.documents.splice(index, 1, cloneValue(document))
    return cloneValue(document)
  })
}

export async function clearLocalInvestmentWorkspaceStoreForTests() {
  await rm(storePath(), { force: true })
}
