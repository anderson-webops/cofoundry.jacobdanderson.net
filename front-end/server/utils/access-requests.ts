import type { H3Event } from "h3"
import type { z } from "zod"
import type { AccessRequest } from "~/shared/types/domain"
import type { accessRequestSchema } from "~/shared/utils/validation"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import process from "node:process"
import {
  createLocalAccessInvite,
  createLocalAccessRequest,
  listLocalAccessRequests,
  markLocalAccessInviteAccepted,
  updateLocalAccessRequestStatus,
  validateLocalAccessInvite,
} from "./local-access-requests"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type AccessRequestPayload = z.infer<typeof accessRequestSchema>

interface SupabaseAccessRequestRow {
  admin_notes: string | null
  company: string
  company_stage: AccessRequest["companyStage"]
  created_at: string
  email: string
  id: string
  invite_accepted_at: string | null
  invite_expires_at: string | null
  invite_token_hash: string | null
  invite_token_issued_at: string | null
  name: string
  reviewed_at: string | null
  reviewed_by_user_id: string | null
  role: AccessRequest["role"]
  source: string
  status: AccessRequest["status"]
  timeline: AccessRequest["timeline"]
  updated_at: string
  use_case: string
}

const inviteLifetimeDays = 30
const defaultListLimit = 500

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("base64url")
}

function listLimit() {
  const configuredLimit = Number.parseInt(process.env.COFOUNDRY_ACCESS_REQUEST_RETENTION_LIMIT || "", 10)

  if (Number.isNaN(configuredLimit))
    return defaultListLimit

  return Math.min(Math.max(configuredLimit, 50), 2000)
}

function toAccessRequest(row: SupabaseAccessRequestRow): AccessRequest {
  return {
    adminNotes: row.admin_notes,
    company: row.company,
    companyStage: row.company_stage,
    createdAt: row.created_at,
    email: row.email,
    id: row.id,
    inviteAcceptedAt: row.invite_accepted_at,
    inviteExpiresAt: row.invite_expires_at,
    inviteTokenIssuedAt: row.invite_token_issued_at,
    name: row.name,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    role: row.role,
    source: row.source,
    status: row.status,
    timeline: row.timeline,
    updatedAt: row.updated_at,
    useCase: row.use_case,
  }
}

function createInviteUrl(appUrl: string, token: string, email: string) {
  return `${appUrl.replace(/\/+$/, "")}/auth/sign-up?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
}

function requireSupabaseAdmin(event: H3Event) {
  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  return adminClient
}

export async function createAccessRequest(event: H3Event, payload: AccessRequestPayload) {
  if (!isSupabaseEnabled(event))
    return createLocalAccessRequest(payload)

  const adminClient = requireSupabaseAdmin(event)
  const email = normalizeEmail(payload.email)
  const now = new Date().toISOString()
  const { data: existingRows, error: existingError } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("email", email)
    .neq("status", "denied")
    .is("invite_accepted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (existingError)
    throw existingError

  const existing = (existingRows?.[0] || null) as SupabaseAccessRequestRow | null
  const patch = {
    company: payload.company?.trim() || "",
    company_stage: payload.companyStage,
    email,
    name: payload.name.trim(),
    role: payload.role,
    source: payload.source?.trim() || "site",
    timeline: payload.timeline,
    updated_at: now,
    use_case: payload.useCase.trim(),
  }

  if (existing) {
    const { data, error } = await adminClient
      .from("access_requests")
      .update(patch)
      .eq("id", existing.id)
      .select("*")
      .single()

    if (error)
      throw error

    return toAccessRequest(data as SupabaseAccessRequestRow)
  }

  const { data, error } = await adminClient
    .from("access_requests")
    .insert({
      ...patch,
      created_at: now,
      id: `access_${randomUUID().replaceAll("-", "")}`,
      status: "open",
    })
    .select("*")
    .single()

  if (error)
    throw error

  return toAccessRequest(data as SupabaseAccessRequestRow)
}

export async function listAccessRequests(event: H3Event) {
  if (!isSupabaseEnabled(event))
    return listLocalAccessRequests()

  const adminClient = requireSupabaseAdmin(event)
  const { data, error } = await adminClient
    .from("access_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(listLimit())

  if (error)
    throw error

  return ((data || []) as SupabaseAccessRequestRow[]).map(toAccessRequest)
}

export async function updateAccessRequestStatus(event: H3Event, id: string, payload: { adminNotes: string, reviewedByUserId: string, status: "approved" | "denied" | "open" }) {
  if (!isSupabaseEnabled(event))
    return updateLocalAccessRequestStatus(id, payload)

  const adminClient = requireSupabaseAdmin(event)
  const now = new Date().toISOString()
  const { data, error } = await adminClient
    .from("access_requests")
    .update({
      admin_notes: payload.adminNotes,
      reviewed_at: now,
      reviewed_by_user_id: payload.reviewedByUserId,
      status: payload.status,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error)
    throw error

  return data ? toAccessRequest(data as SupabaseAccessRequestRow) : null
}

export async function createAccessInvite(event: H3Event, id: string, payload: { adminNotes: string, appUrl: string, reviewedByUserId: string }) {
  if (!isSupabaseEnabled(event))
    return createLocalAccessInvite(id, payload)

  const adminClient = requireSupabaseAdmin(event)
  const token = randomBytes(32).toString("base64url")
  const now = new Date()
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + inviteLifetimeDays)

  const { data, error } = await adminClient
    .from("access_requests")
    .update({
      admin_notes: payload.adminNotes,
      invite_accepted_at: null,
      invite_expires_at: expiresAt.toISOString(),
      invite_token_hash: tokenHash(token),
      invite_token_issued_at: now.toISOString(),
      reviewed_at: now.toISOString(),
      reviewed_by_user_id: payload.reviewedByUserId,
      status: "invited",
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle()

  if (error)
    throw error

  if (!data)
    return null

  const request = toAccessRequest(data as SupabaseAccessRequestRow)
  return {
    inviteToken: token,
    inviteUrl: createInviteUrl(payload.appUrl, token, request.email),
    request,
  }
}

export async function validateAccessInvite(event: H3Event, token: string, email?: string) {
  if (!isSupabaseEnabled(event))
    return validateLocalAccessInvite(token, email)

  const adminClient = requireSupabaseAdmin(event)
  const normalizedEmail = email ? normalizeEmail(email) : ""
  const { data, error } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("invite_token_hash", tokenHash(token.trim()))
    .maybeSingle()

  if (error)
    throw error

  const request = data ? toAccessRequest(data as SupabaseAccessRequestRow) : null
  if (!request || request.status !== "invited")
    return null

  if (normalizedEmail && request.email !== normalizedEmail)
    return null

  if (request.inviteAcceptedAt)
    return null

  if (!request.inviteExpiresAt || new Date(request.inviteExpiresAt).getTime() < Date.now())
    return null

  return request
}

export async function markAccessInviteAccepted(event: H3Event, token: string) {
  if (!isSupabaseEnabled(event))
    return markLocalAccessInviteAccepted(token)

  const adminClient = requireSupabaseAdmin(event)
  const now = new Date().toISOString()
  const { data, error } = await adminClient
    .from("access_requests")
    .update({
      invite_accepted_at: now,
      updated_at: now,
    })
    .eq("invite_token_hash", tokenHash(token.trim()))
    .select("*")
    .maybeSingle()

  if (error)
    throw error

  return data ? toAccessRequest(data as SupabaseAccessRequestRow) : null
}
