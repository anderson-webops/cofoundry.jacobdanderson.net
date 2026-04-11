import type { H3Event } from "h3"
import { adminReportStatusSchema, adminUserModerationSchema } from "~/shared/utils/validation"
import { readSession } from "./auth"

export function requireAdminSession(event: H3Event) {
  const session = readSession(event)

  if (!session)
    throw createError({ statusCode: 401, statusMessage: "Sign in to access the admin console." })

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
