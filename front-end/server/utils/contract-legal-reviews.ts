import type { H3Event } from "h3"
import type { ContractLegalReview } from "../../shared/types/domain"
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"
import { createError } from "h3"
import { cloneValue } from "../../shared/utils/clone"
import { readPrivateTextFile, writePrivateFileAtomic } from "./private-file-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

interface PersistedContractLegalReviewRow {
  id: string
  contract_id: string
  contract_version_id: string
  requested_by_user_id: string
  reviewer_type: ContractLegalReview["reviewerType"]
  reviewer_name: string
  reviewer_email: string
  reviewer_organization: string
  review_scope: ContractLegalReview["scope"]
  message: string
  status: ContractLegalReview["status"]
  reviewer_response: string | null
  responded_by_name: string | null
  opened_at: string | null
  responded_at: string | null
  canceled_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

interface LocalContractLegalReviewStore {
  reviews: ContractLegalReview[]
  updatedAt: string
  version: 1
}

const localFilename = "contract-legal-reviews.json"
const defaultRetentionLimit = 5000
const activeDuplicateStatuses = new Set<ContractLegalReview["status"]>(["requested", "opened", "changes_requested"])
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

function retentionLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_CONTRACT_LEGAL_REVIEW_RETENTION_LIMIT || "", 10)
  if (Number.isNaN(configuredLimit))
    return defaultRetentionLimit

  return Math.min(Math.max(configuredLimit, 100), 10000)
}

function emptyStore(): LocalContractLegalReviewStore {
  return {
    reviews: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  }
}

async function readStore() {
  const contents = await readPrivateTextFile(storePath())
  if (!contents)
    return emptyStore()

  const parsed = JSON.parse(contents) as Partial<LocalContractLegalReviewStore>
  return {
    ...emptyStore(),
    ...parsed,
    reviews: Array.isArray(parsed.reviews)
      ? parsed.reviews.map(review => ({ ...review, respondedByName: review.respondedByName || null }))
      : [],
  }
}

async function writeStore(store: LocalContractLegalReviewStore) {
  store.updatedAt = new Date().toISOString()
  const now = Date.now()
  const sorted = [...store.reviews]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  const active = sorted.filter(review => review.status === "changes_requested"
    || (["requested", "opened"].includes(review.status) && new Date(review.expiresAt).getTime() > now))
  const activeIds = new Set(active.map(review => review.id))
  const terminal = sorted.filter(review => !activeIds.has(review.id))
  store.reviews = [
    ...active,
    ...terminal.slice(0, Math.max(retentionLimit() - active.length, 0)),
  ]
  await writePrivateFileAtomic(storePath(), `${JSON.stringify(store, null, 2)}\n`)
}

async function updateStore<T>(updater: (store: LocalContractLegalReviewStore) => T | Promise<T>) {
  const run = writeQueue.then(async () => {
    const store = await readStore()
    const result = await updater(store)
    await writeStore(store)
    return result
  })

  writeQueue = run.then(() => undefined, () => undefined)
  return run
}

function fromRow(row: PersistedContractLegalReviewRow): ContractLegalReview {
  return {
    id: row.id,
    contractId: row.contract_id,
    contractVersionId: row.contract_version_id,
    requestedByUserId: row.requested_by_user_id,
    reviewerType: row.reviewer_type,
    reviewerName: row.reviewer_name,
    reviewerEmail: row.reviewer_email,
    reviewerOrganization: row.reviewer_organization,
    scope: row.review_scope || [],
    message: row.message,
    status: row.status,
    reviewerResponse: row.reviewer_response,
    respondedByName: row.responded_by_name,
    openedAt: row.opened_at,
    respondedAt: row.responded_at,
    canceledAt: row.canceled_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toRow(review: ContractLegalReview): PersistedContractLegalReviewRow {
  return {
    id: review.id,
    contract_id: review.contractId,
    contract_version_id: review.contractVersionId,
    requested_by_user_id: review.requestedByUserId,
    reviewer_type: review.reviewerType,
    reviewer_name: review.reviewerName,
    reviewer_email: review.reviewerEmail,
    reviewer_organization: review.reviewerOrganization,
    review_scope: review.scope,
    message: review.message,
    status: review.status,
    reviewer_response: review.reviewerResponse,
    responded_by_name: review.respondedByName,
    opened_at: review.openedAt,
    responded_at: review.respondedAt,
    canceled_at: review.canceledAt,
    expires_at: review.expiresAt,
    created_at: review.createdAt,
    updated_at: review.updatedAt,
  }
}

function conflict(message = "This legal review changed after the action began. Refresh and try again.") {
  return createError({ statusCode: 409, statusMessage: message })
}

export async function listContractLegalReviews(event: H3Event, contractId: string) {
  if (!isSupabaseEnabled(event)) {
    const store = await readStore()
    return store.reviews.filter(review => review.contractId === contractId)
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return ((data || []) as PersistedContractLegalReviewRow[]).map(fromRow)
}

export async function listContractLegalReviewsForContracts(event: H3Event, contractIds: string[]) {
  if (!contractIds.length)
    return []

  if (!isSupabaseEnabled(event)) {
    const contractIdSet = new Set(contractIds)
    const store = await readStore()
    return store.reviews.filter(review => contractIdSet.has(review.contractId))
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .select("*")
    .in("contract_id", contractIds)
    .order("created_at", { ascending: false })

  if (error)
    throw error

  return ((data || []) as PersistedContractLegalReviewRow[]).map(fromRow)
}

export async function listContractLegalReviewsForReviewerEmail(event: H3Event, reviewerEmail: string) {
  const normalizedEmail = reviewerEmail.trim().toLowerCase()
  if (!normalizedEmail)
    return []

  if (!isSupabaseEnabled(event)) {
    const store = await readStore()
    return store.reviews
      .filter(review => review.reviewerEmail.trim().toLowerCase() === normalizedEmail)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .select("*")
    .eq("reviewer_email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error)
    throw error

  return ((data || []) as PersistedContractLegalReviewRow[]).map(fromRow)
}

export async function getContractLegalReview(event: H3Event, reviewId: string) {
  if (!isSupabaseEnabled(event)) {
    const store = await readStore()
    return store.reviews.find(review => review.id === reviewId) || null
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle()

  if (error)
    throw error

  return data
    ? fromRow(data as PersistedContractLegalReviewRow)
    : null
}

export async function createContractLegalReview(event: H3Event, review: ContractLegalReview) {
  const normalizedReview = {
    ...cloneValue(review),
    reviewerEmail: review.reviewerEmail.trim().toLowerCase(),
  }

  if (!isSupabaseEnabled(event)) {
    return updateStore((store) => {
      const duplicate = store.reviews.some(existing =>
        existing.contractVersionId === normalizedReview.contractVersionId
        && existing.reviewerEmail.toLowerCase() === normalizedReview.reviewerEmail
        && activeDuplicateStatuses.has(existing.status),
      )
      if (duplicate)
        throw conflict("An active review invite already exists for this reviewer and agreement version.")

      store.reviews.unshift(normalizedReview)
      return cloneValue(normalizedReview)
    })
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .insert(toRow(normalizedReview))
    .select("*")
    .single()

  if (error?.code === "23505")
    throw conflict("An active review invite already exists for this reviewer and agreement version.")
  if (error)
    throw error

  return fromRow(data as PersistedContractLegalReviewRow)
}

export async function updateContractLegalReview(
  event: H3Event,
  current: ContractLegalReview,
  patch: Partial<ContractLegalReview>,
) {
  const next = {
    ...cloneValue(current),
    ...cloneValue(patch),
  }

  if (!isSupabaseEnabled(event)) {
    return updateStore((store) => {
      const index = store.reviews.findIndex(review => review.id === current.id)
      const existing = index >= 0
        ? store.reviews[index]
        : null
      if (!existing || existing.updatedAt !== current.updatedAt || existing.status !== current.status)
        throw conflict()

      store.reviews.splice(index, 1, next)
      return cloneValue(next)
    })
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const row = toRow(next)
  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .update({
      canceled_at: row.canceled_at,
      expires_at: row.expires_at,
      message: row.message,
      opened_at: row.opened_at,
      responded_at: row.responded_at,
      responded_by_name: row.responded_by_name,
      reviewer_response: row.reviewer_response,
      status: row.status,
      updated_at: row.updated_at,
    })
    .eq("id", current.id)
    .eq("status", current.status)
    .eq("updated_at", current.updatedAt)
    .select("*")
    .maybeSingle()

  if (error)
    throw error
  if (!data)
    throw conflict()

  return fromRow(data as PersistedContractLegalReviewRow)
}

export async function supersedeContractLegalReviews(
  event: H3Event,
  contractId: string,
  currentVersionId: string,
  updatedAt: string,
) {
  const supersedableStatuses: ContractLegalReview["status"][] = [
    "requested",
    "opened",
    "changes_requested",
    "approved"
  ]

  if (!isSupabaseEnabled(event)) {
    return updateStore((store) => {
      let count = 0
      store.reviews = store.reviews.map((review) => {
        if (review.contractId !== contractId || review.contractVersionId === currentVersionId || !supersedableStatuses.includes(review.status))
          return review

        count += 1
        return { ...review, status: "superseded" as const, updatedAt }
      })
      return count
    })
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_legal_reviews")
    .update({ status: "superseded", updated_at: updatedAt })
    .eq("contract_id", contractId)
    .neq("contract_version_id", currentVersionId)
    .in("status", supersedableStatuses)
    .select("id")

  if (error)
    throw error

  return data?.length || 0
}

export async function clearContractLegalReviewStoreForTests() {
  await rm(storePath(), { force: true })
}
