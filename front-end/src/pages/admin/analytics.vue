<script setup lang="ts">
import type { SubscriptionPlan } from "~/shared/types/domain"
import { buildAdminQueueSummary, buildAdminUserRows } from "~/shared/utils/admin"
import { formatPlanName } from "~/shared/utils/format"
import { buildRelationshipAnalytics } from "~/shared/utils/relationship-analytics"
import { buildAdminMetrics } from "~/shared/utils/workspace"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin analytics")

const workspaceStore = useWorkspaceStore()

const metrics = computed(() => buildAdminMetrics(workspaceStore.data))
const relationshipAnalytics = computed(() => buildRelationshipAnalytics(workspaceStore.data))
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
  return [
    "founder",
    "collaborator",
    "admin",
    "investor_admin"
  ].map(role => ({
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

const relationshipRateMetrics = computed(() => [
  {
    label: "Intro acceptance",
    value: `${relationshipAnalytics.value.introAcceptanceRate}%`,
    context: "Accepted intros divided by responded intros.",
  },
  {
    label: "Trial activation",
    value: `${relationshipAnalytics.value.trialActivationRate}%`,
    context: "Matches with an active or completed trial sprint.",
  },
  {
    label: "Proposal coverage",
    value: `${relationshipAnalytics.value.proposalCoverageRate}%`,
    context: "Matches that reached at least one structured proposal.",
  },
  {
    label: "Signature completion",
    value: `${relationshipAnalytics.value.signatureCompletionRate}%`,
    context: "Completed signatures divided by required agreement signatures.",
  },
])

function bottleneckTone(severity: "high" | "medium" | "low") {
  return {
    high: "warning",
    medium: "accent",
    low: "neutral",
  }[severity] as "accent" | "neutral" | "warning"
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Analytics"
    />

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="New signups" :value="metrics.newSignups" context="All current workspace users." />
      <MetricTile label="Profile completion rate" :value="`${metrics.profileCompletionRate}%`" context="Percentage of trust-ready profiles." />
      <MetricTile label="Paid conversion rate" :value="`${metrics.paidConversionRate}%`" context="Users on Pro or Team plans." />
      <MetricTile label="Open safety reports" :value="queueSummary.openReports" context="Current moderation backlog." />
    </div>

    <section class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Relationship loop
          </h2>
        </div>
      </div>

      <div class="mt-5 gap-3 grid md:grid-cols-2 xl:grid-cols-4">
        <MetricTile v-for="item in relationshipRateMetrics" :key="item.label" :label="item.label" :value="item.value" :context="item.context" />
      </div>

      <div class="mt-5 gap-4 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div class="surface-row-list">
          <div v-for="stage in relationshipAnalytics.funnel" :key="stage.id" class="surface-row flex gap-4 items-center justify-between">
            <div>
              <p class="text-sm font-semibold">
                {{ stage.label }}
              </p>
              <p class="muted text-xs mt-1">
                {{ stage.description }}
              </p>
            </div>
            <span class="text-xl font-semibold">{{ stage.count }}</span>
          </div>
        </div>

        <div class="surface-row-list">
          <div v-for="item in relationshipAnalytics.timeMetrics" :key="item.id" class="surface-row">
            <div class="flex gap-4 items-start justify-between">
              <div>
                <p class="text-sm font-semibold">
                  {{ item.label }}
                </p>
                <p class="muted text-xs mt-1">
                  {{ item.context }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-xl font-semibold">
                  {{ item.valueLabel }}
                </p>
                <p class="muted text-xs mt-1">
                  {{ item.sampleSize }} sample{{ item.sampleSize === 1 ? "" : "s" }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Relationship bottlenecks
          </h2>
        </div>
      </div>

      <div class="surface-row-list mt-5">
        <article v-for="item in relationshipAnalytics.bottlenecks" :key="item.id" class="surface-row">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="bottleneckTone(item.severity)">
                  {{ item.severity }} priority
                </BaseBadge>
                <BaseBadge tone="neutral">
                  {{ item.count }} open
                </BaseBadge>
              </div>
              <h3 class="text-base font-semibold mt-3">
                {{ item.label }}
              </h3>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.summary }}
              </p>
              <p class="text-sm leading-6 mt-3">
                {{ item.action }}
              </p>
            </div>
          </div>
        </article>

        <EmptyState
          v-if="!relationshipAnalytics.bottlenecks.length"
          title="No relationship bottlenecks detected"
          description="The current workflow has no pending intros, unsigned agreement drafts, or relationship stages missing their next artifact."
          icon="i-carbon-flow"
        />
      </div>
    </section>

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
            </div>
            <span class="text-xl font-semibold">{{ item.count }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
