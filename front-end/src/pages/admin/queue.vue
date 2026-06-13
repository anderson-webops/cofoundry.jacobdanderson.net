<script setup lang="ts">
import type { ProductionReadinessPayload } from "../../../server/utils/production-readiness"
import type { AccessRequest, AdminAction, AdminEscalationQueue, OpportunityVerificationStatus, PrivacyRequest, Profile, StartupOpportunity, User } from "~/shared/types/domain"
import type { AdminCommandQueueItem, AdminCommandQueueKind, AdminCommandQueuePriority, AdminCommandQueueSlaStatus } from "~/shared/utils/admin"
import { buildAdminCommandQueue, defaultAdminEscalationQueueForTarget, formatAdminEscalationQueue, mergeAdminActions } from "~/shared/utils/admin"
import { formatDate, formatOpportunityVerificationStatus, formatRelativeDate } from "~/shared/utils/format"

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

interface AdminAuditPayload {
  actions: AdminAction[]
}

interface AdminOpportunitiesPayload {
  mode: "mock" | "supabase"
  opportunities: StartupOpportunity[]
  profiles: Profile[]
  users: User[]
}

const requestFetch = useRequestFetch()
const authStore = useAuthStore()
const toastStore = useToastStore()
const workspaceStore = useWorkspaceStore()
const pendingAction = ref("")
const assignmentByItem = reactive<Record<string, string>>({})
const escalationQueueByItem = reactive<Record<string, AdminEscalationQueue>>({})

const filters = reactive({
  kind: "all",
  priority: "all",
  query: "",
})

const { data, pending, refresh } = await useAsyncData("admin-command-queue", async () => {
  const [readiness, access, privacy, audit, opportunities] = await Promise.all([
    requestFetch<ProductionReadinessPayload>("/api/admin/readiness"),
    requestFetch<AccessRequestResponse>("/api/admin/access-requests"),
    requestFetch<PrivacyRequestResponse>("/api/admin/privacy-requests"),
    requestFetch<AdminAuditPayload>("/api/admin/audit"),
    requestFetch<AdminOpportunitiesPayload>("/api/admin/opportunities"),
  ])

  return { access, audit, opportunities, privacy, readiness }
})

function mergeRowsById<T extends { id: string }>(primary: T[], fallback: T[]) {
  const primaryIds = new Set(primary.map(row => row.id))
  return [
    ...primary,
    ...fallback.filter(row => !primaryIds.has(row.id)),
  ]
}

const queueSeed = computed(() => ({
  ...workspaceStore.data,
  adminActions: mergeAdminActions(data.value?.audit.actions || [], workspaceStore.data.adminActions),
  opportunities: mergeRowsById(data.value?.opportunities.opportunities || [], workspaceStore.data.opportunities),
  profiles: mergeRowsById(data.value?.opportunities.profiles || [], workspaceStore.data.profiles),
  users: mergeRowsById(data.value?.opportunities.users || [], workspaceStore.data.users),
}))

const queueItems = computed(() => buildAdminCommandQueue({
  accessRequests: data.value?.access.requests || [],
  generatedAt: data.value?.readiness.generatedAt,
  privacyRequests: data.value?.privacy.requests || [],
  readinessChecks: data.value?.readiness.groups.flatMap(group => group.checks.map(check => ({
    ...check,
    groupTitle: group.title,
  }))) || [],
  seed: queueSeed.value,
}))

const assignableAdmins = computed(() => {
  const admins = workspaceStore.data.users
    .filter(user => ["admin", "investor_admin"].includes(user.role))
    .map((user) => {
      const profile = workspaceStore.data.profiles.find(item => item.userId === user.id)
      return {
        id: user.id,
        label: profile?.displayName || user.email,
      }
    })

  if (
    authStore.currentUser
    && ["admin", "investor_admin"].includes(authStore.currentUser.role)
    && !admins.some(admin => admin.id === authStore.currentUser?.id)
  ) {
    admins.unshift({
      id: authStore.currentUser.id,
      label: authStore.currentUser.name || authStore.currentUser.email,
    })
  }

  return admins
})

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

function selectedAssigneeId(item: AdminCommandQueueItem) {
  return assignmentByItem[item.id]
    || item.ownerUserId
    || authStore.currentUser?.id
    || assignableAdmins.value[0]?.id
    || ""
}

function selectedAssigneeLabel(item: AdminCommandQueueItem) {
  const selectedId = selectedAssigneeId(item)
  return assignableAdmins.value.find(admin => admin.id === selectedId)?.label || selectedId || "an admin"
}

function updateAssignee(item: AdminCommandQueueItem, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  assignmentByItem[item.id] = value
}

const escalationQueueOptions: Array<{ label: string, value: AdminEscalationQueue }> = [
  { label: "Trust and safety", value: "trust_safety" },
  { label: "Operations", value: "operations" },
  { label: "Founder success", value: "founder_success" },
  { label: "Billing operations", value: "billing" },
]

function selectedEscalationQueue(item: AdminCommandQueueItem) {
  return escalationQueueByItem[item.id]
    || item.escalationQueue
    || defaultAdminEscalationQueueForTarget(item.targetType)
}

function updateEscalationQueue(item: AdminCommandQueueItem, event: Event) {
  escalationQueueByItem[item.id] = (event.target as HTMLSelectElement).value as AdminEscalationQueue
}

function canReviewEvidence(item: AdminCommandQueueItem) {
  return item.kind === "moderation" || item.kind === "privacy"
}

function canVerifyOpportunity(item: AdminCommandQueueItem) {
  return item.targetType === "opportunity"
}

function defaultQueueActionNote(item: AdminCommandQueueItem, action: "assign" | "escalate" | "review_evidence") {
  const actor = authStore.currentUser?.name || authStore.currentUser?.email || "Admin"

  if (action === "assign")
    return `${actor} assigned ${item.title.toLowerCase()} to ${selectedAssigneeLabel(item)}.`

  if (action === "escalate")
    return `${actor} escalated ${item.title.toLowerCase()} to ${formatAdminEscalationQueue(selectedEscalationQueue(item))}.`

  return `${actor} reviewed the available evidence for ${item.title.toLowerCase()}.`
}

function defaultOpportunityVerificationNote(item: AdminCommandQueueItem, status: Exclude<OpportunityVerificationStatus, "manual_review">) {
  const actor = authStore.currentUser?.name || authStore.currentUser?.email || "Admin"
  return `${actor} reviewed ${item.summary} and marked the listing ${formatOpportunityVerificationStatus(status).toLowerCase()}.`
}

async function recordQueueAction(item: AdminCommandQueueItem, action: "assign" | "escalate" | "review_evidence") {
  pendingAction.value = `${item.id}:${action}`

  try {
    const body: {
      action: "assign" | "escalate" | "review_evidence"
      assignedAdminUserId?: string
      escalationQueue?: AdminEscalationQueue
      notes: string
      targetId: string
      targetType: AdminCommandQueueItem["targetType"]
    } = {
      action,
      notes: defaultQueueActionNote(item, action),
      targetId: item.targetId,
      targetType: item.targetType,
    }

    if (action === "assign")
      body.assignedAdminUserId = selectedAssigneeId(item)

    if (action === "escalate")
      body.escalationQueue = selectedEscalationQueue(item)

    await requestFetch("/api/admin/queue/action", {
      body,
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

async function recordOpportunityVerification(item: AdminCommandQueueItem, status: Exclude<OpportunityVerificationStatus, "manual_review">) {
  pendingAction.value = `${item.id}:verify:${status}`

  try {
    await requestFetch(`/api/admin/opportunities/${item.targetId}/verification`, {
      body: {
        notes: defaultOpportunityVerificationNote(item, status),
        status,
      },
      method: "POST",
    })
    await workspaceStore.loadWorkspace(true)
    await refresh()

    toastStore.push({
      title: "Opportunity verification updated",
      message: "The listing status and audit trail were saved.",
      tone: status === "unverified" ? "warning" : "success",
    })
  }
  catch (caughtError) {
    toastStore.push({
      title: "Opportunity verification failed",
      message: caughtError instanceof Error ? caughtError.message : "The listing verification status could not be saved.",
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
                <BaseBadge v-if="item.assignedByLabel" tone="neutral">
                  Assigned by {{ item.assignedByLabel }}
                </BaseBadge>
                <BaseBadge v-if="item.escalatedAt" tone="danger">
                  Escalated<span v-if="item.escalationLabel"> · {{ item.escalationLabel }}</span>
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
              <label
                v-if="assignableAdmins.length"
                class="text-xs text-[var(--muted)] font-semibold gap-1 grid min-w-[10rem]"
              >
                <span>Owner</span>
                <select
                  class="text-xs text-[var(--text)] px-3 py-2 border border-[var(--line)] rounded-xl bg-[var(--panel-strong)]"
                  :value="selectedAssigneeId(item)"
                  :disabled="Boolean(pendingAction)"
                  @change="updateAssignee(item, $event)"
                >
                  <option v-for="admin in assignableAdmins" :key="admin.id" :value="admin.id">
                    {{ admin.label }}
                  </option>
                </select>
              </label>
              <BaseButton
                variant="secondary"
                :disabled="Boolean(pendingAction) || !selectedAssigneeId(item) || selectedAssigneeId(item) === item.ownerUserId"
                @click="recordQueueAction(item, 'assign')"
              >
                {{ pendingAction === `${item.id}:assign` ? "Assigning..." : "Assign" }}
              </BaseButton>
              <label
                v-if="!item.escalatedAt"
                class="text-xs text-[var(--muted)] font-semibold gap-1 grid min-w-[11rem]"
              >
                <span>Escalation route</span>
                <select
                  class="text-xs text-[var(--text)] px-3 py-2 border border-[var(--line)] rounded-xl bg-[var(--panel-strong)]"
                  :value="selectedEscalationQueue(item)"
                  :disabled="Boolean(pendingAction)"
                  @change="updateEscalationQueue(item, $event)"
                >
                  <option v-for="queue in escalationQueueOptions" :key="queue.value" :value="queue.value">
                    {{ queue.label }}
                  </option>
                </select>
              </label>
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
              <BaseButton
                v-if="canVerifyOpportunity(item)"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="recordOpportunityVerification(item, 'domain_verified')"
              >
                {{ pendingAction === `${item.id}:verify:domain_verified` ? "Saving..." : "Domain verified" }}
              </BaseButton>
              <BaseButton
                v-if="canVerifyOpportunity(item)"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="recordOpportunityVerification(item, 'owner_verified')"
              >
                {{ pendingAction === `${item.id}:verify:owner_verified` ? "Saving..." : "Owner verified" }}
              </BaseButton>
              <BaseButton
                v-if="canVerifyOpportunity(item)"
                variant="ghost"
                :disabled="Boolean(pendingAction)"
                @click="recordOpportunityVerification(item, 'unverified')"
              >
                {{ pendingAction === `${item.id}:verify:unverified` ? "Saving..." : "Keep unverified" }}
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
