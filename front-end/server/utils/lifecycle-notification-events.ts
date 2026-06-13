import type { H3Event } from "h3"
import type { WorkspaceSeed } from "~/shared/types/domain"
import type { LifecycleNotificationRequest } from "~/shared/utils/lifecycle-notifications"
import { sendLifecycleNotification } from "./notification-delivery"
import { recordOperationalEvent } from "./operations-persistence"
import { isSupabaseEnabled } from "./supabase"

interface LifecycleNotificationEventOptions {
  source: string
}

export async function emitLifecycleNotificationEvent(
  event: H3Event,
  seed: WorkspaceSeed,
  request: LifecycleNotificationRequest,
  options: LifecycleNotificationEventOptions,
) {
  try {
    return await sendLifecycleNotification(event, seed, {
      ...request,
      metadata: {
        source: options.source,
        ...(request.metadata || {}),
      },
    }, {
      forceRecordOnlyReason: isSupabaseEnabled(event) ? undefined : "mock_mode",
    })
  }
  catch (error) {
    try {
      await recordOperationalEvent(event, {
        eventType: "lifecycle_notification.failed",
        metadata: {
          error: error instanceof Error ? error.message : "Lifecycle notification failed.",
          notificationEventType: request.eventType,
          notificationTargetId: request.targetId,
          notificationTargetType: request.targetType || null,
          notificationUserId: request.userId,
          source: options.source,
        },
        severity: "warning",
        source: "lifecycle-notification",
        targetId: request.targetId,
        targetType: request.targetType || null,
      })
    }
    catch (recordError) {
      console.error("CoFoundry lifecycle notification failure could not be recorded:", recordError)
    }

    return null
  }
}

export async function emitLifecycleNotificationEvents(
  event: H3Event,
  seed: WorkspaceSeed,
  requests: LifecycleNotificationRequest[],
  options: LifecycleNotificationEventOptions,
) {
  const results = []

  for (const request of requests)
    results.push(await emitLifecycleNotificationEvent(event, seed, request, options))

  return results
}
