<script setup lang="ts">
import { computed, ref } from "vue"
import { definePageMeta } from "#app/composables/pages"
import { NuxtLink } from "#components"
import BaseBadge from "~/components/ui/BaseBadge.vue"
import BaseButton from "~/components/ui/BaseButton.vue"
import EmptyState from "~/components/ui/EmptyState.vue"
import MetricTile from "~/components/ui/MetricTile.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { usePageSeo } from "~/composables/usePageSeo"
import { useAuthStore } from "~/stores/auth"
import { useInvestmentReviewStore } from "~/stores/investmentReview"

definePageMeta({
  layout: "investment-review",
  middleware: ["investment-review"],
})

usePageSeo("Investment review")

const reviewStore = useInvestmentReviewStore()
const authStore = useAuthStore()
const query = ref("")
const view = ref<"active" | "mine" | "completed">("active")

await reviewStore.load()

const activeStatuses = new Set([
  "submitted",
  "under_review",
  "information_requested",
  "diligence",
  "committee_review"
])
const completedStatuses = new Set(["accepted", "declined", "closed"])
const cases = computed(() => reviewStore.snapshot.workspaces.filter((workspace) => {
  const matchesQuery = !query.value.trim()
    || `${workspace.companyName} ${workspace.application.companySummary} ${workspace.application.status}`.toLowerCase().includes(query.value.trim().toLowerCase())
  const matchesView = view.value === "mine"
    ? workspace.review.assignedReviewerUserId === authStore.currentUser?.id && activeStatuses.has(workspace.application.status)
    : view.value === "completed"
      ? completedStatuses.has(workspace.application.status)
      : activeStatuses.has(workspace.application.status)
  return matchesQuery && matchesView
}))

const metrics = computed(() => ({
  active: reviewStore.snapshot.workspaces.filter(item => activeStatuses.has(item.application.status)).length,
  diligence: reviewStore.snapshot.workspaces.filter(item => item.application.status === "diligence").length,
  requests: reviewStore.snapshot.workspaces.reduce((count, item) => count + item.informationRequests.filter(request => request.status === "open" || request.status === "answered").length, 0),
  unassigned: reviewStore.snapshot.workspaces.filter(item => activeStatuses.has(item.application.status) && !item.review.assignedReviewerUserId).length,
}))

function statusLabel(status: string) {
  return status.replaceAll("_", " ")
}

function statusTone(status: string) {
  if (["accepted", "closed"].includes(status))
    return "success" as const
  if (["declined", "information_requested"].includes(status))
    return "warning" as const
  if (["under_review", "diligence", "committee_review"].includes(status))
    return "accent" as const
  return "neutral" as const
}

function reviewerName(userId: string | null) {
  return reviewStore.snapshot.reviewers.find(item => item.id === userId)?.name || "Unassigned"
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value))
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Program operations"
      title="Review queue"
      description="Submitted applications, diligence requests, committee decisions, and consented partner handoffs."
    >
      <template #actions>
        <BaseButton variant="secondary" :disabled="reviewStore.loading" @click="reviewStore.load(true)">
          <span :class="reviewStore.loading ? 'i-carbon-renew animate-spin' : 'i-carbon-renew'" />
          Refresh
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-4 grid sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Active cases" :value="metrics.active" context="Submitted through committee" />
      <MetricTile label="Unassigned" :value="metrics.unassigned" context="Waiting for case ownership" />
      <MetricTile label="In diligence" :value="metrics.diligence" context="Founder responses in progress" />
      <MetricTile label="Open requests" :value="metrics.requests" context="Information and response follow-up" />
    </div>

    <section class="panel overflow-hidden">
      <div class="p-4 border-b border-[var(--line)] flex flex-col gap-3 lg:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="p-1 border border-[var(--line)] rounded-xl bg-[var(--panel-inset)] inline-flex gap-1 self-start" role="tablist" aria-label="Review queue filters">
          <button
            v-for="option in [{ label: 'Active', value: 'active' }, { label: 'Assigned to me', value: 'mine' }, { label: 'Completed', value: 'completed' }]"
            :key="option.value"
            type="button"
            role="tab"
            :aria-selected="view === option.value"
            class="text-sm font-semibold px-3 py-2 rounded-lg transition"
            :class="view === option.value ? 'bg-[var(--panel-strong)] text-[var(--text)] shadow-sm' : 'text-[var(--muted)]'"
            @click="view = option.value as typeof view"
          >
            {{ option.label }}
          </button>
        </div>
        <label class="w-full block relative lg:max-w-sm">
          <span class="i-carbon-search text-[var(--muted)] left-3 top-1/2 absolute -translate-y-1/2" />
          <input v-model="query" type="search" class="form-input pl-10 w-full" placeholder="Search cases" aria-label="Search review cases">
        </label>
      </div>

      <div v-if="cases.length" class="divide-[var(--line)] divide-y">
        <NuxtLink
          v-for="workspace in cases"
          :key="workspace.id"
          :to="`/investment-review/${workspace.id}`"
          class="p-4 gap-4 grid transition md:p-5 hover:bg-[var(--panel-inset)] md:grid-cols-[minmax(0,1.5fr)_minmax(160px,0.6fr)_minmax(150px,0.6fr)_auto] md:items-center"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap gap-2 items-center">
              <h2 class="font-semibold truncate">
                {{ workspace.companyName }}
              </h2>
              <BaseBadge :tone="statusTone(workspace.application.status)">
                {{ statusLabel(workspace.application.status) }}
              </BaseBadge>
              <BaseBadge v-if="workspace.review.priority !== 'standard'" tone="warning">
                {{ workspace.review.priority }}
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-2 line-clamp-2">
              {{ workspace.application.companySummary }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[var(--muted)] uppercase">
              Request
            </p>
            <p class="text-sm font-semibold mt-1">
              {{ workspace.application.requestedAmount }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[var(--muted)] uppercase">
              Reviewer
            </p>
            <p class="text-sm font-semibold mt-1">
              {{ reviewerName(workspace.review.assignedReviewerUserId) }}
            </p>
            <p class="muted text-xs mt-1">
              Updated {{ formatDate(workspace.updatedAt) }}
            </p>
          </div>
          <span class="i-carbon-chevron-right text-[var(--muted)]" />
        </NuxtLink>
      </div>
      <EmptyState v-else icon="i-carbon-list-checked" title="No cases in this view" description="Cases will appear here when their status and assignment match the selected filter." />
    </section>

    <div class="panel-inset text-sm leading-6 p-4 flex gap-3 items-start">
      <span class="i-carbon-information text-[var(--accent)] mt-1" />
      <p class="muted">
        Program acceptance is a next-stage workflow decision, not a promise of financing. Securities activity, if any, proceeds outside CoFoundry through qualified counsel and registered intermediaries when required.
      </p>
    </div>
  </div>
</template>
