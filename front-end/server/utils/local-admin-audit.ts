import type { AdminAction, AppRole, Notification, PrivacyRequestStatus, ReportStatus, WorkspaceSeed } from "../../shared/types/domain"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"

interface LocalUserAdminPatch {
  id: string
  role?: AppRole
  suspendedAt?: string | null
  updatedAt: string
  verifiedEmail?: boolean
}

interface LocalReportAdminPatch {
  id: string
  resolutionNotes: string | null
  resolvedAt: string | null
  resolvedByUserId: string | null
  reviewNotes: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  status: ReportStatus
  updatedAt: string
}

interface LocalAdminAuditStore {
  actions: AdminAction[]
  notifications: Notification[]
  reportPatches: LocalReportAdminPatch[]
  updatedAt: string
  userPatches: LocalUserAdminPatch[]
  version: 1
}

const defaultRetentionLimit = 500
const localAdminAuditStoreFilename = "admin-audit.json"

let writeQueue = Promise.resolve()

function rootDataDirectory() {
  if (process.env.COFOUNDRY_LOCAL_DATA_DIR)
    return process.env.COFOUNDRY_LOCAL_DATA_DIR

  return process.cwd().endsWith("/front-end") || process.cwd().endsWith("/back-end")
    ? resolve(process.cwd(), "../.data")
    : resolve(process.cwd(), ".data")
}

function storePath() {
  return resolve(rootDataDirectory(), localAdminAuditStoreFilename)
}

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_ADMIN_AUDIT_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 50), 2000)
}

function emptyStore(): LocalAdminAuditStore {
  return {
    actions: [],
    notifications: [],
    reportPatches: [],
    updatedAt: new Date().toISOString(),
    userPatches: [],
    version: 1,
  }
}

function newestFirst<T extends { createdAt?: string, updatedAt?: string }>(rows: T[]) {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.updatedAt || 0).getTime()
    const rightTime = new Date(right.createdAt || right.updatedAt || 0).getTime()
    return rightTime - leftTime
  })
}

function pruneStore(store: LocalAdminAuditStore): LocalAdminAuditStore {
  const limit = retentionLimit()

  return {
    ...store,
    actions: newestFirst(store.actions).slice(0, limit),
    notifications: newestFirst(store.notifications).slice(0, limit),
    reportPatches: newestFirst(store.reportPatches).slice(0, limit),
    updatedAt: new Date().toISOString(),
    userPatches: newestFirst(store.userPatches).slice(0, limit),
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
  } as LocalAdminAuditStore
}

async function writeStore(store: LocalAdminAuditStore) {
  await mkdir(dirname(storePath()), { recursive: true })
  await writeFile(storePath(), `${JSON.stringify(pruneStore(store), null, 2)}\n`, "utf-8")
}

async function updateStore<T>(updater: (store: LocalAdminAuditStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

export async function recordLocalAdminAction(action: AdminAction) {
  return updateStore((store) => {
    store.actions = [action, ...store.actions.filter(item => item.id !== action.id)]
    return action
  })
}

export async function recordLocalUserNotification(notification: Notification) {
  return updateStore((store) => {
    store.notifications = [notification, ...store.notifications.filter(item => item.id !== notification.id)]
    return notification
  })
}

export async function persistLocalUserSuspension(targetUserId: string, suspendedAt: string | null) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.userPatches.find(row => row.id === targetUserId)
    const row: LocalUserAdminPatch = {
      ...existing,
      id: targetUserId,
      suspendedAt,
      updatedAt: now,
    }

    store.userPatches = [row, ...store.userPatches.filter(item => item.id !== targetUserId)]
    return row
  })
}

export async function persistLocalUserRole(targetUserId: string, role: AppRole) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.userPatches.find(row => row.id === targetUserId)
    const row: LocalUserAdminPatch = {
      ...existing,
      id: targetUserId,
      role,
      updatedAt: now,
    }

    store.userPatches = [row, ...store.userPatches.filter(item => item.id !== targetUserId)]
    return row
  })
}

export async function persistLocalUserEmailVerification(targetUserId: string, verifiedEmail: boolean) {
  return updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.userPatches.find(row => row.id === targetUserId)
    const row: LocalUserAdminPatch = {
      ...existing,
      id: targetUserId,
      updatedAt: now,
      verifiedEmail,
    }

    store.userPatches = [row, ...store.userPatches.filter(item => item.id !== targetUserId)]
    return row
  })
}

export async function persistLocalReportStatus(input: {
  adminUserId: string
  notes: string
  reportId: string
  status: Exclude<PrivacyRequestStatus, "open"> | ReportStatus
  timestamp: string
}) {
  return updateStore((store) => {
    const existing = store.reportPatches.find(row => row.id === input.reportId)
    const row: LocalReportAdminPatch = {
      id: input.reportId,
      resolutionNotes: existing?.resolutionNotes || null,
      resolvedAt: existing?.resolvedAt || null,
      resolvedByUserId: existing?.resolvedByUserId || null,
      reviewNotes: existing?.reviewNotes || null,
      reviewedAt: existing?.reviewedAt || null,
      reviewedByUserId: existing?.reviewedByUserId || null,
      status: input.status === "reviewed" ? "reviewed" : "resolved",
      updatedAt: input.timestamp,
    }

    if (input.status === "reviewed") {
      row.reviewNotes = input.notes
      row.reviewedAt = input.timestamp
      row.reviewedByUserId = input.adminUserId
    }
    else {
      row.resolutionNotes = input.notes
      row.resolvedAt = input.timestamp
      row.resolvedByUserId = input.adminUserId
    }

    store.reportPatches = [row, ...store.reportPatches.filter(item => item.id !== input.reportId)]
    return row
  })
}

export async function readLocalAdminAuditStore() {
  return pruneStore(await readStore())
}

export async function mergeLocalAdminAuditState(seed: WorkspaceSeed) {
  const store = await readLocalAdminAuditStore()
  const userPatchById = new Map(store.userPatches.map(row => [row.id, row]))
  const reportPatchById = new Map(store.reportPatches.map(row => [row.id, row]))
  const localActionIds = new Set(store.actions.map(action => action.id))
  const localNotificationIds = new Set(store.notifications.map(notification => notification.id))

  return {
    ...seed,
    adminActions: [
      ...store.actions,
      ...seed.adminActions.filter(action => !localActionIds.has(action.id)),
    ],
    notifications: [
      ...store.notifications,
      ...seed.notifications.filter(notification => !localNotificationIds.has(notification.id)),
    ],
    reports: seed.reports.map((report) => {
      const patch = reportPatchById.get(report.id)
      return patch
        ? {
            ...report,
            resolutionNotes: patch.resolutionNotes,
            resolvedAt: patch.resolvedAt,
            resolvedByUserId: patch.resolvedByUserId,
            reviewNotes: patch.reviewNotes,
            reviewedAt: patch.reviewedAt,
            reviewedByUserId: patch.reviewedByUserId,
            status: patch.status,
          }
        : report
    }),
    users: seed.users.map((user) => {
      const patch = userPatchById.get(user.id)
      return patch
        ? {
            ...user,
            role: patch.role || user.role,
            suspendedAt: typeof patch.suspendedAt === "undefined" ? user.suspendedAt : patch.suspendedAt,
            verifiedEmail: typeof patch.verifiedEmail === "undefined" ? user.verifiedEmail : patch.verifiedEmail,
          }
        : user
    }),
    profiles: seed.profiles.map((profile) => {
      const user = seed.users.find(row => row.id === profile.userId)
      const patch = userPatchById.get(profile.userId)
      const verifiedEmail = typeof patch?.verifiedEmail === "undefined" ? user?.verifiedEmail : patch.verifiedEmail

      return typeof verifiedEmail === "boolean"
        ? {
            ...profile,
            verificationBadges: {
              ...profile.verificationBadges,
              emailVerified: verifiedEmail,
            },
          }
        : profile
    }),
  } satisfies WorkspaceSeed
}

export async function clearLocalAdminAuditStoreForTests() {
  await rm(storePath(), { force: true })
}
