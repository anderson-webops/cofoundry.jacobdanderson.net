import type { H3Event } from "h3"
import type { z } from "zod"
import type { operationsBackupRunSchema, operationsEventSchema } from "~/shared/utils/validation"
import { randomUUID } from "node:crypto"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type OperationsBackupRunPayload = z.infer<typeof operationsBackupRunSchema>
type OperationsEventPayload = z.infer<typeof operationsEventSchema>

export async function recordBackupRun(event: H3Event, payload: OperationsBackupRunPayload) {
  if (!isSupabaseEnabled(event))
    return null

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const backupRun = {
    artifact_uri: payload.artifactUri || null,
    completed_at: payload.completedAt || null,
    id: payload.id || randomUUID(),
    metadata: payload.metadata,
    notes: payload.notes || null,
    provider: payload.provider,
    started_at: payload.startedAt || new Date().toISOString(),
    status: payload.status,
  }

  const { data, error } = await adminClient
    .from("backup_runs")
    .upsert(backupRun, { onConflict: "id" })
    .select()
    .maybeSingle()

  if (error)
    throw error

  return data
}

export async function recordOperationalEvent(event: H3Event, payload: OperationsEventPayload) {
  if (!isSupabaseEnabled(event))
    return null

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("operational_events")
    .insert({
      actor_user_id: payload.actorUserId || null,
      event_type: payload.eventType,
      id: randomUUID(),
      metadata: payload.metadata,
      severity: payload.severity,
      source: payload.source,
      target_id: payload.targetId || null,
      target_type: payload.targetType || null,
    })
    .select()
    .maybeSingle()

  if (error)
    throw error

  return data
}
