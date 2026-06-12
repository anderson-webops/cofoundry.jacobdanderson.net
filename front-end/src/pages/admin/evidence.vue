<script setup lang="ts">
import type { AdminAction, PrivacyRequest } from "~/shared/types/domain"
import type { AdminEvidencePackage, AdminEvidencePackageState } from "~/shared/utils/evidence"
import { mergeAdminActions } from "~/shared/utils/admin"
import { buildAdminEvidencePackages } from "~/shared/utils/evidence"
import { formatDate, formatRelativeDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin evidence review")

type OpsRow = Record<string, unknown>

interface OperationsPayload {
  backupRuns: OpsRow[]
  fileUploads: OpsRow[]
  mode: string
  notificationDeliveries: OpsRow[]
  operationalEvents: OpsRow[]
}

interface AdminAuditPayload {
  actions: AdminAction[]
}

interface PrivacyRequestResponse {
  requests: PrivacyRequest[]
}

const requestFetch = useRequestFetch()
const authStore = useAuthStore()
const toastStore = useToastStore()
const workspaceStore = useWorkspaceStore()
const pendingAction = ref("")

const filters = reactive<{
  query: string
  state: AdminEvidencePackageState | "all"
}>({
  query: "",
  state: "all",
})

const { data, pending, refresh } = await useAsyncData("admin-evidence", async () => {
  const [audit, operations, privacy] = await Promise.all([
    requestFetch<AdminAuditPayload>("/api/admin/audit"),
    requestFetch<OperationsPayload>("/api/admin/operations"),
    requestFetch<PrivacyRequestResponse>("/api/admin/privacy-requests"),
  ])

  return { audit, operations, privacy }
})

const adminActions = computed(() => mergeAdminActions(data.value?.audit.actions || [], workspaceStore.data.adminActions))

const evidencePackages = computed(() => buildAdminEvidencePackages({
  adminActions: adminActions.value,
  fileUploads: data.value?.operations.fileUploads || [],
  privacyRequests: data.value?.privacy.requests || [],
  seed: workspaceStore.data,
}))

const filteredPackages = computed(() => {
  const query = filters.query.trim().toLowerCase()

  return evidencePackages.value.filter((item) => {
    if (filters.state !== "all" && item.state !== filters.state)
      return false

    if (!query)
      return true

    return [
      item.filename,
      item.ownerLabel,
      item.privacyRequestDetails,
      item.scanNotes,
      item.summary,
      item.title,
      item.userId,
    ].some(value => value?.toLowerCase().includes(query))
  })
})

const counts = computed(() => ({
  flagged: evidencePackages.value.filter(item => item.state === "flagged").length,
  needsReview: evidencePackages.value.filter(item => item.state === "needs_review" || item.state === "request_only").length,
  needsScan: evidencePackages.value.filter(item => item.state === "needs_scan").length,
  reviewed: evidencePackages.value.filter(item => item.state === "reviewed").length,
  total: evidencePackages.value.length,
}))

const stateOptions = [
  { label: "All states", value: "all" },
  { label: "Needs scan", value: "needs_scan" },
  { label: "Flagged", value: "flagged" },
  { label: "Needs review", value: "needs_review" },
  { label: "Needs evidence", value: "request_only" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Resolved", value: "resolved" },
]

function stateTone(state: AdminEvidencePackageState) {
  return {
    flagged: "danger" as const,
    needs_review: "warning" as const,
    needs_scan: "warning" as const,
    request_only: "accent" as const,
    resolved: "success" as const,
    reviewed: "success" as const,
  }[state]
}

function scanTone(scanStatus: AdminEvidencePackage["scanStatus"]) {
  if (scanStatus === "clean")
    return "success"

  if (scanStatus === "flagged" || scanStatus === "failed")
    return "danger"

  return "warning"
}

function formatFileSize(sizeBytes: number | null) {
  if (!sizeBytes)
    return "No size"

  if (sizeBytes < 1024)
    return `${sizeBytes} B`

  if (sizeBytes < 1024 * 1024)
    return `${Math.round(sizeBytes / 1024)} KB`

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function defaultReviewNote(item: AdminEvidencePackage) {
  const actor = authStore.currentUser?.name || authStore.currentUser?.email || "Admin"
  return `${actor} reviewed the evidence package for ${item.ownerLabel}.`
}

function defaultScanNote(item: AdminEvidencePackage, scanStatus: "clean" | "flagged") {
  const actor = authStore.currentUser?.name || authStore.currentUser?.email || "Admin"
  return scanStatus === "clean"
    ? `${actor} manually reviewed ${item.title} and marked the file clean.`
    : `${actor} manually reviewed ${item.title} and flagged the file for operator follow-up.`
}

async function refreshEvidence() {
  await Promise.all([
    refresh(),
    workspaceStore.loadWorkspace(true),
  ])
}

async function recordEvidenceReview(item: AdminEvidencePackage) {
  pendingAction.value = `${item.id}:review`

  try {
    await requestFetch("/api/admin/queue/action", {
      body: {
        action: "review_evidence",
        notes: defaultReviewNote(item),
        targetId: item.targetId,
        targetType: item.targetType,
      },
      method: "POST",
    })
    await refreshEvidence()

    toastStore.push({
      title: "Evidence reviewed",
      message: "The review action has been added to the admin audit log.",
      tone: "success",
    })
  }
  catch (caughtError) {
    toastStore.push({
      title: "Evidence review failed",
      message: caughtError instanceof Error ? caughtError.message : "The evidence review could not be saved.",
      tone: "danger",
    })
  }
  finally {
    pendingAction.value = ""
  }
}

async function recordFileScan(item: AdminEvidencePackage, scanStatus: "clean" | "flagged") {
  if (item.targetType !== "file_upload")
    return

  pendingAction.value = `${item.id}:scan:${scanStatus}`

  try {
    await requestFetch(`/api/admin/files/${item.targetId}/scan`, {
      body: {
        notes: defaultScanNote(item, scanStatus),
        scanStatus,
        status: scanStatus === "clean" ? "uploaded" : "blocked",
      },
      method: "POST",
    })
    await refreshEvidence()

    toastStore.push({
      title: scanStatus === "clean" ? "File marked clean" : "File flagged",
      message: "The scan result has been persisted and operations data was refreshed.",
      tone: scanStatus === "clean" ? "success" : "warning",
    })
  }
  catch (caughtError) {
    toastStore.push({
      title: "Scan update failed",
      message: caughtError instanceof Error ? caughtError.message : "The file scan status could not be saved.",
      tone: "danger",
    })
  }
  finally {
    pendingAction.value = ""
  }
}

function canUpdateScan(item: AdminEvidencePackage) {
  return item.targetType === "file_upload" && ["pending", "failed", "skipped"].includes(item.scanStatus || "")
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Evidence review"
      description="A consolidated operator view for trust evidence uploads, safety/privacy review context, scan disposition, and evidence-review audit actions."
    >
      <template #actions>
        <BaseBadge :tone="counts.flagged ? 'danger' : counts.needsScan || counts.needsReview ? 'warning' : 'success'">
          {{ counts.flagged }} flagged
        </BaseBadge>
        <BaseButton variant="secondary" :disabled="pending" @click="refreshEvidence">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-5">
      <MetricTile label="Total" :value="counts.total" context="Trust evidence packages and safety/privacy requests." />
      <MetricTile label="Needs scan" :value="counts.needsScan" context="Files awaiting scanner or operator disposition." />
      <MetricTile label="Flagged" :value="counts.flagged" context="Evidence blocked or flagged for follow-up." />
      <MetricTile label="Needs review" :value="counts.needsReview" context="Clean evidence or requests waiting on operator judgment." />
      <MetricTile label="Reviewed" :value="counts.reviewed" context="Evidence with an audit-backed review action." />
    </div>

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-[minmax(0,1fr)_220px]">
        <TextInput
          v-model="filters.query"
          label="Search evidence"
          placeholder="Member, filename, request, notes"
          helper="Search uploads, safety/privacy request context, and scan notes."
        />
        <SelectInput v-model="filters.state" label="State" :options="stateOptions" />
      </div>
    </section>

    <section class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Review queue
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            Review the scan result first, then record an evidence-review action once the operator decision is complete.
          </p>
        </div>
        <BaseBadge tone="accent">
          {{ filteredPackages.length }} visible
        </BaseBadge>
      </div>

      <div v-if="filteredPackages.length" class="surface-row-list mt-5">
        <article v-for="item in filteredPackages" :key="item.id" class="surface-row">
          <div class="gap-5 grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="stateTone(item.state)">
                  {{ item.stateLabel }}
                </BaseBadge>
                <BaseBadge v-if="item.scanStatus" :tone="scanTone(item.scanStatus)">
                  Scan {{ item.scanStatus }}
                </BaseBadge>
                <BaseBadge v-if="item.uploadStatus" tone="neutral">
                  Upload {{ item.uploadStatus }}
                </BaseBadge>
                <BaseBadge v-if="item.privacyRequestStatus" tone="accent">
                  Privacy {{ item.privacyRequestStatus }}
                </BaseBadge>
              </div>

              <h3 class="text-base font-semibold mt-4">
                {{ item.title }}
              </h3>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.ownerLabel }} · {{ item.filename || "No file attached yet" }} · {{ formatFileSize(item.sizeBytes) }}
              </p>
              <p class="text-sm leading-6 mt-3">
                {{ item.summary }}
              </p>

              <div class="muted text-xs leading-6 mt-4">
                <p>
                  Created {{ formatDate(item.createdAt) }} · {{ formatRelativeDate(item.createdAt) }}
                </p>
                <p v-if="item.reviewedAt">
                  Reviewed by {{ item.reviewedByLabel || item.reviewedByUserId || "Admin" }} · {{ formatDate(item.reviewedAt) }}
                </p>
                <p v-if="item.relatedType && item.relatedId">
                  Related {{ item.relatedType }}: {{ item.relatedId }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-2 xl:justify-end">
              <BaseButton
                v-if="canUpdateScan(item)"
                variant="secondary"
                :disabled="Boolean(pendingAction)"
                @click="recordFileScan(item, 'clean')"
              >
                {{ pendingAction === `${item.id}:scan:clean` ? "Saving..." : "Mark clean" }}
              </BaseButton>
              <BaseButton
                v-if="canUpdateScan(item)"
                variant="danger"
                :disabled="Boolean(pendingAction)"
                @click="recordFileScan(item, 'flagged')"
              >
                {{ pendingAction === `${item.id}:scan:flagged` ? "Flagging..." : "Flag file" }}
              </BaseButton>
              <BaseButton
                v-if="item.state !== 'reviewed' && item.state !== 'resolved'"
                :disabled="Boolean(pendingAction)"
                @click="recordEvidenceReview(item)"
              >
                {{ pendingAction === `${item.id}:review` ? "Saving..." : "Evidence reviewed" }}
              </BaseButton>
              <BaseButton v-if="item.privacyRequestId" variant="secondary" to="/admin/privacy">
                Privacy context
              </BaseButton>
              <BaseButton variant="secondary" to="/admin/operations">
                Operations
              </BaseButton>
            </div>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        class="mt-5"
        icon="i-carbon-document-attachment"
        title="No evidence packages match these filters"
        description="Trust evidence uploads and safety/privacy requests will appear here once members submit them or operations workers report file activity."
      />
    </section>
  </div>
</template>
