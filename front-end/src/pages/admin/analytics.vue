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

const secondaryMetrics = computed(() => [
  {
    label: "Contracts created",
    value: metrics.value.contractsCreated,
    context: "Accepted proposals turned into agreement drafts.",
  },
  {
    label: "Connect requests",
    value: metrics.value.connectRequests,
    context: "Discovery relevance signal.",
  },
  {
    label: "Matches",
    value: metrics.value.matches,
    context: "Mutual interest events that unlock messaging.",
  },
  {
    label: "Reviewed, not resolved",
    value: queueSummary.value.reviewedReports,
    context: "Reports that still need closure.",
  },
])
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Analytics"
      description="Baseline growth, activation, monetization, and moderation coverage for the CoFoundry MVP."
    />

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="New signups" :value="metrics.newSignups" context="All current workspace users." />
      <MetricTile label="Profile completion rate" :value="`${metrics.profileCompletionRate}%`" context="Percentage of trust-ready profiles." />
      <MetricTile label="Paid conversion rate" :value="`${metrics.paidConversionRate}%`" context="Users on Pro or Team plans." />
      <MetricTile label="Open safety reports" :value="queueSummary.openReports" context="Current moderation backlog." />
    </div>

    <div class="gap-4 grid xl:grid-cols-2">
      <section class="panel p-6">
        <h2 class="text-lg font-semibold">
          Additional signals
        </h2>
        <div class="surface-row-list mt-5">
          <div v-for="item in secondaryMetrics" :key="item.label" class="surface-row flex gap-4 items-center justify-between">
            <div>
              <p class="text-sm font-semibold">
                {{ item.label }}
              </p>
              <p class="muted text-xs mt-1">
                {{ item.context }}
              </p>
            </div>
            <span class="text-xl font-semibold">{{ item.value }}</span>
          </div>
        </div>
      </section>

      <section class="panel p-6">
        <h2 class="text-lg font-semibold">
          Subscription mix
        </h2>
        <div class="surface-row-list mt-5">
          <div v-for="item in planMix" :key="item.plan" class="surface-row flex items-center justify-between">
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
        <div class="surface-row-list mt-5">
          <div v-for="item in roleMix" :key="item.role" class="surface-row flex items-center justify-between">
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
