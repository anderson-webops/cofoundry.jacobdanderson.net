import type { MemberWorkspaceState } from "../../shared/types/domain"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { cloneValue } from "../../shared/utils/clone"

interface LocalMemberWorkspaceStore {
  members: MemberWorkspaceState[]
  updatedAt: string
  version: 1
}

const localMemberWorkspaceFilename = "member-workspace-state.json"

let writeQueue = Promise.resolve()

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), localMemberWorkspaceFilename)
}

function emptyStore(): LocalMemberWorkspaceStore {
  return {
    members: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

async function readStoreFile() {
  try {
    return await readFile(storePath(), "utf-8")
  }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return null

    throw error
  }
}

async function readStore() {
  const contents = await readStoreFile()
  if (!contents)
    return emptyStore()

  return {
    ...emptyStore(),
    ...JSON.parse(contents),
  } as LocalMemberWorkspaceStore
}

async function writeStore(store: LocalMemberWorkspaceStore) {
  await mkdir(dirname(storePath()), { recursive: true })
  await writeFile(storePath(), `${JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf-8")
}

async function updateStore<T>(updater: (store: LocalMemberWorkspaceStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function readLocalMemberWorkspaceState(userId: string) {
  const store = await readStore()
  const state = store.members.find(member => member.user.id === userId)
  return state ? cloneValue(state) : null
}

export async function persistLocalMemberWorkspaceState(state: MemberWorkspaceState) {
  return updateStore((store) => {
    const nextState = cloneValue(state)
    store.members = [
      nextState,
      ...store.members.filter(member => member.user.id !== state.user.id),
    ]
    return cloneValue(nextState)
  })
}

export async function clearLocalMemberWorkspaceStoreForTests() {
  await rm(storePath(), { force: true })
}
