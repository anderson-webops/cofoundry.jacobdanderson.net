<script setup lang="ts">
import { computed } from "vue"
import { useAsyncData, useRequestFetch } from "#app"
import { definePageMeta } from "#app/composables/pages"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { formatDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Operations")

type OpsRow = Record<string, unknown>

interface OperationsPayload {
  backupRuns: OpsRow[]
  contractEnvelopeEvents: OpsRow[]
  emailSuppressions: OpsRow[]
  fileUploads: OpsRow[]
  mode: string
  notificationDeliveries: OpsRow[]
  operationalEvents: OpsRow[]
  trustVerificationEvents: OpsRow[]
}

const requestFetch = useRequestFetch()
const { data, pending, refresh } = await useAsyncData("admin-operations", () => requestFetch<OperationsPayload>("/api/admin/operations"))

const cards = computed(() => [
  {
    count: data.value?.notificationDeliveries.length || 0,
    description: "Recent email digest and operational notification attempts.",
    rows: data.value?.notificationDeliveries || [],
    title: "Notification delivery",
  },
  {
    count: data.value?.fileUploads.length || 0,
    description: "Recent file uploads waiting for or carrying scan status.",
    rows: data.value?.fileUploads || [],
    title: "File scanning",
  },
  {
    count: data.value?.emailSuppressions.length || 0,
    description: "Provider-reported bounces, complaints, unsubscribes, and manual email blocks.",
    rows: data.value?.emailSuppressions || [],
    title: "Email suppressions",
  },
  {
    count: data.value?.contractEnvelopeEvents.length || 0,
    description: "E-signature or PDF provider envelope status mapped back to CoFoundry contracts.",
    rows: data.value?.contractEnvelopeEvents || [],
    title: "Contract envelopes",
  },
  {
    count: data.value?.trustVerificationEvents.length || 0,
    description: "Provider-reported identity, social, domain, and ownership checks awaiting operator policy or review.",
    rows: data.value?.trustVerificationEvents || [],
    title: "Trust verifications",
  },
  {
    count: data.value?.backupRuns.length || 0,
    description: "Recorded backup runs from the external server schedule.",
    rows: data.value?.backupRuns || [],
    title: "Backups",
  },
  {
    count: data.value?.operationalEvents.length || 0,
    description: "Recent server-side operational events and alerts.",
    rows: data.value?.operationalEvents || [],
    title: "Observability",
  },
])

function rowStatus(row: OpsRow) {
  return String(row.status || row.scan_status || row.severity || row.reason || "recorded")
}

function readable(value: unknown) {
  return String(value || "").replaceAll("_", " ")
}

function rowTitle(row: OpsRow) {
  if (row.verification_type && row.target_id)
    return `${readable(row.verification_type)} · ${row.target_id}`

  return String(row.subject || row.original_filename || row.email || row.provider_envelope_id || row.event_type || row.provider || row.id || "Record")
}

function rowDate(row: OpsRow) {
  const value = row.created_at || row.occurred_at || row.suppressed_at || row.started_at
  return typeof value === "string"
    ? formatDate(value)
    : "No date"
}

function rowDetail(row: OpsRow) {
  const details = [
    row.event_type
      ? `event ${row.event_type}`
      : "",
    row.target_type && row.target_id
      ? `${row.target_type} ${row.target_id}`
      : "",
    row.verification_type
      ? `check ${readable(row.verification_type)}`
      : "",
    row.recipient
      ? `recipient ${row.recipient}`
      : "",
    row.contract_id
      ? `contract ${row.contract_id}`
      : "",
    row.contract_version_id
      ? `version ${row.contract_version_id}`
      : "",
    row.category
      ? `category ${row.category}`
      : "",
    row.provider
      ? `provider ${row.provider}`
      : "",
    row.provider_subject_id
      ? `subject ${row.provider_subject_id}`
      : "",
    typeof row.confidence === "number"
      ? `confidence ${Math.round(row.confidence * 100)}%`
      : "",
    row.evidence_file_upload_id
      ? `evidence ${row.evidence_file_upload_id}`
      : "",
    row.source_event_id
      ? `source ${row.source_event_id}`
      : "",
  ].filter(Boolean)

  return details.join(" · ")
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Operations"
      title="Production control surfaces"
      description="Delivery, file scanning, backups, trust verification, and operational events."
    >
      <template #actions>
        <BaseBadge :tone="data?.mode === 'supabase' ? 'success' : 'neutral'">
          {{ data?.mode || "loading" }}
        </BaseBadge>
        <BaseButton variant="secondary" to="/admin/readiness">
          Launch readiness
        </BaseButton>
        <BaseButton variant="secondary" to="/admin/evidence">
          Evidence review
        </BaseButton>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-5 grid xl:grid-cols-2">
      <section v-for="card in cards" :key="card.title" class="panel p-6">
        <div class="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              {{ card.title }}
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              {{ card.description }}
            </p>
          </div>
          <BaseBadge tone="accent">
            {{ card.count }} recent
          </BaseBadge>
        </div>

        <div v-if="card.rows.length" class="surface-row-list mt-5">
          <article v-for="row in card.rows" :key="String(row.id)" class="surface-row">
            <div class="flex gap-3 items-start justify-between">
              <div class="min-w-0">
                <p class="text-sm font-semibold">
                  {{ rowTitle(row) }}
                </p>
                <p class="muted text-xs tracking-[0.12em] mt-2 uppercase">
                  {{ rowStatus(row) }}
                </p>
                <p v-if="rowDetail(row)" class="muted text-xs leading-5 mt-2 break-words">
                  {{ rowDetail(row) }}
                </p>
              </div>
              <span class="text-xs text-[var(--muted)] whitespace-nowrap">
                {{ rowDate(row) }}
              </span>
            </div>
          </article>
        </div>

        <EmptyState
          v-else
          class="mt-5"
          icon="i-carbon-cloud-monitoring"
          title="No records yet"
          description="No records are available for this category."
        />
      </section>
    </div>
  </div>
</template>
