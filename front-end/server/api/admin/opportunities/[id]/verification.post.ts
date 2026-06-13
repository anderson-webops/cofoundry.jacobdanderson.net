import { requireAdminSession, validateAdminOpportunityVerificationPayload } from "../../../../utils/admin"
import { persistAdminAction, persistOpportunityVerification } from "../../../../utils/admin-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "admin:opportunity-verification",
    windowMs: 60 * 1000,
  })
  const payload = validateAdminOpportunityVerificationPayload(await readBody(event))
  const opportunityId = getRouterParam(event, "id")

  if (!opportunityId)
    throw createError({ statusCode: 400, statusMessage: "An opportunity id is required." })

  const createdAt = new Date().toISOString()
  const action = {
    id: crypto.randomUUID(),
    adminUserId: session.id,
    createdAt,
    metadata: {
      verificationStatus: payload.status,
    },
    notes: payload.notes,
    targetId: opportunityId,
    targetType: "opportunity" as const,
    type: "review_evidence" as const,
  }

  const opportunity = await persistOpportunityVerification(event, {
    adminUserId: session.id,
    notes: payload.notes,
    opportunityId,
    status: payload.status,
    timestamp: createdAt,
  })
  await persistAdminAction(event, action)

  return {
    action,
    opportunity: {
      ...opportunity,
      id: opportunityId,
      verificationStatus: payload.status,
    },
  }
})
