import type { H3Event } from "h3"
import { adminCommandQueueActionSchema, adminReportStatusSchema, adminUserModerationSchema, adminUserRoleSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "./auth"

export async function requireAdminSession(event: H3Event) {
  const session = await requireAuthenticatedSession(event)

  if (!["admin", "investor_admin"].includes(session.role))
    throw createError({ statusCode: 403, statusMessage: "Admin access is required for this action." })

  return session
}

export function validateAdminUserModerationPayload(payload: unknown) {
  return adminUserModerationSchema.parse(payload)
}

export function validateAdminUserRolePayload(payload: unknown) {
  return adminUserRoleSchema.parse(payload)
}

export function validateAdminReportStatusPayload(payload: unknown) {
  return adminReportStatusSchema.parse(payload)
}

export function validateAdminCommandQueueActionPayload(payload: unknown) {
  return adminCommandQueueActionSchema.parse(payload)
}
