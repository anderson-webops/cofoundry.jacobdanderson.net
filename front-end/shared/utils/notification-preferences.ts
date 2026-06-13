import type { NotificationPreferences } from "../types/domain"

export function normalizeNotificationPreferences(preferences?: Partial<NotificationPreferences> | null): NotificationPreferences {
  return {
    unreadDigestEmail: preferences?.unreadDigestEmail === true,
    workflowEmail: preferences?.workflowEmail === true,
  }
}

export function isWorkflowLifecycleEvent(eventType: string) {
  return eventType === "intro.received"
    || eventType === "intro.accepted"
    || eventType === "match.created"
    || eventType === "message.unread"
    || eventType === "proposal.received"
    || eventType === "proposal.updated"
    || eventType === "contract.signature_required"
}
