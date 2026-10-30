import type { SessionUser } from "../../shared/types/domain"
import { Buffer } from "node:buffer"
import { randomUUID, scrypt, timingSafeEqual } from "node:crypto"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { promisify } from "node:util"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

interface LocalAuthAccountRow {
  created_at: string
  email: string
  id: string
  name: string
  onboarding_completed: boolean
  password_hash: string
  role: SessionUser["role"]
  updated_at: string
}

interface LocalAuthStore {
  accounts: LocalAuthAccountRow[]
  updatedAt: string
  version: 1
}

const scryptAsync = promisify(scrypt)
const localAuthStoreFilename = "local-auth-accounts.json"
const missingAccountScryptSalt = "cofoundry-missing-account-timing-salt"
let writeQueue = Promise.resolve()

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), localAuthStoreFilename)
}

function emptyStore(): LocalAuthStore {
  return {
    accounts: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

async function readStoreFile() {
  return readPrivateTextFile(storePath())
}

async function readStore() {
  const contents = await readStoreFile()
  if (!contents)
    return emptyStore()

  return {
    ...emptyStore(),
    ...JSON.parse(contents),
  } as LocalAuthStore
}

async function writeStore(store: LocalAuthStore) {
  await writePrivateFileAtomic(storePath(), `${JSON.stringify({
    ...store,
    updatedAt: new Date().toISOString()
  }, null, 2)}\n`)
}

async function updateStore<T>(updater: (_store: LocalAuthStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function toSession(row: LocalAuthAccountRow): SessionUser {
  return {
    email: row.email,
    id: row.id,
    name: row.name,
    onboardingCompleted: row.onboarding_completed,
    role: row.role,
    subscriptionPlan: "free",
  }
}

async function hashPassword(password: string) {
  const salt = randomUUID().replaceAll("-", "")
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  return `scrypt:${salt}:${derivedKey.toString("base64url")}`
}

async function verifyPassword(password: string, encodedHash: string) {
  const [, salt, storedHash] = encodedHash.split(":")
  if (!salt || !storedHash)
    return false

  const left = Buffer.from(storedHash, "base64url")
  const right = await scryptAsync(password, salt, 64) as Buffer

  return left.length === right.length && timingSafeEqual(left, right)
}

export async function createLocalAuthAccount(payload: { email: string, name: string, password: string }) {
  const email = normalizeEmail(payload.email)

  return updateStore(async (store) => {
    const existing = store.accounts.find(account => account.email === email)
    if (existing)
      return null

    const now = new Date().toISOString()
    const row: LocalAuthAccountRow = {
      created_at: now,
      email,
      id: `user_${randomUUID().replaceAll("-", "")}`,
      name: payload.name.trim(),
      onboarding_completed: false,
      password_hash: await hashPassword(payload.password),
      role: "founder",
      updated_at: now,
    }

    store.accounts = [row, ...store.accounts]
    return toSession(row)
  })
}

export async function deleteLocalAuthAccount(id: string) {
  return updateStore((store) => {
    const previousLength = store.accounts.length
    store.accounts = store.accounts.filter(account => account.id !== id)
    return store.accounts.length !== previousLength
  })
}

export async function findLocalAuthSessionByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email)
  const account = (await readStore()).accounts.find(row => row.email === normalizedEmail)
  return account
    ? toSession(account)
    : null
}

export async function findLocalAuthSessionById(id: string) {
  const account = (await readStore()).accounts.find(row => row.id === id)
  return account
    ? toSession(account)
    : null
}

export async function verifyLocalAuthCredentials(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email)
  const account = (await readStore()).accounts.find(row => row.email === normalizedEmail)

  if (!account) {
    await scryptAsync(password, missingAccountScryptSalt, 64)
    return null
  }

  if (!(await verifyPassword(password, account.password_hash)))
    return null

  return toSession(account)
}

export async function updateLocalAuthOnboarding(session: SessionUser) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const account = store.accounts.find(row => row.id === session.id)
    if (!account)
      return null

    account.name = session.name
    account.onboarding_completed = session.onboardingCompleted
    account.role = session.role
    account.updated_at = now
    return toSession(account)
  })
}

export async function clearLocalAuthStoreForTests() {
  await rm(storePath(), { force: true })
}
