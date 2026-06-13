import type { H3Event } from "h3"
import type { EmailPreferenceCategory } from "./email-preferences"
import type { SessionUser, WorkspaceSeed } from "~/shared/types/domain"
import type { LifecycleNotificationRequest } from "~/shared/utils/lifecycle-notifications"
import { randomUUID } from "node:crypto"
import { buildInboxSnapshot } from "../../shared/utils/inbox"
import { buildLifecycleNotification } from "../../shared/utils/lifecycle-notifications"
import { isWorkflowLifecycleEvent, normalizeNotificationPreferences } from "../../shared/utils/notification-preferences"
import { isContactMailConfigured, sendPlainTextEmail } from "./contact"
import { createEmailPreferenceManagementUrl } from "./email-preferences"
import { recordLocalNotificationDelivery } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

export interface NotificationDeliveryResult {
  bodyPreview?: string | null
  configured: boolean
  delivered: boolean
  error: string | null
  eventType?: string
  metadata?: Record<string, unknown>
  reason?: "dry_run" | "email_digest_disabled" | "mail_not_configured" | "mock_mode" | "no_workspace_items" | "sent" | "delivery_failed" | "workflow_email_disabled"
  skipped?: boolean
  subject: string
  suppressed?: boolean
  targetId?: string | null
  targetType?: string | null
  unreadCount: number
}

export interface UnreadNotificationDigestOptions {
  respectPreferences?: boolean
  skipIfEmpty?: boolean
}

const defaultSupportEmail = "support@cofoundry.dev"
const trailingSlashPattern = /\/+$/

function stripTrailingSlash(value?: string) {
  return value?.replace(trailingSlashPattern, "") || ""
}

function isAbsoluteUrl(value: string) {
  try {
    const url = new URL(value)
    return Boolean(url.protocol && url.host)
  }
  catch {
    return false
  }
}

function resolvePreferenceFooterOptions(
  event: H3Event | undefined,
  category: EmailPreferenceCategory,
  recipient?: { email: string, userId: string },
) {
  try {
    const runtimeConfig = event ? useRuntimeConfig(event) : useRuntimeConfig()
    const publicConfig = runtimeConfig.public as Partial<Record<"appUrl" | "supportEmail", string | undefined>>
    const appUrl = stripTrailingSlash(publicConfig.appUrl)
    const settingsUrl = recipient
      ? createEmailPreferenceManagementUrl({
          category,
          email: recipient.email,
          userId: recipient.userId,
        }, {
          appUrl,
          fallbackUrl: appUrl ? `${appUrl}/app/settings` : "/app/settings",
        })
      : appUrl ? `${appUrl}/app/settings` : "/app/settings"

    return {
      settingsUrl,
      supportEmail: publicConfig.supportEmail?.trim() || defaultSupportEmail,
    }
  }
  catch {
    return {
      settingsUrl: "/app/settings",
      supportEmail: defaultSupportEmail,
    }
  }
}

export function appendNotificationPreferenceFooter(
  body: string,
  category: EmailPreferenceCategory,
  options: { settingsUrl?: string, supportEmail?: string } = {},
) {
  const settingsUrl = options.settingsUrl || "/app/settings"
  const supportEmail = options.supportEmail || defaultSupportEmail
  const categoryLine = category === "digest"
    ? "Turn off scheduled unread digest email:"
    : "Turn off relationship workflow email:"

  return [
    body.trimEnd(),
    "",
    "---",
    categoryLine,
    settingsUrl,
    "",
    "Service-critical account, security, billing, trust, and support notices may still be sent separately.",
    `For help, contact ${supportEmail}.`,
  ].join("\n")
}

export function buildNotificationPreferenceHeaders(
  category: EmailPreferenceCategory,
  options: { settingsUrl?: string, supportEmail?: string } = {},
) {
  const settingsUrl = options.settingsUrl || "/app/settings"
  const supportEmail = options.supportEmail || defaultSupportEmail
  const subject = category === "digest"
    ? "CoFoundry scheduled digest email preference"
    : "CoFoundry relationship workflow email preference"
  const listUnsubscribeTargets = [
    `<mailto:${supportEmail}?subject=${encodeURIComponent(subject)}>`,
    ...(isAbsoluteUrl(settingsUrl) ? [`<${settingsUrl}>`] : []),
  ]

  return {
    "List-Unsubscribe": listUnsubscribeTargets.join(", "),
  }
}

export function buildDigestSubject(unreadCount: number) {
  return unreadCount === 1
    ? "CoFoundry: 1 workspace item needs attention"
    : `CoFoundry: ${unreadCount} workspace items need attention`
}

export function isScheduledDigestEmailEnabled(seed: WorkspaceSeed, userId: string) {
  return normalizeNotificationPreferences(seed.users.find(user => user.id === userId)?.notificationPreferences).unreadDigestEmail
}

export function isLifecycleWorkflowEmailEnabled(seed: WorkspaceSeed, userId: string) {
  return normalizeNotificationPreferences(seed.users.find(user => user.id === userId)?.notificationPreferences).workflowEmail
}

export function buildDigestContent(seed: WorkspaceSeed, session: SessionUser, footerOptions: { settingsUrl?: string, supportEmail?: string } = {}) {
  const snapshot = buildInboxSnapshot(seed, session.id)

  const lines = [
    `Hi ${session.name},`,
    "",
    snapshot.actions.length
      ? "These CoFoundry workspace items still need attention:"
      : "Your CoFoundry workspace queue is clear right now.",
    "",
    ...snapshot.actions.slice(0, 10).flatMap(item => [
      `- ${item.title}`,
      `  ${item.summary}`,
      `  ${item.href}`,
    ]),
    "",
    "Open your workspace to handle the queue:",
    "/app/inbox",
    "",
    "CoFoundry",
  ]

  return {
    body: appendNotificationPreferenceFooter(lines.join("\n"), "digest", footerOptions),
    snapshot,
  }
}

export async function recordNotificationDelivery(event: H3Event, session: SessionUser, result: NotificationDeliveryResult) {
  if (!isSupabaseEnabled(event))
    return recordLocalNotificationDelivery(session, result)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("notification_deliveries")
    .insert({
      id: randomUUID(),
      user_id: session.id,
      channel: "email",
      body_preview: result.bodyPreview || null,
      event_type: result.eventType || "digest.unread",
      status: result.delivered ? "sent" : result.configured ? "failed" : "skipped",
      subject: result.subject,
      recipient: session.email,
      notification_count: result.unreadCount,
      error: result.error,
      metadata: result.metadata || {},
      target_id: result.targetId || null,
      target_type: result.targetType || null,
      delivered_at: result.delivered ? new Date().toISOString() : null,
    })

  if (error)
    throw error
}

export function buildLifecycleBodyPreview(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 240)
}

export async function sendLifecycleNotification(
  event: H3Event,
  seed: WorkspaceSeed,
  request: LifecycleNotificationRequest,
  options: { dryRun?: boolean, forceRecordOnlyReason?: "dry_run" | "mock_mode" } = {},
) {
  const plan = buildLifecycleNotification(seed, request)

  if (!plan) {
    throw createError({
      statusCode: 404,
      statusMessage: "Lifecycle notification target was not found or is not owned by the recipient.",
    })
  }

  const session: SessionUser = {
    email: plan.recipientEmail,
    id: plan.userId,
    name: plan.recipientName,
    onboardingCompleted: true,
    role: seed.users.find(user => user.id === plan.userId)?.role || "founder",
    subscriptionPlan: "free",
  }
  const footerOptions = resolvePreferenceFooterOptions(event, "workflow", {
    email: plan.recipientEmail,
    userId: plan.userId,
  })
  const body = isWorkflowLifecycleEvent(plan.eventType)
    ? appendNotificationPreferenceFooter(plan.body, "workflow", footerOptions)
    : plan.body
  const headers = isWorkflowLifecycleEvent(plan.eventType)
    ? buildNotificationPreferenceHeaders("workflow", footerOptions)
    : undefined
  const baseResult = {
    bodyPreview: buildLifecycleBodyPreview(body),
    eventType: plan.eventType,
    metadata: plan.metadata,
    subject: plan.subject,
    targetId: plan.targetId,
    targetType: plan.targetType,
    unreadCount: 1,
  }

  if (!options.dryRun && isWorkflowLifecycleEvent(plan.eventType) && !isLifecycleWorkflowEmailEnabled(seed, plan.userId)) {
    const result: NotificationDeliveryResult = {
      ...baseResult,
      configured: false,
      delivered: false,
      error: "Relationship workflow email is disabled for this member.",
      reason: "workflow_email_disabled",
      skipped: true,
      suppressed: true,
    }
    await recordNotificationDelivery(event, session, result)
    return { delivery: result, plan }
  }

  if (options.dryRun || options.forceRecordOnlyReason) {
    const reason = options.forceRecordOnlyReason || "dry_run"
    const result: NotificationDeliveryResult = {
      ...baseResult,
      configured: false,
      delivered: false,
      error: reason === "dry_run" ? "Dry run; no lifecycle email sent." : "Mock mode records lifecycle notifications without sending email.",
      reason,
      skipped: true,
    }
    await recordNotificationDelivery(event, session, result)
    return { delivery: result, plan }
  }

  if (!isContactMailConfigured()) {
    const result: NotificationDeliveryResult = {
      ...baseResult,
      configured: false,
      delivered: false,
      error: null,
      reason: "mail_not_configured",
    }
    await recordNotificationDelivery(event, session, result)
    return { delivery: result, plan }
  }

  try {
    await sendPlainTextEmail({
      body,
      headers,
      subject: plan.subject,
      toEmail: plan.recipientEmail,
    })

    const result: NotificationDeliveryResult = {
      ...baseResult,
      configured: true,
      delivered: true,
      error: null,
      reason: "sent",
    }
    await recordNotificationDelivery(event, session, result)
    return { delivery: result, plan }
  }
  catch (error) {
    const result: NotificationDeliveryResult = {
      ...baseResult,
      configured: true,
      delivered: false,
      error: error instanceof Error ? error.message : "Lifecycle email delivery failed",
      reason: "delivery_failed",
    }
    await recordNotificationDelivery(event, session, result)
    return { delivery: result, plan }
  }
}

export async function sendUnreadNotificationDigest(event: H3Event, seed: WorkspaceSeed, session: SessionUser, options: UnreadNotificationDigestOptions = {}) {
  const footerOptions = resolvePreferenceFooterOptions(event, "digest", {
    email: session.email,
    userId: session.id,
  })
  const { body, snapshot } = buildDigestContent(seed, session, footerOptions)
  const headers = buildNotificationPreferenceHeaders("digest", footerOptions)
  const subject = buildDigestSubject(snapshot.actions.length)

  if (options.skipIfEmpty && !snapshot.actions.length) {
    return {
      configured: isContactMailConfigured(),
      delivered: false,
      error: null,
      reason: "no_workspace_items",
      skipped: true,
      subject,
      unreadCount: 0,
    } satisfies NotificationDeliveryResult
  }

  if (options.respectPreferences && !isScheduledDigestEmailEnabled(seed, session.id)) {
    const result: NotificationDeliveryResult = {
      bodyPreview: buildLifecycleBodyPreview(body),
      configured: false,
      delivered: false,
      error: "Scheduled digest email is disabled for this member.",
      reason: "email_digest_disabled",
      subject,
      suppressed: true,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }

  if (!isContactMailConfigured()) {
    const result: NotificationDeliveryResult = {
      bodyPreview: buildLifecycleBodyPreview(body),
      configured: false,
      delivered: false,
      error: null,
      reason: "mail_not_configured",
      subject,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }

  try {
    await sendPlainTextEmail({
      body,
      headers,
      subject,
      toEmail: session.email,
    })

    const result: NotificationDeliveryResult = {
      bodyPreview: buildLifecycleBodyPreview(body),
      configured: true,
      delivered: true,
      error: null,
      reason: "sent",
      subject,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }
  catch (error) {
    const result: NotificationDeliveryResult = {
      bodyPreview: buildLifecycleBodyPreview(body),
      configured: true,
      delivered: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
      reason: "delivery_failed",
      subject,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }
}
