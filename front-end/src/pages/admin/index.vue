<script setup lang="ts">
import { buildAdminAuditEntries, buildAdminQueueSummary, buildAdminReportRows } from "~/shared/utils/admin"
import { formatAdminActionType, formatDate, formatRelativeDate, formatReportReason, formatReportStatus } from "~/shared/utils/format"
import { buildAdminMetrics } from "~/shared/utils/workspace"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin overview")

const workspaceStore = useWorkspaceStore()

const metrics = computed(() => buildAdminMetrics(workspaceStore.data))
const queueSummary = computed(() => buildAdminQueueSummary(workspaceStore.data))
const pendingReports = computed(() => buildAdminReportRows(workspaceStore.data).filter(row => row.report.status !== "resolved").slice(0, 4))
const recentActions = computed(() => buildAdminAuditEntries(workspaceStore.data).slice(0, 6))
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Platform operations"
      description="Server-approved moderation actions, current queue health, and the latest audit history for the CoFoundry workspace."
    >
      <template #actions>
        <BaseButton to="/admin/queue">
          Open command queue
        </BaseButton>
        <BaseButton variant="secondary" to="/admin/readiness">
          Launch readiness
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-3 xl:grid-cols-6">
      <MetricTile label="Signups" :value="metrics.newSignups" context="Total workspace users." />
      <MetricTile label="Profile completion" :value="`${metrics.profileCompletionRate}%`" context="Members with complete trust-ready profiles." />
      <MetricTile label="Open reports" :value="queueSummary.openReports" context="Issues still waiting for admin action." />
      <MetricTile label="High priority" :value="queueSummary.highPriorityReports" context="Reports that need immediate review." />
      <MetricTile label="Suspended users" :value="queueSummary.suspendedUsers" context="Accounts currently blocked from the platform." />
      <MetricTile label="Actions in 7 days" :value="queueSummary.actionsLast7Days" context="Recent moderation and enforcement activity." />
    </div>

    <div class="gap-5 grid md:gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section class="panel p-6">
        <div class="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Moderation queue
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              Open and recently reviewed reports with enough context to triage quickly.
            </p>
          </div>
          <BaseButton variant="secondary" to="/admin/reports">
            Open reports view
          </BaseButton>
        </div>

        <div class="surface-row-list mt-5">
          <article v-for="row in pendingReports" :key="row.report.id" class="surface-row">
            <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap gap-2">
                  <BaseBadge :tone="row.report.priority === 'high' ? 'warning' : 'neutral'">
                    {{ row.report.priority }}
                  </BaseBadge>
                  <BaseBadge :tone="row.report.status === 'open' ? 'warning' : 'accent'">
                    {{ formatReportStatus(row.report.status) }}
                  </BaseBadge>
                </div>
                <h3 class="text-base font-semibold mt-4">
                  {{ formatReportReason(row.report.reason) }} on {{ row.targetLabel }}
                </h3>
                <p class="muted text-xs tracking-[0.12em] mt-2 uppercase">
                  {{ row.report.targetType }}
                </p>
                <p class="muted text-sm leading-6 mt-2">
                  {{ row.report.details }}
                </p>
                <p class="text-xs text-[var(--muted)] mt-3">
                  Opened {{ formatDate(row.report.createdAt) }} · {{ formatRelativeDate(row.report.createdAt) }}
                </p>
              </div>
              <BaseButton variant="secondary" to="/admin/reports">
                Review
              </BaseButton>
            </div>
          </article>

          <EmptyState
            v-if="!pendingReports.length"
            title="No pending moderation work"
            description="The current report queue is clear. New safety and abuse reports will appear here."
            icon="i-carbon-checkmark-outline"
          />
        </div>
      </section>

      <section class="panel p-6">
        <div class="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <h2 class="text-lg font-semibold">
              Recent audit history
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              Every admin action is timestamped so moderation decisions stay reviewable.
            </p>
          </div>
          <BaseButton variant="secondary" to="/admin/audit">
            Full audit log
          </BaseButton>
        </div>

        <div class="surface-row-list mt-5">
          <article v-for="entry in recentActions" :key="entry.action.id" class="surface-row">
            <div class="flex gap-3 items-start justify-between">
              <div class="min-w-0">
                <p class="text-sm font-semibold">
                  {{ formatAdminActionType(entry.action.type) }}
                </p>
                <p class="muted text-sm leading-6 mt-1">
                  {{ entry.adminProfile?.displayName || entry.admin?.email || "Admin" }} · {{ entry.targetLabel }}
                </p>
                <p class="text-sm leading-6 mt-2">
                  {{ entry.action.notes }}
                </p>
              </div>
              <span class="text-xs text-[var(--muted)] whitespace-nowrap">
                {{ formatRelativeDate(entry.action.createdAt) }}
              </span>
            </div>
          </article>

          <EmptyState
            v-if="!recentActions.length"
            title="No audit actions yet"
            description="Moderation and enforcement events will appear here once admins start acting on users or reports."
            icon="i-carbon-document-tasks"
          />
        </div>
      </section>
    </div>
  </div>
</template>
