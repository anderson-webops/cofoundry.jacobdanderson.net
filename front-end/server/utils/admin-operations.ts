import type { H3Event } from "h3"
import { readLocalOperationsRows } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

async function selectRows(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, table: string) {
  const { data, error } = await adminClient
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)

  if (error)
    throw error

  return data || []
}

export async function readAdminOperationsRows(event: H3Event) {
  if (!isSupabaseEnabled(event))
    return readLocalOperationsRows()

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const [backupRuns, contractEnvelopeEvents, emailSuppressions, fileUploads, notificationDeliveries, operationalEvents] = await Promise.all([
    selectRows(adminClient, "backup_runs"),
    selectRows(adminClient, "contract_provider_events"),
    selectRows(adminClient, "email_suppressions"),
    selectRows(adminClient, "file_uploads"),
    selectRows(adminClient, "notification_deliveries"),
    selectRows(adminClient, "operational_events"),
  ])

  return {
    backupRuns,
    contractEnvelopeEvents,
    emailSuppressions,
    fileUploads,
    mode: "supabase",
    notificationDeliveries,
    operationalEvents,
  }
}
