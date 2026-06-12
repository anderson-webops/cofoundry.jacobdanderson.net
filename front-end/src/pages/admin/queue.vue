<script setup lang="ts">
import type { ProductionReadinessPayload } from "../../../server/utils/production-readiness"
import type { AccessRequest, PrivacyRequest } from "~/shared/types/domain"
import type { AdminCommandQueueItem, AdminCommandQueueKind, AdminCommandQueuePriority, AdminCommandQueueSlaStatus } from "~/shared/utils/admin"
import { buildAdminCommandQueue } from "~/shared/utils/admin"
import { formatDate, formatRelativeDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin command queue")

interface AccessRequestResponse {
  requests: AccessRequest[]
}

interface PrivacyRequestResponse {
  requests: PrivacyRequest[]
}

const requestFetch = useRequestFetch()
const authStore = useAuthStore()
const toastStore = useToastStore()
const workspaceStore = useWorkspaceStore()
const pendingAction = ref("")

const filters = reactive({
  kind: "all",
  priority: "all",
  query: "",
})

const { data, pending, refresh } = await useAsyncData("admin-command-queue", async () => {
  const [readiness, access, privacy] = await Promise.all([
    requestFetch<ProductionReadinessPayload>("/api/admin/readiness"),
    requestFetch<AccessRequestResponse>("/api/admin/access-requests"),
    requestFetch<PrivacyRequestResponse>("/api/admin/privacy-requests"),
  ])

  return { access, privacy, readiness }
})

const queueItems = computed(() => buildAdminCommandQueue({
  accessRequests: data.value?.access.requests || [],
  generatedAt: data.value?.readiness.generatedAt,
  privacyRequests: data.value?.privacy.requests || [],
  readinessChecks: data.value?.readiness.groups.flatMap(group => group.checks.map(check => ({
    ...check,
    groupTitle: group.title,
  }))) || [],
  seed: workspaceStore.data,
}))

const filteredItems = computed(() => {
  const query = filters.query.trim().toLowerCase()

  return queueItems.value.filter((item) => {
    if (filters.kind !== "all" && item.kind !== filters.kind)
      return false

    if (filters.priority !== "all" && item.priority !== filters.priority)
      return false

    if (!query)
      return true

    return [
      item.title,
      item.summary,
      item.detail,
      item.sourceLabel,
      item.statusLabel,
    ].some(value => value.toLowerCase().includes(query))
  })
})

const counts = computed(() => ({
  access: queueItems.value.filter(item => item.kind === "access").length,
  critical: queueItems.value.filter(item => item.priority === "critical").length,
  escalated: queueItems.value.filter(item => item.escalatedAt).length,
  high: queueItems.value.filter(item => item.priority === "high").length,
  moderation: queueItems.value.filter(item => item.kind === "moderation").length,
  overdue: queueItems.value.filter(item => item.slaStatus === "overdue").length,
  privacy: queueItems.value.filter(item => item.kind === "privacy").length,
  readiness: queueItems.value.filter(item => item.kind === "readiness").length,
  unassigned: queueItems.value.filter(item => !item.ownerUserId).length,
}))

const kindOptions = [
  { label: "All work", value: "all" },
  { label: "Moderation", value: "moderation" },
  { label: "Access", value: "access" },
  { label: "Privacy", value: "privacy" },
  { label: "Readiness", value: "readiness" },
]

const priorityOptions = [
  { label: "All priorities", value: "all" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Standard", value: "standard" },
]

function priorityTone(priority: AdminCommandQueuePriority) {
  return {
    critical: "danger" as const,
    high: "warning" as const,
    standard: "neutral" as const,
  }[priority]
}

function slaTone(status: AdminCommandQueueSlaStatus) {
  return {
    due_soon: "warning" as const,
    on_track: "neutral" as const,
    overdue: "danger" as const,
  }[status]
}

function kindTone(kind: AdminCommandQueueKind) {
  return {
    access: "accent" as const,
    moderation: "warning" as const,
    privacy: "neutral" as const,
    readiness: "danger" as const,
  }[kind]
}

function kindLabel(kind: AdminCommandQueueKind) {
  return {
    access: "Access",
    moderation: "Moderation",
    privacy: "Privacy",
    readiness: "Readiness",
  }[kind]
}

function canReviewEvidence(item: AdminCommandQueueItem) {
  return item.kind === "moderation" || item.kind === "privacy"
}

function defaultQueueActionNote(item: AdminCommandQueueItem, action: "assign" | "escalate" | "review_evidence") {
  const actor = authStore.currentUser?.name || authStore.currentUser?.email || "Admin"

  if (action === "assign")
    return `${actor} claimed ${item.title.toLowerCase()} for follow-up.`

  if (action === "escalate")
    return `${actor} escalated ${item.title.toLowerCase()} because it needs priority operator review.`

  return `${actor} reviewed the available evidence for ${item.title.toLowerCase()}.`
}

async function recordQueueAction(item: AdminCommandQueueItem, action: "assign" | "escalate" | "review_evidence") {
  pendingAction.value = `${item.id}:${action}`

  try {
    await requestFetch("/api/admin/queue/action", {
      body: {
        action,
        notes: defaultQueueActionNote(item, action),
        targetId: item.targetId,
        targetType: item.targetType,
      },
      method: "POST",
    })
    await workspaceStore.loadWorkspace(true)
    await refresh()

    toastStore.push({
      title: action === "assign" ? "Case assigned" : action === "escalate" ? "Case escalated" : "Evidence reviewed",
      message: "The audit trail has been updated and the command queue was refreshed.",
      tone: action === "escalate" ? "warning" : "success",
    })
  }
  catch (caughtError) {
    toastStore.push({
      title: "Queue action failed",
      message: caughtError instanceof Error ? caughtError.message : "The queue action could not be saved.",
      tone: "danger",
    })
  }
  finally {
    pendingAction.value = ""
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Command queue"
      description="One priority-ordered queue for reports, access reviews, privacy requests, and launch-readiness work."
    >
      <template #actions>
        <BaseBadge :tone="counts.critical ? 'danger' : counts.high ? 'warning' : 'success'">
          {{ counts.critical }} critical
        </BaseBadge>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-3 xl:grid-cols-6">
      <MetricTile label="Critical" :value="counts.critical" context="Blocking or high-risk work." />
      <MetricTile label="Overdue" :value="counts.overdue" context="Past the queue SLA window." />
      <MetricTile label="Unassigned" :value="counts.unassigned" context="Needs an accountable operator." />
      <MetricTile label="Escalated" :value="counts.escalated" context="Already raised for priority review." />
      <MetricTile label="Moderation" :value="counts.moderation" context="Reports awaiting review." />
      <MetricTile label="Readiness" :value="counts.readiness" context="Deployment checks requiring follow-up." />
    </div>

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-[minmax(0,1fr)_220px_220px]">
        <TextInput
          v-model="filters.query"
          label="Search queue"
          placeholder="Surface, source, detail, or status"
          helper="Use this as the operator's starting point before opening specialized admin views."
        />
        <SelectInput v-model="filters.kind" label="Work type" :options="kindOptions" />
        <SelectInput v-model="filters.priority" label="Priority" :options="priorityOptions" />
      </div>
    </section>

    <section class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Next operator actions
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            Items are sorted by severity first, then newest activity. Open the specialized view to complete the action and preserve the audit trail.
          </p>
        </div>
        <BaseBadge tone="accent">
          {{ filteredItems.length }} visible
        </BaseBadge>
      </div>

      <div v-if="filteredItems.length" class="surface-row-list mt-5">
        <article v-for="item in filteredItems" :key="item.id" class="surface-row">
          <div class="gap-5 grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="priorityTone(item.priority)">
                  {{ item.priority }}
                </BaseBadge>
                <BaseBadge :tone="kindTone(item.kind)">
                  {{ kindLabel(item.kind) }}
                </BaseBadge>
                <BaseBadge tone="neutral">
                  {{ item.statusLabel }}
                </BaseBadge>
                <BaseBadge :tone="slaTone(item.slaStatus)">
                  {{ item.slaLabel }}
                </BaseBadge>
                <BaseBadge :tone="item.ownerUserId ? 'success' : 'warning'">
                  {{ item.ownerLabel }}
                </BaseBadge>
                <BaseBadge v-if="item.escalatedAt" tone="danger">
                  Escalated
                </BaseBadge>
                <BaseBadge v-if="item.evidenceReviewedAt" tone="success">
                  Evidence reviewed
                </BaseBadge>
              </div>

              <h3 class="text-base font-semibold mt-4">
                {{ item.title }}
              </h3>
              <p class="text-sm leading-6 mt-2">
                {{ item.summary }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.detail }}
              </p>
              <p class="text-xs text-[var(--muted)] mt-4">
                {{ item.sourceLabel }}
                <span v-if="item.createdAt">
                  · {{ formatDate(item.createdAt) }} · {{ formatRelativeDate(item.createdAt) }}
                </span>
              </p>
            </div>

            <div class="flex flex-wrap gap-2 lg:justify-end">
              <BaseButton
                v-if="item.ownerUserId !== authStore.currentUser?.id"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="recordQueueAction(item, 'assign')"
              >
                {{ pendingAction === `${item.id}:assign` ? "Assigning..." : "Assign to me" }}
              </BaseButton>
              <BaseButton
                v-if="!item.escalatedAt"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="recordQueueAction(item, 'escalate')"
              >
                {{ pendingAction === `${item.id}:escalate` ? "Escalating..." : "Escalate" }}
              </BaseButton>
              <BaseButton
                v-if="canReviewEvidence(item) && !item.evidenceReviewedAt"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="recordQueueAction(item, 'review_evidence')"
              >
                {{ pendingAction === `${item.id}:review_evidence` ? "Saving..." : "Evidence reviewed" }}
              </BaseButton>
              <BaseButton variant="secondary" :to="item.href">
                {{ item.actionLabel }}
              </BaseButton>
            </div>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        class="mt-6"
        icon="i-carbon-checkmark-outline"
        title="No queue items match these filters"
        description="Clear the filters or refresh the page. New reports, requests, and readiness warnings will appear here."
      />
    </section>
  </div>
</template>
