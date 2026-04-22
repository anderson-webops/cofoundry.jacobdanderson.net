<script setup lang="ts">
import type { AdminReportFilters, AdminReportRow } from "~/shared/utils/admin"
import { buildAdminReportRows, filterAdminReportRows } from "~/shared/utils/admin"
import { formatDate, formatRelativeDate, formatReportReason, formatReportStatus } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin reports")

const toastStore = useToastStore()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

const filters = reactive<AdminReportFilters>({
  query: "",
  status: "all",
  priority: "all",
  targetType: "all",
})

const moderationNotes = reactive<Record<string, string>>({})
const pendingByReportId = reactive<Record<string, boolean>>({})

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Open", value: "open" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Resolved", value: "resolved" },
]

const priorityOptions = [
  { label: "All priorities", value: "all" },
  { label: "Standard", value: "standard" },
  { label: "High", value: "high" },
]

const targetTypeOptions = [
  { label: "All targets", value: "all" },
  { label: "Profiles", value: "profile" },
  { label: "Messages", value: "message" },
  { label: "Opportunities", value: "opportunity" },
]

const rows = computed(() => filterAdminReportRows(buildAdminReportRows(workspaceStore.data), filters))

function buildDefaultNote(row: AdminReportRow, action: "reviewed" | "resolved") {
  if (action === "reviewed")
    return `Reviewed report on ${row.targetLabel} and captured initial moderation context.`

  return `Resolved report on ${row.targetLabel} after moderation review.`
}

async function updateReportStatus(row: AdminReportRow, status: "reviewed" | "resolved") {
  if (!authStore.currentUser)
    return

  pendingByReportId[row.report.id] = true

  try {
    const note = moderationNotes[row.report.id]?.trim() || buildDefaultNote(row, status)

    if (status === "reviewed") {
      await workspaceStore.reviewReport(row.report.id, authStore.currentUser.id, note)
      toastStore.push({
        title: "Report reviewed",
        message: "The report was moved into reviewed state and the audit log was updated.",
        tone: "success",
      })
    }
    else {
      await workspaceStore.resolveReport(row.report.id, authStore.currentUser.id, note)
      toastStore.push({
        title: "Report resolved",
        message: "The report has been resolved and the decision is now part of the audit history.",
        tone: "success",
      })
    }

    moderationNotes[row.report.id] = ""
  }
  catch (caughtError) {
    toastStore.push({
      title: "Report action failed",
      message: caughtError instanceof Error ? caughtError.message : "The moderation update could not be saved.",
      tone: "danger",
    })
  }
  finally {
    pendingByReportId[row.report.id] = false
  }
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Reports"
      description="Review flagged profiles, messages, and opportunities with explicit review and resolution states."
    />

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <TextInput
          v-model="filters.query"
          label="Search reports"
          placeholder="Reporter, target, or report details"
          helper="Search across moderation details and target context."
        />
        <SelectInput v-model="filters.status" label="Status" :options="statusOptions" />
        <SelectInput v-model="filters.priority" label="Priority" :options="priorityOptions" />
        <SelectInput v-model="filters.targetType" label="Target type" :options="targetTypeOptions" />
      </div>
    </section>

    <div class="gap-4 grid">
      <article v-for="row in rows" :key="row.report.id" class="panel p-6">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap gap-2">
              <BaseBadge :tone="row.report.status === 'open' ? 'warning' : row.report.status === 'reviewed' ? 'accent' : 'success'">
                {{ formatReportStatus(row.report.status) }}
              </BaseBadge>
              <BaseBadge :tone="row.report.priority === 'high' ? 'warning' : 'neutral'">
                {{ row.report.priority }} priority
              </BaseBadge>
            </div>

            <h2 class="text-lg font-semibold mt-4">
              {{ formatReportReason(row.report.reason) }} on {{ row.targetLabel }}
            </h2>
            <p class="muted text-xs tracking-[0.12em] mt-2 uppercase">
              {{ row.report.targetType }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ row.targetContext }}
            </p>
            <p class="text-sm leading-7 mt-4">
              {{ row.report.details }}
            </p>

            <div class="muted text-xs leading-5 mt-4">
              <p>Reporter: {{ row.reporterProfile?.displayName || row.reporter?.email || row.report.reporterUserId }}</p>
              <p>Opened {{ formatDate(row.report.createdAt) }} · {{ formatRelativeDate(row.report.createdAt) }}</p>
              <p v-if="row.report.reviewedAt">
                Reviewed {{ formatDate(row.report.reviewedAt) }}
              </p>
              <p v-if="row.report.resolvedAt">
                Resolved {{ formatDate(row.report.resolvedAt) }}
              </p>
            </div>

            <div v-if="row.report.reviewNotes" class="surface-divider mt-4">
              <p class="text-xs text-[var(--muted)] tracking-[0.12em] font-semibold uppercase">
                Review note
              </p>
              <p class="text-sm leading-6 mt-2">
                {{ row.report.reviewNotes }}
              </p>
            </div>

            <div v-if="row.report.resolutionNotes" class="surface-divider mt-4">
              <p class="text-xs text-[var(--muted)] tracking-[0.12em] font-semibold uppercase">
                Resolution note
              </p>
              <p class="text-sm leading-6 mt-2">
                {{ row.report.resolutionNotes }}
              </p>
            </div>
          </div>

          <div class="panel p-4 max-w-[360px] w-full">
            <h3 class="text-sm font-semibold">
              Moderation action
            </h3>
            <p class="muted text-xs leading-5 mt-2">
              Every action requires a short audit note and is validated on the server before the local workspace updates.
            </p>

            <label class="mt-4 block">
              <span class="sr-only">Moderation note</span>
              <textarea
                v-model="moderationNotes[row.report.id]"
                :aria-label="`Moderation note for report ${row.report.id}`"
                class="field-control min-h-[124px] resize-y"
                placeholder="Add the reason for your review or resolution decision"
              />
            </label>

            <div class="mt-4 flex flex-wrap gap-3">
              <BaseButton
                v-if="row.report.status === 'open'"
                variant="secondary"
                :disabled="pendingByReportId[row.report.id]"
                @click="updateReportStatus(row, 'reviewed')"
              >
                {{ pendingByReportId[row.report.id] ? "Saving..." : "Mark reviewed" }}
              </BaseButton>
              <BaseButton
                v-if="row.report.status !== 'resolved'"
                :disabled="pendingByReportId[row.report.id]"
                @click="updateReportStatus(row, 'resolved')"
              >
                {{ pendingByReportId[row.report.id] ? "Saving..." : "Resolve report" }}
              </BaseButton>
            </div>

            <p v-if="row.latestAdminAction" class="text-xs leading-5 mt-4">
              Latest audit entry: {{ row.latestAdminAction.notes }}
            </p>
          </div>
        </div>
      </article>

      <EmptyState
        v-if="!rows.length"
        title="No reports match these filters"
        description="Try a broader query or reset the status filter to review the full moderation queue."
        icon="i-carbon-flag-filled"
      />
    </div>
  </div>
</template>
