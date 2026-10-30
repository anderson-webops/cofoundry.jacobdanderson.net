import type { AdminAction, AppRole, Notification, OpportunityVerificationStatus, ReportStatus, WorkspaceSeed } from "../../shared/types/domain"
import type { AdminSecurityMutation } from "../../shared/utils/admin-authorization"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { workspaceSeed } from "../../shared/data/seed"
import { evaluateAdminSecurityMutation } from "../../shared/utils/admin-authorization"
import { withLocalAdminSecurityLock } from "./local-admin-security-lock"
import { findLocalReportById } from "./local-collaboration-store"
import { readLocalMemberWorkspaceStates } from "./local-member-workspace"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"

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

interface LocalOpportunityAdminPatch {
  id: string
  reviewedAt: string
  reviewedByUserId: string
  reviewNotes: string
  status: Exclude<OpportunityVerificationStatus, "manual_review">
  updatedAt: string
}

interface LocalAdminAuditStore {
  actions: AdminAction[]
  notifications: Notification[]
  opportunityPatches: LocalOpportunityAdminPatch[]
  reportPatches: LocalReportAdminPatch[]
  updatedAt: string
  userPatches: LocalUserAdminPatch[]
  version: 1
}

const defaultRetentionLimit = 500
const localAdminAuditStoreFilename = "admin-audit.json"
const queueActionTypes = new Set<AdminAction["type"]>(["assign_case", "escalate_case", "review_evidence"])

let writeQueue = Promise.resolve()
let cachedStore: LocalAdminAuditStore | null = null
let cachedStorePath: string | null = null

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

  return Math.min(Math.max(configuredLimit, 1), 2000)
}

function emptyStore(): LocalAdminAuditStore {
  return {
    actions: [],
    notifications: [],
    opportunityPatches: [],
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
    opportunityPatches: newestFirst(store.opportunityPatches).slice(0, limit),
    reportPatches: newestFirst(store.reportPatches).slice(0, limit),
    updatedAt: new Date().toISOString(),
    userPatches: newestFirst(store.userPatches).slice(0, limit),
  }
}

async function readStoreFile() {
  return readPrivateTextFile(storePath())
}

async function readStore() {
  const path = storePath()
  if (cachedStore && cachedStorePath === path)
    return cachedStore

  const contents = await readStoreFile()
  if (!contents) {
    cachedStore = emptyStore()
    cachedStorePath = path
    return cachedStore
  }

  cachedStore = {
    ...emptyStore(),
    ...JSON.parse(contents),
  } as LocalAdminAuditStore
  cachedStorePath = path
  return cachedStore
}

async function writeStore(store: LocalAdminAuditStore) {
  const path = storePath()
  const prunedStore = pruneStore(store)

  await writePrivateFileAtomic(path, `${JSON.stringify(prunedStore)}\n`)
  cachedStore = prunedStore
  cachedStorePath = path
}

async function updateStore<T>(updater: (_store: LocalAdminAuditStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function buildLocalAdminSecurityUsers(
  localStates: Awaited<ReturnType<typeof readLocalMemberWorkspaceStates>>,
  store: LocalAdminAuditStore,
) {
  const patchById = new Map(store.userPatches.map(row => [row.id, row]))
  const localUserIds = new Set(localStates.map(state => state.user.id))

  return [
    ...localStates.map(state => state.user),
    ...workspaceSeed.users.filter(user => !localUserIds.has(user.id)),
  ].map((user) => {
    const patch = patchById.get(user.id)
    return {
      id: user.id,
      role: patch?.role || user.role,
      suspendedAt: typeof patch?.suspendedAt === "undefined"
        ? user.suspendedAt
        : patch.suspendedAt,
      verifiedEmail: typeof patch?.verifiedEmail === "undefined"
        ? user.verifiedEmail
        : patch.verifiedEmail,
    }
  })
}

export async function assertLocalAdminActor(
  actorUserId: string,
  allowedRoles: readonly AppRole[] = ["admin"],
) {
  const localStates = await readLocalMemberWorkspaceStates()
  const actor = buildLocalAdminSecurityUsers(localStates, await readStore())
    .find(user => user.id === actorUserId)

  if (!actor || actor.suspendedAt || !actor.verifiedEmail || !allowedRoles.includes(actor.role)) {
    const fullAdminOnly = allowedRoles.length === 1 && allowedRoles[0] === "admin"
    throw Object.assign(new Error(
      fullAdminOnly
        ? "An active full admin account is required for this action."
        : "An active admin account is required for this action.",
    ), {
      statusCode: 403,
      statusMessage: fullAdminOnly
        ? "An active full admin account is required for this action."
        : "An active admin account is required for this action.",
    })
  }

  return actor
}

export async function recordLocalAdminQueueAction(action: AdminAction) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(action.adminUserId)

    return updateStore((store) => {
      if (!queueActionTypes.has(action.type)) {
        throw Object.assign(new Error("The requested queue action is invalid."), {
          statusCode: 400,
          statusMessage: "The requested queue action is invalid.",
        })
      }

      store.actions = [
        action,
        ...store.actions.filter(item => item.id !== action.id)
      ]
      return action
    })
  })
}

export async function recordLocalUserNotification(notification: Notification) {
  return updateStore((store) => {
    store.notifications = [
      notification,
      ...store.notifications.filter(item => item.id !== notification.id)
    ]
    return notification
  })
}

export async function persistLocalAdminUserSecurityAction(input: {
  action: AdminAction
  mutation: AdminSecurityMutation
}) {
  return withLocalAdminSecurityLock(async () => {
    const localStates = await readLocalMemberWorkspaceStates()

    return updateStore((store) => {
      const users = buildLocalAdminSecurityUsers(localStates, store)
      const decision = evaluateAdminSecurityMutation(users, input.action.adminUserId, input.action.targetId, input.mutation)
      if (!decision.allowed) {
        throw Object.assign(new Error(decision.statusMessage), {
          statusCode: decision.statusCode,
          statusMessage: decision.statusMessage,
        })
      }

      const existing = store.userPatches.find(row => row.id === input.action.targetId)
      const row: LocalUserAdminPatch = {
        ...existing,
        id: input.action.targetId,
        updatedAt: input.action.createdAt,
      }
      if (input.mutation.kind === "change_role") {
        row.role = input.mutation.role
      }
      else if (input.mutation.kind === "change_status") {
        row.suspendedAt = input.mutation.action === "suspend"
          ? input.action.createdAt
          : null
      }
      else {
        row.verifiedEmail = true
      }

      store.userPatches = [
        row,
        ...store.userPatches.filter(item => item.id !== input.action.targetId)
      ]
      store.actions = [
        input.action,
        ...store.actions.filter(item => item.id !== input.action.id)
      ]
      return row
    })
  })
}

export async function persistLocalReportStatusAction(input: {
  action: AdminAction
  expectedStatus: "open" | "reviewed"
  status: ReportStatus
}) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(input.action.adminUserId)
    const sourceReport = await findLocalReportById(input.action.targetId)
      || workspaceSeed.reports.find(report => report.id === input.action.targetId)

    return updateStore((store) => {
      const existing = store.reportPatches.find(row => row.id === input.action.targetId)
      const currentStatus = existing?.status || sourceReport?.status

      if (!sourceReport || !currentStatus) {
        throw Object.assign(new Error("Target report was not found."), {
          statusCode: 404,
          statusMessage: "Target report was not found.",
        })
      }

      if (currentStatus !== input.expectedStatus) {
        throw Object.assign(new Error("The report changed after this review began. Refresh and review the current state."), {
          statusCode: 409,
          statusMessage: "The report changed after this review began. Refresh and review the current state.",
        })
      }

      if (input.status === "reviewed" && currentStatus !== "open") {
        throw Object.assign(new Error("The requested report transition is invalid."), {
          statusCode: 409,
          statusMessage: "The requested report transition is invalid.",
        })
      }

      const row: LocalReportAdminPatch = {
        id: input.action.targetId,
        resolutionNotes: existing?.resolutionNotes || null,
        resolvedAt: existing?.resolvedAt || null,
        resolvedByUserId: existing?.resolvedByUserId || null,
        reviewNotes: existing?.reviewNotes || null,
        reviewedAt: existing?.reviewedAt || null,
        reviewedByUserId: existing?.reviewedByUserId || null,
        status: input.status,
        updatedAt: input.action.createdAt,
      }

      if (input.status === "reviewed") {
        row.reviewNotes = input.action.notes
        row.reviewedAt = input.action.createdAt
        row.reviewedByUserId = input.action.adminUserId
      }
      else {
        row.reviewNotes ||= input.action.notes
        row.reviewedAt ||= input.action.createdAt
        row.reviewedByUserId ||= input.action.adminUserId
        row.resolutionNotes = input.action.notes
        row.resolvedAt = input.action.createdAt
        row.resolvedByUserId = input.action.adminUserId
      }

      store.reportPatches = [
        row,
        ...store.reportPatches.filter(item => item.id !== input.action.targetId)
      ]
      store.actions = [
        input.action,
        ...store.actions.filter(item => item.id !== input.action.id)
      ]
      return {
        id: row.id,
        reporterUserId: sourceReport.reporterUserId,
        status: row.status,
      }
    })
  })
}

export async function persistLocalOpportunityVerificationAction(input: {
  action: AdminAction
  expectedUpdatedAt: string
  status: Exclude<OpportunityVerificationStatus, "manual_review">
}) {
  return withLocalAdminSecurityLock(async () => {
    await assertLocalAdminActor(input.action.adminUserId, ["admin", "investor_admin"])
    const localStates = await readLocalMemberWorkspaceStates()
    const localOpportunities = localStates.flatMap(state => state.opportunities)
    const target = localOpportunities.find(item => item.id === input.action.targetId)
      || workspaceSeed.opportunities.find(item => item.id === input.action.targetId)

    return updateStore((store) => {
      const existingPatch = store.opportunityPatches.find(item => item.id === input.action.targetId)
      const currentUpdatedAt = existingPatch?.updatedAt || target?.updatedAt

      if (!target || !currentUpdatedAt) {
        throw Object.assign(new Error("Target opportunity was not found."), {
          statusCode: 404,
          statusMessage: "Target opportunity was not found.",
        })
      }

      if (currentUpdatedAt !== input.expectedUpdatedAt) {
        throw Object.assign(new Error("The opportunity changed after this review began. Refresh and review the current revision."), {
          statusCode: 409,
          statusMessage: "The opportunity changed after this review began. Refresh and review the current revision.",
        })
      }

      const row: LocalOpportunityAdminPatch = {
        id: input.action.targetId,
        reviewedAt: input.action.createdAt,
        reviewedByUserId: input.action.adminUserId,
        reviewNotes: input.action.notes,
        status: input.status,
        updatedAt: input.action.createdAt,
      }

      store.opportunityPatches = [
        row,
        ...store.opportunityPatches.filter(item => item.id !== input.action.targetId)
      ]
      store.actions = [
        input.action,
        ...store.actions.filter(item => item.id !== input.action.id)
      ]
      return row
    })
  })
}

export async function readLocalAdminAuditStore() {
  return pruneStore(await readStore())
}

export async function mergeLocalAdminAuditState(seed: WorkspaceSeed) {
  const store = await readLocalAdminAuditStore()
  const opportunityPatchById = new Map(store.opportunityPatches.map(row => [row.id, row]))
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
    opportunities: seed.opportunities.map((opportunity) => {
      const patch = opportunityPatchById.get(opportunity.id)
      return patch
        ? {
            ...opportunity,
            updatedAt: patch.updatedAt,
            verificationStatus: patch.status,
          }
        : opportunity
    }),
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
            suspendedAt: typeof patch.suspendedAt === "undefined"
              ? user.suspendedAt
              : patch.suspendedAt,
            verifiedEmail: typeof patch.verifiedEmail === "undefined"
              ? user.verifiedEmail
              : patch.verifiedEmail,
          }
        : user
    }),
    profiles: seed.profiles.map((profile) => {
      const user = seed.users.find(row => row.id === profile.userId)
      const patch = userPatchById.get(profile.userId)
      const verifiedEmail = typeof patch?.verifiedEmail === "undefined"
        ? user?.verifiedEmail
        : patch.verifiedEmail

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
  await writeQueue
  cachedStore = null
  cachedStorePath = null
  await rm(storePath(), { force: true })
}
