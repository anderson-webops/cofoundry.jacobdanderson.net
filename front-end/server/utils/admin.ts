import type { H3Event } from "h3"
import { createError } from "h3"
import { useRuntimeConfig } from "nitropack/runtime"
import { adminCommandQueueActionSchema, adminOpportunityVerificationSchema, adminReportStatusSchema, adminUserEmailVerificationSchema, adminUserModerationSchema, adminUserRoleSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "./auth"

export async function requireAdminSession(event: H3Event) {
  const session = await requireAuthenticatedSession(event)

  if (session.role !== "admin")
    throw createError({ statusCode: 403, statusMessage: "Full admin access is required for this action." })

  return session
}

export async function requireFullAdminSession(event: H3Event) {
  return requireAdminSession(event)
}

export async function requireOpportunityReviewerSession(event: H3Event) {
  const session = await requireAuthenticatedSession(event)
  const runtimeConfig = useRuntimeConfig(event)

  const allowed = session.role === "admin"
    || (session.role === "investor_admin" && runtimeConfig.public.featureInvestmentModule === true)

  if (!allowed)
    throw createError({ statusCode: 403, statusMessage: "Opportunity-review access is required for this action." })

  return session
}

export async function requireInvestmentReviewerSession(event: H3Event) {
  const session = await requireAuthenticatedSession(event)
  const runtimeConfig = useRuntimeConfig(event)
  const allowed = runtimeConfig.public.featureInvestmentModule === true
    && ["admin", "investor_admin"].includes(session.role)

  if (!allowed)
    throw createError({ statusCode: 403, statusMessage: "Investment-review access is required for this action." })

  return session
}

export function validateAdminUserModerationPayload(payload: unknown) {
  return adminUserModerationSchema.parse(payload)
}

export function validateAdminUserRolePayload(payload: unknown) {
  return adminUserRoleSchema.parse(payload)
}

export function validateAdminUserEmailVerificationPayload(payload: unknown) {
  return adminUserEmailVerificationSchema.parse(payload)
}

export function validateAdminReportStatusPayload(payload: unknown) {
  return adminReportStatusSchema.parse(payload)
}

export function validateAdminOpportunityVerificationPayload(payload: unknown) {
  return adminOpportunityVerificationSchema.parse(payload)
}

export function validateAdminCommandQueueActionPayload(payload: unknown) {
  return adminCommandQueueActionSchema.parse(payload)
}
