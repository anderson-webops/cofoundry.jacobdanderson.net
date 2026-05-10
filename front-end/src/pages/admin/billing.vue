<script setup lang="ts">
import type { SubscriptionPlan, SubscriptionStatus } from "~/shared/types/domain"
import { buildAdminBillingRows, filterAdminBillingRows } from "~/shared/utils/admin"
import { formatBillingCycle, formatDate, formatPlanName } from "~/shared/utils/format"

definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin billing")

const workspaceStore = useWorkspaceStore()

const filters = reactive({
  query: "",
  plan: "all" as SubscriptionPlan | "all",
  status: "all" as SubscriptionStatus | "all",
})

const planOptions = [
  { label: "All plans", value: "all" },
  { label: "Free", value: "free" },
  { label: "Pro", value: "pro" },
  { label: "Team", value: "team" },
]

const statusOptions = [
  { label: "All statuses", value: "all" },
  { label: "Inactive", value: "inactive" },
  { label: "Trialing", value: "trialing" },
  { label: "Active", value: "active" },
  { label: "Past due", value: "past_due" },
  { label: "Canceled", value: "canceled" },
]

const rows = computed(() => filterAdminBillingRows(buildAdminBillingRows(workspaceStore.data), filters))
const allRows = computed(() => buildAdminBillingRows(workspaceStore.data))

const metrics = computed(() => {
  const subscriptions = allRows.value.flatMap(row => row.subscription ? [row.subscription] : [])
  return {
    paid: subscriptions.filter(subscription => subscription.plan !== "free").length,
    pastDue: subscriptions.filter(subscription => subscription.status === "past_due").length,
    canceling: subscriptions.filter(subscription => subscription.cancelAtPeriodEnd).length,
    stripeLinked: subscriptions.filter(subscription => Boolean(subscription.stripeCustomerId || subscription.stripeSubscriptionId)).length,
  }
})
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Admin"
      title="Billing"
      description="Read-only subscription oversight for the guarded billing path. Stripe remains disabled until production billing is intentionally enabled."
    />

    <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
      <MetricTile label="Paid accounts" :value="metrics.paid" context="Current Pro or Team subscriptions." />
      <MetricTile label="Past due" :value="metrics.pastDue" context="Accounts that would need billing follow-up." />
      <MetricTile label="Canceling" :value="metrics.canceling" context="Subscriptions marked cancel-at-period-end." />
      <MetricTile label="Stripe linked" :value="metrics.stripeLinked" context="Rows with Stripe customer or subscription ids." />
    </div>

    <section class="panel p-6">
      <div class="gap-4 grid md:grid-cols-3">
        <TextInput
          v-model="filters.query"
          label="Search billing"
          placeholder="Member, email, or Stripe id"
          helper="Search users, plan state, and stored Stripe references."
        />
        <SelectInput v-model="filters.plan" label="Plan" :options="planOptions" />
        <SelectInput v-model="filters.status" label="Status" :options="statusOptions" />
      </div>
    </section>

    <section class="panel p-6">
      <div class="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Subscription rows
          </h2>
          <p class="muted text-sm leading-6 mt-2">
            This view does not mutate Stripe or local billing state. Use it to verify plan, renewal, and webhook-sync readiness.
          </p>
        </div>
        <BaseBadge tone="accent">
          {{ rows.length }} row{{ rows.length === 1 ? "" : "s" }}
        </BaseBadge>
      </div>

      <div v-if="rows.length" class="surface-row-list mt-5">
        <article v-for="row in rows" :key="row.user.id" class="surface-row">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap gap-2">
                <BaseBadge :tone="row.subscription?.plan === 'free' ? 'neutral' : 'accent'">
                  {{ formatPlanName(row.subscription?.plan || "free") }}
                </BaseBadge>
                <BaseBadge :tone="row.subscription?.status === 'past_due' ? 'warning' : row.subscription?.status === 'active' ? 'success' : 'neutral'">
                  {{ row.subscription?.status.replaceAll("_", " ") || "inactive" }}
                </BaseBadge>
                <BaseBadge v-if="row.subscription?.cancelAtPeriodEnd" tone="warning">
                  Cancels at period end
                </BaseBadge>
              </div>
              <h2 class="text-base font-semibold mt-4">
                {{ row.profile?.displayName || row.user.email }}
              </h2>
              <p class="muted text-sm leading-6 mt-2">
                {{ row.user.email }}
              </p>
            </div>

            <div class="muted text-sm leading-6 lg:text-right">
              <p>{{ formatBillingCycle(row.subscription?.billingCycle || "monthly") }}</p>
              <p>{{ row.subscription?.renewsAt ? `Renews ${formatDate(row.subscription.renewsAt)}` : "No renewal date" }}</p>
              <p v-if="row.subscription?.stripeCustomerId">
                Customer {{ row.subscription.stripeCustomerId }}
              </p>
              <p v-if="row.subscription?.stripeSubscriptionId">
                Subscription {{ row.subscription.stripeSubscriptionId }}
              </p>
            </div>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        class="mt-6"
        icon="i-carbon-wallet"
        title="No billing rows match these filters"
        description="Clear a filter to inspect all current workspace subscription records."
      />
    </section>
  </div>
</template>
