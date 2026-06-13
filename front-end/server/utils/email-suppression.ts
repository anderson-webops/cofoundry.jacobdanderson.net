import type { H3Event } from "h3"
import type { z } from "zod"
import type { operationsEmailSuppressionSchema } from "~/shared/utils/validation"
import { randomUUID } from "node:crypto"
import { findLocalEmailSuppression, recordLocalEmailSuppression } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type OperationsEmailSuppressionPayload = z.infer<typeof operationsEmailSuppressionSchema>
export type EmailSuppressionCategory = OperationsEmailSuppressionPayload["category"]

export async function recordEmailSuppression(event: H3Event, payload: OperationsEmailSuppressionPayload) {
  const normalizedPayload = {
    ...payload,
    email: payload.email.toLowerCase(),
  }

  if (!isSupabaseEnabled(event))
    return recordLocalEmailSuppression(normalizedPayload)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const now = new Date().toISOString()
  const { data, error } = await adminClient
    .from("email_suppressions")
    .insert({
      category: normalizedPayload.category,
      created_at: now,
      email: normalizedPayload.email,
      id: randomUUID(),
      metadata: normalizedPayload.metadata,
      provider: normalizedPayload.provider,
      reason: normalizedPayload.reason,
      source_event_id: normalizedPayload.sourceEventId || null,
      suppressed_at: normalizedPayload.suppressedAt || now,
    })
    .select()
    .maybeSingle()

  if (error)
    throw error

  return data
}

export async function findEmailSuppression(event: H3Event, email: string, category: Exclude<EmailSuppressionCategory, "all">) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!isSupabaseEnabled(event))
    return findLocalEmailSuppression(normalizedEmail, category)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("email_suppressions")
    .select("*")
    .eq("email", normalizedEmail)
    .in("category", ["all", category])
    .order("suppressed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error)
    throw error

  return data || null
}
