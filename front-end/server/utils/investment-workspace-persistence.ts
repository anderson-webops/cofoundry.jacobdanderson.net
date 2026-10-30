import type { H3Event } from "h3"
import type { InvestmentWorkspaceDocument } from "../../shared/types/investment-workspaces"
import {
  createLocalInvestmentWorkspaceDocument,
  getLocalInvestmentWorkspaceDocument,
  getLocalInvestmentWorkspaceDocumentByApplicationId,
  listLocalInvestmentWorkspaceDocuments,
  updateLocalInvestmentWorkspaceDocument,
} from "./local-investment-workspaces"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

interface InvestmentWorkspaceRow {
  all_file_upload_ids: string[]
  applicant_user_id: string
  application_id: string
  application_status: InvestmentWorkspaceDocument["application"]["status"]
  created_at: string
  document: InvestmentWorkspaceDocument
  id: string
  opportunity_id: string
  organization_id: string | null
  shared_file_upload_ids: string[]
  updated_at: string
  version: number
}

function rowToDocument(row: InvestmentWorkspaceRow) {
  return row.document
}

function fileUploadIds(document: InvestmentWorkspaceDocument, sharedOnly: boolean) {
  return Array.from(new Set(document.dataRoomItems
    .filter(item => !sharedOnly || item.shareWithProgram)
    .flatMap(item => item.fileUploadId
      ? [item.fileUploadId]
      : [])))
}

function documentToRow(document: InvestmentWorkspaceDocument): InvestmentWorkspaceRow {
  return {
    all_file_upload_ids: fileUploadIds(document, false),
    applicant_user_id: document.applicantUserId,
    application_id: document.application.id,
    application_status: document.application.status,
    created_at: document.createdAt,
    document,
    id: document.id,
    opportunity_id: document.opportunityId,
    organization_id: document.organizationId,
    shared_file_upload_ids: fileUploadIds(document, true),
    updated_at: document.updatedAt,
    version: document.version,
  }
}

export async function listRawInvestmentWorkspaceDocumentsForApplicant(event: H3Event, applicantUserId: string) {
  if (!isSupabaseEnabled(event)) {
    return (await listLocalInvestmentWorkspaceDocuments())
      .filter(document => document.applicantUserId === applicantUserId)
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .select("*")
    .eq("applicant_user_id", applicantUserId)
    .order("updated_at", { ascending: false })
  if (error)
    throw error
  return ((data || []) as InvestmentWorkspaceRow[]).map(rowToDocument)
}

export async function listRawInvestmentWorkspaceDocumentsForReview(event: H3Event) {
  if (!isSupabaseEnabled(event)) {
    return (await listLocalInvestmentWorkspaceDocuments())
      .filter(document => !["draft", "withdrawn"].includes(document.application.status))
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .select("*")
    .not("application_status", "in", "(draft,withdrawn)")
    .order("updated_at", { ascending: false })
  if (error)
    throw error
  return ((data || []) as InvestmentWorkspaceRow[]).map(rowToDocument)
}

export async function getRawInvestmentWorkspaceDocument(event: H3Event, workspaceId: string) {
  if (!isSupabaseEnabled(event))
    return getLocalInvestmentWorkspaceDocument(workspaceId)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .select("*")
    .eq("id", workspaceId)
    .maybeSingle()
  if (error)
    throw error
  return data
    ? rowToDocument(data as InvestmentWorkspaceRow)
    : null
}

export async function getRawInvestmentWorkspaceDocumentByApplicationId(event: H3Event, applicationId: string) {
  if (!isSupabaseEnabled(event))
    return getLocalInvestmentWorkspaceDocumentByApplicationId(applicationId)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle()
  if (error)
    throw error
  return data
    ? rowToDocument(data as InvestmentWorkspaceRow)
    : null
}

export async function findRawInvestmentWorkspaceDocumentByResourceId(event: H3Event, resourceId: string) {
  const byWorkspace = await getRawInvestmentWorkspaceDocument(event, resourceId)
  return byWorkspace || getRawInvestmentWorkspaceDocumentByApplicationId(event, resourceId)
}

export async function findRawInvestmentWorkspaceDocumentByFileUploadId(event: H3Event, uploadId: string) {
  if (!isSupabaseEnabled(event)) {
    return (await listLocalInvestmentWorkspaceDocuments())
      .find(document => document.dataRoomItems.some(item => item.fileUploadId === uploadId)) || null
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .select("*")
    .contains("all_file_upload_ids", [uploadId])
    .maybeSingle()
  if (error)
    throw error
  return data
    ? rowToDocument(data as InvestmentWorkspaceRow)
    : null
}

export async function persistCreatedInvestmentWorkspaceDocument(event: H3Event, document: InvestmentWorkspaceDocument) {
  if (!isSupabaseEnabled(event)) {
    const created = await createLocalInvestmentWorkspaceDocument(document)
    if (!created)
      throw createError({ statusCode: 409, statusMessage: "An active investment workspace already exists for this opportunity." })
    return created
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .insert(documentToRow(document))
    .select("*")
    .single()
  if (error?.code === "23505")
    throw createError({ statusCode: 409, statusMessage: "An active investment workspace already exists for this opportunity." })
  if (error)
    throw error
  return rowToDocument(data as InvestmentWorkspaceRow)
}

export async function persistUpdatedInvestmentWorkspaceDocument(
  event: H3Event,
  document: InvestmentWorkspaceDocument,
  expectedVersion: number,
) {
  if (!isSupabaseEnabled(event)) {
    const updated = await updateLocalInvestmentWorkspaceDocument(document, expectedVersion)
    if (!updated)
      throw createError({ statusCode: 409, statusMessage: "The investment workspace changed after this action began. Refresh and try again." })
    return updated
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const row = documentToRow(document)
  const { data, error } = await adminClient
    .from("investment_workspace_documents")
    .update({
      all_file_upload_ids: row.all_file_upload_ids,
      application_status: row.application_status,
      document: row.document,
      organization_id: row.organization_id,
      shared_file_upload_ids: row.shared_file_upload_ids,
      updated_at: row.updated_at,
      version: row.version,
    })
    .eq("id", row.id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle()
  if (error)
    throw error
  if (!data)
    throw createError({ statusCode: 409, statusMessage: "The investment workspace changed after this action began. Refresh and try again." })
  return rowToDocument(data as InvestmentWorkspaceRow)
}
