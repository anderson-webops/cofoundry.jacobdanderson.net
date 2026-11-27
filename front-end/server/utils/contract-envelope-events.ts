import type { H3Event } from "h3"
import type { z } from "zod"
import type { ContractProviderEvidence } from "~/shared/utils/contract-documents"
import type { operationsContractEnvelopeSchema } from "~/shared/utils/validation"
import { randomUUID } from "node:crypto"
import { createError } from "h3"
import { listLocalContractEnvelopeEvents, recordLocalContractEnvelopeEvent } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type OperationsContractEnvelopePayload = z.infer<typeof operationsContractEnvelopeSchema>
type ContractEnvelopeStatus = ContractProviderEvidence["status"]

const contractEnvelopeStatuses = new Set<ContractEnvelopeStatus>([
  "created",
  "sent",
  "viewed",
  "completed",
  "declined",
  "voided",
  "failed"
])

function normalizeStatus(value: unknown): ContractEnvelopeStatus {
  return typeof value === "string" && contractEnvelopeStatuses.has(value as ContractEnvelopeStatus)
    ? value as ContractEnvelopeStatus
    : "created"
}

function toCertificateEvidence(row: {
  completed_pdf_file_upload_id?: unknown
  completed_pdf_sha256?: unknown
  occurred_at?: unknown
  provider?: unknown
  provider_envelope_id?: unknown
  signed_by_user_ids?: unknown
  status?: unknown
}): ContractProviderEvidence {
  return {
    completedPdfFileUploadId: typeof row.completed_pdf_file_upload_id === "string"
      ? row.completed_pdf_file_upload_id
      : null,
    completedPdfSha256: typeof row.completed_pdf_sha256 === "string"
      ? row.completed_pdf_sha256
      : null,
    occurredAt: typeof row.occurred_at === "string"
      ? row.occurred_at
      : "",
    provider: typeof row.provider === "string"
      ? row.provider
      : "external",
    providerEnvelopeId: typeof row.provider_envelope_id === "string"
      ? row.provider_envelope_id
      : "",
    signedByUserIds: Array.isArray(row.signed_by_user_ids)
      ? row.signed_by_user_ids.filter((value): value is string => typeof value === "string")
      : [],
    status: normalizeStatus(row.status),
  }
}

export async function recordContractEnvelopeEvent(event: H3Event, payload: OperationsContractEnvelopePayload) {
  if (!isSupabaseEnabled(event))
    return recordLocalContractEnvelopeEvent(payload)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const now = new Date().toISOString()
  const provider = payload.provider.trim().toLowerCase()
  const sourceEventId = payload.sourceEventId || null
  const { data, error } = await adminClient
    .from("contract_provider_events")
    .upsert({
      completed_pdf_file_upload_id: payload.completedPdfFileUploadId || null,
      completed_pdf_sha256: payload.completedPdfSha256?.toLowerCase() || null,
      contract_id: payload.contractId,
      contract_version_id: payload.contractVersionId,
      created_at: now,
      id: randomUUID(),
      metadata: payload.metadata,
      occurred_at: payload.occurredAt || now,
      provider,
      provider_envelope_id: payload.providerEnvelopeId,
      signed_by_user_ids: payload.signedByUserIds,
      source_event_id: sourceEventId,
      status: payload.status,
    }, {
      ignoreDuplicates: true,
      onConflict: "provider,source_event_id",
    })
    .select()
    .maybeSingle()

  if (error)
    throw error

  if (data || !sourceEventId)
    return data

  const { data: existing, error: existingError } = await adminClient
    .from("contract_provider_events")
    .select("*")
    .eq("provider", provider)
    .eq("source_event_id", sourceEventId)
    .maybeSingle()

  if (existingError)
    throw existingError

  return existing
}

export async function listContractProviderEvidence(event: H3Event, contractId: string, contractVersionId: string) {
  if (!isSupabaseEnabled(event)) {
    const rows = await listLocalContractEnvelopeEvents(contractId, contractVersionId)
    return rows.map(row => toCertificateEvidence(row))
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("contract_provider_events")
    .select("*")
    .eq("contract_id", contractId)
    .eq("contract_version_id", contractVersionId)
    .order("occurred_at", { ascending: false })
    .limit(10)

  if (error)
    throw error

  return (data || []).map(row => toCertificateEvidence(row as Record<string, unknown>))
}
