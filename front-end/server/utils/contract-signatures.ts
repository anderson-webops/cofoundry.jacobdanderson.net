import type { H3Event } from "h3"
import type { Signature } from "~/shared/types/domain"
import { randomUUID } from "node:crypto"
import { getHeader } from "h3"
import { getRequesterIp } from "./rate-limit"

export function buildContractSignatureEvent(event: H3Event, signature: Signature, typedName: string) {
  return {
    contract_id: signature.contractId,
    contract_version_id: signature.contractVersionId,
    created_at: signature.signedAt,
    event_type: "typed_signature" as const,
    id: randomUUID(),
    ip_address: getRequesterIp(event) || null,
    signature_id: signature.id,
    typed_name: typedName,
    user_agent: getHeader(event, "user-agent")?.slice(0, 1000) || null,
    user_id: signature.userId,
  }
}
