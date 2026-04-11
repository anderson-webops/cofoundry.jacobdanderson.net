<script setup lang="ts">
import { buildAdminMetrics, getPendingReports } from "~/shared/utils/workspace"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin overview")

const workspaceStore = useWorkspaceStore()
const metrics = computed(() => buildAdminMetrics(workspaceStore.data))
const pendingReports = computed(() => getPendingReports(workspaceStore.data))
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Admin"
      title="Platform overview"
      description="A lightweight moderation and analytics surface for the MVP."
    />

    <div class="gap-4 grid md:grid-cols-3 xl:grid-cols-6">
      <MetricTile label="Signups" :value="metrics.newSignups" />
      <MetricTile label="Profile completion" :value="`${metrics.profileCompletionRate}%`" />
      <MetricTile label="Connect requests" :value="metrics.connectRequests" />
      <MetricTile label="Matches" :value="metrics.matches" />
      <MetricTile label="Proposals" :value="metrics.proposalsCreated" />
      <MetricTile label="Paid conversion" :value="`${metrics.paidConversionRate}%`" />
    </div>

    <div class="panel p-6">
      <h2 class="text-lg font-semibold">
        Pending moderation queue
      </h2>
      <div class="mt-5 gap-3 grid">
        <div v-for="report in pendingReports" :key="report.id" class="panel-inset p-4">
          <div class="flex gap-3 items-start justify-between">
            <div>
              <p class="text-sm font-semibold">
                {{ report.reason }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ report.details }}
              </p>
            </div>
            <BaseButton variant="secondary" to="/admin/reports">
              Review
            </BaseButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
