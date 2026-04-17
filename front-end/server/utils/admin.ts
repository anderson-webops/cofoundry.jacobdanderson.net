import type { H3Event } from "h3"
import { adminReportStatusSchema, adminUserModerationSchema } from "~/shared/utils/validation"
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

export function validateAdminReportStatusPayload(payload: unknown) {
  return adminReportStatusSchema.parse(payload)
}
