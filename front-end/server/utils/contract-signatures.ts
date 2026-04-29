import type { H3Event } from "h3"
import type { Signature } from "~/shared/types/domain"
import { randomUUID } from "node:crypto"
import { getHeader, getRequestIP } from "h3"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

export async function recordContractSignatureEvent(event: H3Event, signature: Signature, typedName: string) {
  if (!isSupabaseEnabled(event))
    return

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("contract_signature_events")
    .insert({
      id: randomUUID(),
      contract_id: signature.contractId,
      contract_version_id: signature.contractVersionId,
      signature_id: signature.id,
      user_id: signature.userId,
      typed_name: typedName,
      event_type: "typed_signature",
      ip_address: getRequestIP(event, { xForwardedFor: true }) || null,
      user_agent: getHeader(event, "user-agent") || null,
      created_at: signature.signedAt,
    })

  if (error)
    throw error
}
