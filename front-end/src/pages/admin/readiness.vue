<script setup lang="ts">
import type { ProductionReadinessPayload, ProductionReadinessStatus } from "../../../server/utils/production-readiness"
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

const scoreContext = computed(() => {
  if (!data.value)
    return "Waiting for server checks."

  if (data.value.overallStatus === "fail")
    return "Resolve failures before treating this deployment as production-ready."

  if (data.value.overallStatus === "warn")
    return "No hard failures, but operations still need tightening."

  return "Readiness checks are currently green."
})
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Launch readiness"
      description="A server-derived checklist for the current deployment: environment, secrets, queues, backups, scanner evidence, notification workers, and operational events."
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
        </div>
      </div>
      <p class="text-xs text-[var(--muted)] mt-5">
        Generated {{ formatDate(data.generatedAt) }} from server-side configuration and persisted queue/worker rows.
      </p>
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
