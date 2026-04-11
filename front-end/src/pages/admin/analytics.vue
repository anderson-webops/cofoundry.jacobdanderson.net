<script setup lang="ts">
import type { SubscriptionPlan } from "~/shared/types/domain"
import { buildAdminQueueSummary, buildAdminUserRows } from "~/shared/utils/admin"
import { formatPlanName } from "~/shared/utils/format"
import { buildAdminMetrics } from "~/shared/utils/workspace"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin analytics")

const workspaceStore = useWorkspaceStore()

const metrics = computed(() => buildAdminMetrics(workspaceStore.data))
const queueSummary = computed(() => buildAdminQueueSummary(workspaceStore.data))
const userRows = computed(() => buildAdminUserRows(workspaceStore.data))
const planOrder: SubscriptionPlan[] = ["free", "pro", "team"]

const planMix = computed(() => {
  return planOrder.map(plan => ({
    plan,
    count: userRows.value.filter(row => row.subscription?.plan === plan).length,
  }))
})

const roleMix = computed(() => {
  return ["founder", "collaborator", "admin", "investor_admin"].map(role => ({
    role,
    count: userRows.value.filter(row => row.user.role === role).length,
  }))
})
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Admin"
      title="Analytics"
      description="Baseline growth, activation, monetization, and moderation coverage for the CoFoundry MVP."
    />

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="New signups" :value="metrics.newSignups" context="All current workspace users." />
      <MetricTile label="Profile completion rate" :value="`${metrics.profileCompletionRate}%`" context="Percentage of trust-ready profiles." />
      <MetricTile label="Paid conversion rate" :value="`${metrics.paidConversionRate}%`" context="Users on Pro or Team plans." />
      <MetricTile label="Contracts created" :value="metrics.contractsCreated" context="Accepted proposals turned into agreement drafts." />
      <MetricTile label="Connect requests" :value="metrics.connectRequests" context="Discovery relevance signal." />
      <MetricTile label="Matches" :value="metrics.matches" context="Mutual interest events that unlock messaging." />
      <MetricTile label="Open safety reports" :value="queueSummary.openReports" context="Current moderation backlog." />
      <MetricTile label="Reviewed, not resolved" :value="queueSummary.reviewedReports" context="Reports that still need closure." />
    </div>

    <div class="gap-4 grid xl:grid-cols-2">
      <section class="panel p-6">
        <h2 class="text-lg font-semibold">
          Subscription mix
        </h2>
        <div class="mt-5 gap-3 grid">
          <div v-for="item in planMix" :key="item.plan" class="panel-inset p-4 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold">
                {{ formatPlanName(item.plan) }}
              </p>
              <p class="muted text-xs mt-1">
                Current active workspace accounts on this tier.
              </p>
            </div>
            <span class="text-xl font-semibold">{{ item.count }}</span>
          </div>
        </div>
      </section>

      <section class="panel p-6">
        <h2 class="text-lg font-semibold">
          Role mix
        </h2>
        <div class="mt-5 gap-3 grid">
          <div v-for="item in roleMix" :key="item.role" class="panel-inset p-4 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold capitalize">
                {{ item.role.replaceAll("_", " ") }}
              </p>
              <p class="muted text-xs mt-1">
                Current workspace users in this role bucket.
              </p>
            </div>
            <span class="text-xl font-semibold">{{ item.count }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
