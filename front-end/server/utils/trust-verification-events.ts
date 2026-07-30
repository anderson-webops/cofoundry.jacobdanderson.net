import type { H3Event } from "h3"
import type { z } from "zod"
import type { operationsTrustVerificationSchema } from "~/shared/utils/validation"
import { randomUUID } from "node:crypto"
import { recordLocalTrustVerificationEvent } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type OperationsTrustVerificationPayload = z.infer<typeof operationsTrustVerificationSchema>

export async function recordTrustVerificationEvent(event: H3Event, payload: OperationsTrustVerificationPayload) {
  if (!isSupabaseEnabled(event))
    return recordLocalTrustVerificationEvent(payload)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const now = new Date().toISOString()
  const provider = payload.provider.trim().toLowerCase()
  const sourceEventId = payload.sourceEventId || null
  const { data, error } = await adminClient
    .from("trust_verification_events")
    .upsert({
      confidence: typeof payload.confidence === "number" ? payload.confidence : null,
      created_at: now,
      evidence_file_upload_id: payload.evidenceFileUploadId || null,
      id: randomUUID(),
      metadata: payload.metadata,
      occurred_at: payload.occurredAt || now,
      provider,
      provider_subject_id: payload.providerSubjectId || null,
      source_event_id: sourceEventId,
      status: payload.status,
      target_id: payload.targetId,
      target_type: payload.targetType,
      verification_type: payload.verificationType,
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
    .from("trust_verification_events")
    .select("*")
    .eq("provider", provider)
    .eq("source_event_id", sourceEventId)
    .maybeSingle()

  if (existingError)
    throw existingError

  return existing
}
