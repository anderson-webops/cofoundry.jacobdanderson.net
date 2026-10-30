import type { H3Event } from "h3"
import type { z } from "zod"
import type { AccessRequest, AdminAction } from "~/shared/types/domain"
import type { accessRequestSchema } from "~/shared/utils/validation"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import process from "node:process"
import {
  applyLocalAdminAccessRequestStatus,
  createLocalAccessRequestResult,
  issueLocalAdminAccessInvite,
  listLocalAccessRequests,
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

export function hashAccessInviteToken(token: string) {
  return tokenHash(token.trim())
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
    return createLocalAccessRequestResult(payload)

  const adminClient = requireSupabaseAdmin(event)
  const email = normalizeEmail(payload.email)
  const now = new Date().toISOString()
  const { data, error } = await adminClient.rpc("cofoundry_create_access_request", {
    p_company: payload.company?.trim() || "",
    p_company_stage: payload.companyStage,
    p_created_at: now,
    p_email: email,
    p_id: `access_${randomUUID().replaceAll("-", "")}`,
    p_name: payload.name.trim(),
    p_role: payload.role,
    p_source: payload.source?.trim() || "site",
    p_timeline: payload.timeline,
    p_use_case: payload.useCase.trim(),
  })

  if (error)
    throw error

  const result = data as {
    created?: boolean
    request?: SupabaseAccessRequestRow
  } | null
  if (!result?.request)
    throw createError({ statusCode: 500, statusMessage: "Access request persistence returned an invalid response." })

  return {
    created: result.created === true,
    request: toAccessRequest(result.request),
  }
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

export async function updateAccessRequestStatus(event: H3Event, id: string, payload: {
  action: AdminAction
  expectedUpdatedAt: string
  status: "approved" | "denied" | "open"
}) {
  if (!isSupabaseEnabled(event))
    return applyLocalAdminAccessRequestStatus(id, payload)

  const adminClient = requireSupabaseAdmin(event)
  const { data: existingData, error: existingError } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (existingError)
    throw existingError
  if (!existingData)
    return null

  const { error } = await adminClient.rpc("cofoundry_apply_admin_access_status", {
    p_action_id: payload.action.id,
    p_actor_user_id: payload.action.adminUserId,
    p_expected_updated_at: payload.expectedUpdatedAt,
    p_notes: payload.action.notes,
    p_status: payload.status,
    p_target_id: id,
    p_timestamp: payload.action.createdAt,
  })

  if (error) {
    const stale = error.message.includes("changed after")
    throw createError({
      statusCode: stale || error.message.includes("accepted")
        ? 409
        : 400,
      statusMessage: stale
        ? "The access request changed after this review began. Refresh and review the current state."
        : error.message.includes("accepted")
          ? "An accepted access invite cannot be reopened or denied."
          : "The access-request action could not be applied.",
    })
  }

  return toAccessRequest({
    ...(existingData as SupabaseAccessRequestRow),
    admin_notes: payload.action.notes,
    invite_expires_at: null,
    invite_token_hash: null,
    invite_token_issued_at: null,
    reviewed_at: payload.action.createdAt,
    reviewed_by_user_id: payload.action.adminUserId,
    status: payload.status,
    updated_at: payload.action.createdAt,
  })
}

export async function createAccessInvite(event: H3Event, id: string, payload: {
  action: AdminAction
  appUrl: string
  expectedUpdatedAt: string
}) {
  if (!isSupabaseEnabled(event))
    return issueLocalAdminAccessInvite(id, payload)

  const adminClient = requireSupabaseAdmin(event)
  const token = randomBytes(32).toString("base64url")
  const now = new Date(payload.action.createdAt)
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + inviteLifetimeDays)

  const { data: existingData, error: existingError } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (existingError)
    throw existingError
  if (!existingData)
    return null

  const { error } = await adminClient.rpc("cofoundry_issue_admin_access_invite", {
    p_action_id: payload.action.id,
    p_actor_user_id: payload.action.adminUserId,
    p_expected_updated_at: payload.expectedUpdatedAt,
    p_expires_at: expiresAt.toISOString(),
    p_invite_token_hash: tokenHash(token),
    p_notes: payload.action.notes,
    p_target_id: id,
    p_timestamp: payload.action.createdAt,
  })

  if (error) {
    const stale = error.message.includes("changed after")
    const accepted = error.message.includes("accepted")
    const approval = error.message.includes("Approve")
    throw createError({
      statusCode: stale || accepted || approval
        ? 409
        : 400,
      statusMessage: stale
        ? "The access request changed after this review began. Refresh and review the current state."
        : accepted
          ? "An accepted access invite cannot be reissued."
          : approval
            ? "Approve the access request before issuing an invite."
            : "The access invite could not be issued.",
    })
  }

  const request = toAccessRequest({
    ...(existingData as SupabaseAccessRequestRow),
    admin_notes: payload.action.notes,
    invite_accepted_at: null,
    invite_expires_at: expiresAt.toISOString(),
    invite_token_hash: tokenHash(token),
    invite_token_issued_at: payload.action.createdAt,
    reviewed_at: payload.action.createdAt,
    reviewed_by_user_id: payload.action.adminUserId,
    status: "invited",
    updated_at: payload.action.createdAt,
  })
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
  const normalizedEmail = email
    ? normalizeEmail(email)
    : ""
  const { data, error } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("invite_token_hash", tokenHash(token.trim()))
    .maybeSingle()

  if (error)
    throw error

  const request = data
    ? toAccessRequest(data as SupabaseAccessRequestRow)
    : null
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
