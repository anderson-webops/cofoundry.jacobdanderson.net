<script setup lang="ts">
import type { ProductionReadinessPayload, ProductionReadinessStatus } from "../../../server/utils/production-readiness"
import { computed } from "vue"
import { useAsyncData, useRequestFetch } from "#app"
import { definePageMeta } from "#app/composables/pages"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import MetricTile from "~/components/ui/MetricTile.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { formatDate } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin launch readiness")

const requestFetch = useRequestFetch()
const { data, pending, refresh } = await useAsyncData("admin-readiness", () => requestFetch<ProductionReadinessPayload>("/api/admin/readiness"))

const statusTone: Record<ProductionReadinessStatus, "neutral" | "success" | "warning" | "danger"> = {
  fail: "danger",
  info: "neutral",
  pass: "success",
  warn: "warning",
}

const statusLabel: Record<ProductionReadinessStatus, string> = {
  fail: "Fail",
  info: "Info",
  pass: "Pass",
  warn: "Needs attention",
}

const priorityChecks = computed(() => {
  return data.value?.groups
    .flatMap(group => group.checks.map(check => ({ ...check, groupTitle: group.title })))
    .filter(check => check.status === "fail" || check.status === "warn")
    .slice(0, 6) || []
})

const provisioningTasks = computed(() => {
  const statusRank: Record<ProductionReadinessStatus, number> = {
    fail: 0,
    warn: 1,
    info: 2,
    pass: 3,
  }

  return [
    ...(data.value?.provisioningTasks || [])
  ].sort((left, right) => {
    const statusDiff = statusRank[left.status] - statusRank[right.status]
    if (statusDiff !== 0)
      return statusDiff

    return left.title.localeCompare(right.title)
  })
})

const scoreContext = computed(() => {
  if (!data.value)
    return "Waiting for server checks."

  if (data.value.overallStatus === "fail")
    return "Resolve failures before treating this deployment as production-ready."

  if (data.value.overallStatus === "warn")
    return "No hard failures, but operations still need tightening."

  return "Readiness checks are currently green."
})

function shortCommit(value?: string) {
  if (!value)
    return ""

  return value.length > 12
    ? value.slice(0, 12)
    : value
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Launch readiness"
      description="A server-derived checklist for the current deployment: environment, secrets, queues, backups, restore drills, scanner evidence, trust-provider evidence, notification workers, monitoring, and operational events."
    >
      <template #actions>
        <BaseBadge :tone="data ? statusTone[data.overallStatus] : 'neutral'">
          {{ data ? statusLabel[data.overallStatus] : "Loading" }}
        </BaseBadge>
        <BaseButton variant="secondary" :disabled="pending" @click="refresh">
          {{ pending ? "Refreshing..." : "Refresh" }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-5">
      <MetricTile label="Readiness score" :value="data ? `${data.score}%` : '…'" :context="scoreContext" />
      <MetricTile label="Failures" :value="data?.counts.failedChecks ?? '…'" context="Hard blockers for public production operation." />
      <MetricTile label="Warnings" :value="data?.counts.warningChecks ?? '…'" context="Operational items that need tightening." />
      <MetricTile label="Open access" :value="data?.counts.accessRequestsOpen ?? '…'" context="Workspace access requests waiting on operators." />
      <MetricTile label="Open privacy" :value="data?.counts.privacyRequestsOpen ?? '…'" context="Privacy or trust-review requests not resolved." />
    </div>

    <section v-if="data" class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Current deployment state
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            {{ data.summary }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <BaseBadge tone="neutral">
            Backend {{ data.mode.backend }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            Billing {{ data.mode.billing }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            Operations {{ data.mode.operations }}
          </BaseBadge>
          <BaseBadge v-if="data.deployment.release" tone="success">
            Release {{ data.deployment.release }}
          </BaseBadge>
          <BaseBadge v-if="data.deployment.commitSha" tone="neutral">
            Commit {{ shortCommit(data.deployment.commitSha) }}
          </BaseBadge>
        </div>
      </div>
      <p class="text-xs text-[var(--muted)] mt-5">
        Generated {{ formatDate(data.generatedAt) }} from server-side configuration and persisted queue/worker rows.
        <span v-if="data.deployment.deployedAt">
          Deployed {{ formatDate(data.deployment.deployedAt) }}.
        </span>
      </p>
    </section>

    <section v-if="data" class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Production cutover phases
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            A phase-level view of what is ready now, what is intentionally disabled, and what still needs host or provider work before cutover.
          </p>
        </div>
        <BaseBadge tone="neutral">
          {{ data.cutoverPhases.length }} phases
        </BaseBadge>
      </div>

      <div class="mt-5 gap-3 grid lg:grid-cols-2">
        <article v-for="phase in data.cutoverPhases" :key="phase.id" class="surface-row">
          <div class="flex flex-wrap gap-2">
            <BaseBadge :tone="statusTone[phase.status]">
              {{ statusLabel[phase.status] }}
            </BaseBadge>
            <BaseBadge tone="neutral">
              {{ phase.summary }}
            </BaseBadge>
          </div>
          <h3 class="text-base font-semibold mt-4">
            {{ phase.title }}
          </h3>
          <p class="muted text-sm leading-6 mt-2">
            {{ phase.detail }}
          </p>
          <p class="text-sm leading-6 mt-3">
            {{ phase.action }}
          </p>
          <p class="text-xs text-[var(--muted)] mt-3">
            Reference: {{ phase.docsPath }}
          </p>
        </article>
      </div>
    </section>

    <section v-if="priorityChecks.length" class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Highest-priority fixes
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            These are the fail or warning checks that most directly affect safe public operation.
          </p>
        </div>
        <BaseBadge tone="warning">
          {{ priorityChecks.length }} item{{ priorityChecks.length === 1 ? "" : "s" }}
        </BaseBadge>
      </div>

      <div class="surface-row-list mt-5">
        <article v-for="check in priorityChecks" :key="check.id" class="surface-row">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="statusTone[check.status]">
                  {{ statusLabel[check.status] }}
                </BaseBadge>
                <BaseBadge tone="neutral">
                  {{ check.groupTitle }}
                </BaseBadge>
              </div>
              <h3 class="text-base font-semibold mt-4">
                {{ check.title }}
              </h3>
              <p class="muted text-sm leading-6 mt-2">
                {{ check.detail }}
              </p>
            </div>
            <p class="text-sm leading-6 max-w-[28rem] lg:text-right">
              {{ check.action }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <section v-if="data" class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Server provisioning checklist
          </h2>
        </div>
        <BaseBadge tone="neutral">
          {{ provisioningTasks.length }} tasks
        </BaseBadge>
      </div>

      <div class="surface-row-list mt-5">
        <article v-for="task in provisioningTasks" :key="task.id" class="surface-row">
          <div class="gap-5 grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)] lg:items-start">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="statusTone[task.status]">
                  {{ statusLabel[task.status] }}
                </BaseBadge>
                <BaseBadge tone="neutral">
                  {{ task.summary }}
                </BaseBadge>
              </div>
              <h3 class="text-base font-semibold mt-4">
                {{ task.title }}
              </h3>
              <p class="muted text-sm leading-6 mt-2">
                {{ task.detail }}
              </p>
              <p class="text-sm leading-6 mt-3">
                {{ task.action }}
              </p>
              <p class="text-xs text-[var(--muted)] mt-3">
                Reference: {{ task.docsPath }}
              </p>
            </div>
            <pre class="text-xs text-[var(--text)] leading-5 p-4 border border-[var(--line)] rounded-2xl bg-[var(--panel-strong)] overflow-x-auto"><code>{{ task.command }}</code></pre>
          </div>
        </article>
      </div>
    </section>

    <div v-if="data" class="gap-5 grid xl:grid-cols-2">
      <section v-for="group in data.groups" :key="group.id" class="panel p-6">
        <div>
          <h2 class="text-lg font-semibold">
            {{ group.title }}
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            {{ group.description }}
          </p>
        </div>

        <div class="surface-row-list mt-5">
          <article v-for="check in group.checks" :key="check.id" class="surface-row">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap gap-2">
                  <BaseBadge :tone="statusTone[check.status]">
                    {{ statusLabel[check.status] }}
                  </BaseBadge>
                  <span class="text-xs text-[var(--muted)] tracking-[0.12em] uppercase">{{ check.summary }}</span>
                </div>
                <h3 class="text-base font-semibold mt-4">
                  {{ check.title }}
                </h3>
                <p class="muted text-sm leading-6 mt-2">
                  {{ check.detail }}
                </p>
              </div>
              <p class="text-sm leading-6 max-w-[24rem] lg:text-right">
                {{ check.action }}
              </p>
            </div>
          </article>
        </div>
      </section>
    </div>

    <EmptyState
      v-else
      icon="i-carbon-progress-bar"
      title="Readiness checks are loading"
      description="The server is collecting configuration, queue, and worker evidence for this deployment."
    />
  </div>
</template>
