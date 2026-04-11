<script setup lang="ts">
import { buildAdminMetrics } from "~/shared/utils/workspace"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin analytics")

const workspaceStore = useWorkspaceStore()
const metrics = computed(() => buildAdminMetrics(workspaceStore.data))
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Admin"
      title="Analytics"
      description="Baseline operational analytics for the MVP."
    />

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
      <MetricTile label="New signups" :value="metrics.newSignups" context="Total demo users loaded into the workspace." />
      <MetricTile label="Profile completion rate" :value="`${metrics.profileCompletionRate}%`" context="Completed profiles are more likely to convert and match." />
      <MetricTile label="Connect requests" :value="metrics.connectRequests" context="Early indicator of discovery relevance." />
      <MetricTile label="Matches" :value="metrics.matches" context="Mutual interest events that unlock messaging." />
      <MetricTile label="Proposals created" :value="metrics.proposalsCreated" context="Structured deal workflow usage." />
      <MetricTile label="Contracts created" :value="metrics.contractsCreated" context="Accepted proposals turned into agreements." />
    </div>
  </div>
</template>
