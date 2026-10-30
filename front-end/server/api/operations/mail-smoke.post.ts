import process from "node:process"
import { operationsMailSmokeSchema } from "~/shared/utils/validation"
import { isContactMailConfigured, sendPlainTextEmail } from "../../utils/contact"
import { recordNotificationDelivery } from "../../utils/notification-delivery"
import { requireOperationsWorker } from "../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { isSupabaseEnabled } from "../../utils/supabase"

function defaultSmokeRecipient() {
  return process.env.CONTACT_TO_EMAIL?.trim()
    || process.env.NUXT_PUBLIC_SUPPORT_EMAIL?.trim()
    || "contacts@jacobdanderson.net"
}

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 10,
    scope: "operations:mail-smoke",
    windowMs: 60 * 60 * 1000,
  })

  const payload = operationsMailSmokeSchema.parse(await readBody(event))
  const recipient = payload.toEmail || defaultSmokeRecipient()
  const mailConfigured = isContactMailConfigured()
  const session = {
    email: recipient,
    id: "operations-mail-smoke",
    name: "Operations mail smoke",
    onboardingCompleted: true,
    role: "admin" as const,
    subscriptionPlan: "free" as const,
  }
  const metadata = {
    ...payload.metadata,
    dryRun: payload.dryRun,
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
    source: "operations-mail-smoke",
  }
  const body = [
    "This is a CoFoundry operations mail smoke test.",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Mode: ${metadata.mode}`,
    "",
    "If this message arrived at the expected monitored inbox, record the result in the server runbook and confirm /admin/readiness shows recent mail-smoke evidence.",
  ].join("\n")

  if (payload.dryRun) {
    await recordNotificationDelivery(event, session, {
      bodyPreview: body,
      configured: false,
      delivered: false,
      error: "Dry run; no mail smoke email sent.",
      eventType: "mail.smoke",
      metadata,
      reason: "dry_run",
      skipped: true,
      subject: payload.subject,
      targetId: "mail-smoke",
      targetType: "operations",
      unreadCount: 0,
    })

    return {
      configured: mailConfigured,
      delivered: false,
      mode: metadata.mode,
      reason: "dry_run",
      recipient,
      subject: payload.subject,
    }
  }

  if (!mailConfigured) {
    await recordNotificationDelivery(event, session, {
      bodyPreview: body,
      configured: false,
      delivered: false,
      error: "Contact mail is not configured.",
      eventType: "mail.smoke",
      metadata,
      reason: "mail_not_configured",
      subject: payload.subject,
      targetId: "mail-smoke",
      targetType: "operations",
      unreadCount: 0,
    })

    return {
      configured: false,
      delivered: false,
      mode: metadata.mode,
      reason: "mail_not_configured",
      recipient,
      subject: payload.subject,
    }
  }

  try {
    await sendPlainTextEmail({
      body,
      subject: payload.subject,
      toEmail: recipient,
    })

    await recordNotificationDelivery(event, session, {
      bodyPreview: body,
      configured: true,
      delivered: true,
      error: null,
      eventType: "mail.smoke",
      metadata,
      reason: "sent",
      subject: payload.subject,
      targetId: "mail-smoke",
      targetType: "operations",
      unreadCount: 0,
    })

    return {
      configured: true,
      delivered: true,
      mode: metadata.mode,
      reason: "sent",
      recipient,
      subject: payload.subject,
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Mail smoke delivery failed."

    await recordNotificationDelivery(event, session, {
      bodyPreview: body,
      configured: true,
      delivered: false,
      error: errorMessage,
      eventType: "mail.smoke",
      metadata,
      reason: "delivery_failed",
      subject: payload.subject,
      targetId: "mail-smoke",
      targetType: "operations",
      unreadCount: 0,
    })

    return {
      configured: true,
      delivered: false,
      error: errorMessage,
      mode: metadata.mode,
      reason: "delivery_failed",
      recipient,
      subject: payload.subject,
    }
  }
})
