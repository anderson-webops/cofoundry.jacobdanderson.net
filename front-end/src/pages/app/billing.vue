<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"
import { buildSubscriptionUsage, formatUsageQuota, getPlanPriceLabel } from "~/shared/utils/billing"
import { formatBillingCycle, formatDate, formatPlanName } from "~/shared/utils/format"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Billing")

const route = useRoute()
const toastStore = useToastStore()
const runtimeConfig = useRuntimeConfig()
const { authStore, subscription, workspaceStore } = useCurrentMember()

const pendingPlan = ref("")
const usage = computed(() => authStore.currentUser ? buildSubscriptionUsage(workspaceStore.data, authStore.currentUser.id, subscription.value || undefined) : null)
const billingModeLabel = computed(() => runtimeConfig.public.billingMode === "stripe" ? "Stripe-backed mode" : "Mock billing mode")
const currentPriceLabel = computed(() => getPlanPriceLabel(subscription.value?.plan || "free", subscription.value?.billingCycle || "monthly"))
const billingMoments = computed(() => {
  if (!subscription.value?.renewsAt)
    return []

  const renewalDate = new Date(subscription.value.renewsAt)
  const intervalDays = subscription.value.billingCycle === "annual" ? 365 : 30
  const lastCharge = new Date(renewalDate.getTime() - intervalDays * 24 * 60 * 60 * 1000)

  return [
    {
      id: "last",
      label: "Last receipt",
      detail: `${currentPriceLabel.value} · ${formatPlanName(subscription.value.plan)}`,
      date: lastCharge.toISOString(),
    },
    {
      id: "next",
      label: subscription.value.cancelAtPeriodEnd ? "Plan ends" : "Next renewal",
      detail: subscription.value.cancelAtPeriodEnd ? "Cancellation already scheduled in-product." : `${currentPriceLabel.value} will renew automatically unless you cancel first.`,
      date: subscription.value.renewsAt,
    },
  ]
})

watchEffect(() => {
  const checkout = route.query.checkout
  const plan = route.query.plan

  if (checkout === "success" && typeof plan === "string" && authStore.currentUser) {
    workspaceStore.updateSubscriptionPlan(authStore.currentUser.id, plan as "free" | "pro" | "team")
  }
})

async function startCheckout(plan: "pro" | "team") {
  pendingPlan.value = plan

  try {
    const response = await $fetch<{ checkoutUrl: string, mode: string }>("/api/billing/checkout", {
      method: "POST",
      body: { plan, interval: "monthly" },
    })

    if (response.mode === "mock") {
      toastStore.push({
        title: "Mock checkout",
        message: "Redirecting to the local billing success flow.",
        tone: "info",
      })
    }

    await navigateTo(response.checkoutUrl, { external: true })
  }
  finally {
    pendingPlan.value = ""
  }
}

function toggleCancellation() {
  if (!authStore.currentUser || !subscription.value || subscription.value.plan === "free")
    return

  if (subscription.value.cancelAtPeriodEnd) {
    workspaceStore.resumeSubscription(authStore.currentUser.id)
    toastStore.push({
      title: "Cancellation removed",
      message: "The subscription will keep renewing on its normal schedule.",
      tone: "success",
    })
    return
  }

  workspaceStore.cancelSubscriptionAtPeriodEnd(authStore.currentUser.id)
  toastStore.push({
    title: "Cancellation scheduled",
    message: "The subscription will stay active until the current billing period ends.",
    tone: "info",
  })
}

function quotaText(key: "intros" | "savedSearches" | "proposals" | "contractDrafts") {
  const quota = usage.value?.[key]
  return quota ? formatUsageQuota(quota) : ""
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Billing"
      title="Transparent pricing, usage, and cancellation"
      description="CoFoundry charges for higher-intent workflow: more outbound reach, saved search velocity, and proposal-to-agreement execution. Messaging after a mutual match stays available on every plan."
    >
      <template #actions>
        <BaseBadge tone="accent">
          {{ billingModeLabel }}
        </BaseBadge>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-4">
      <MetricTile label="Current plan" :value="formatPlanName(subscription?.plan || 'free')" :context="currentPriceLabel" />
      <MetricTile
        label="Renewal"
        :value="subscription?.renewsAt ? formatDate(subscription.renewsAt) : 'No renewal'"
        :context="subscription?.cancelAtPeriodEnd ? 'Cancels at period end' : 'One-click cancel in-product'"
      />
      <MetricTile label="Intros" :value="quotaText('intros')" context="New outbound introductions this month." />
      <MetricTile label="Deal rooms" :value="quotaText('proposals')" context="Structured proposal sends this month." />
    </div>

    <div class="gap-6 grid xl:grid-cols-[0.88fr_1.12fr]">
      <section class="panel p-6">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">
              Billing state
            </h2>
            <p class="muted text-sm leading-6 mt-3">
              Renewal date, billing mode, and cancellation status stay visible here at all times. There is no hidden auto-renew logic and no off-platform cancellation step.
            </p>
          </div>
          <BaseBadge :tone="subscription?.cancelAtPeriodEnd ? 'warning' : 'neutral'">
            {{ subscription?.cancelAtPeriodEnd ? "Cancels at period end" : "Active" }}
          </BaseBadge>
        </div>

        <div class="mt-5 gap-4 grid md:grid-cols-2">
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Current charge
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ currentPriceLabel }} · {{ formatBillingCycle(subscription?.billingCycle || "monthly") }}
            </p>
          </div>
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Cancellation
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ subscription?.plan === "free"
                ? "Free does not renew."
                : subscription?.cancelAtPeriodEnd
                  ? "Already scheduled. The plan stays active until the current term ends."
                  : "Available in-product with one click. No support ticket required." }}
            </p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton
            v-if="subscription?.plan !== 'free'"
            :variant="subscription?.cancelAtPeriodEnd ? 'secondary' : 'danger'"
            @click="toggleCancellation"
          >
            {{ subscription?.cancelAtPeriodEnd ? "Resume renewal" : "Cancel at period end" }}
          </BaseButton>
          <BaseButton v-else to="/pricing" variant="secondary">
            Compare plans
          </BaseButton>
        </div>
      </section>

      <section class="panel p-6">
        <h2 class="text-xl font-semibold">
          What this plan meters
        </h2>
        <div v-if="usage" class="mt-5 gap-4 grid md:grid-cols-2">
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              New intros
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ quotaText("intros") }}. This is the main anti-spam meter, not matched messaging.
            </p>
          </div>
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Saved searches
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ quotaText("savedSearches") }}. Paid tiers are built for repeatable search workflows and alerts.
            </p>
          </div>
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Proposal sends
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ quotaText("proposals") }}. Deal rooms are metered because they mark a real commitment event.
            </p>
          </div>
          <div class="panel-inset p-4">
            <p class="text-sm font-semibold">
              Agreement drafts
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ quotaText("contractDrafts") }}. Free keeps one preview path open, while paid plans unlock signature-ready workflow.
            </p>
          </div>
        </div>
      </section>
    </div>

    <div class="panel p-6">
      <h2 class="text-xl font-semibold">
        Recent billing activity
      </h2>
      <div v-if="billingMoments.length" class="mt-5 gap-3 grid">
        <div v-for="item in billingMoments" :key="item.id" class="panel-inset p-4 flex gap-4 items-start justify-between">
          <div>
            <p class="text-sm font-semibold">
              {{ item.label }}
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ item.detail }}
            </p>
          </div>
          <BaseBadge tone="neutral">
            {{ formatDate(item.date) }}
          </BaseBadge>
        </div>
      </div>
      <div v-else class="panel-inset mt-5 p-4">
        <p class="text-sm font-semibold">
          No paid receipts yet
        </p>
        <p class="muted text-sm leading-6 mt-2">
          Start with Free, validate the market, then upgrade when you need more outbound velocity or proposal capacity.
        </p>
      </div>
    </div>

    <div class="gap-6 grid lg:grid-cols-3">
      <article v-for="tier in pricingTiers" :key="tier.id" class="panel p-6">
        <div class="flex gap-4 items-start justify-between">
          <div>
            <h2 class="text-2xl font-semibold">
              {{ tier.name }}
            </h2>
            <p class="muted text-sm leading-6 mt-2">
              {{ tier.description }}
            </p>
          </div>
          <BaseBadge :tone="tier.id === subscription?.plan ? 'accent' : 'neutral'">
            {{ tier.priceLabel }}
          </BaseBadge>
        </div>
        <ul class="text-sm leading-6 mt-6 gap-3 grid">
          <li v-for="feature in tier.features" :key="feature" class="flex gap-2">
            <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
            <span>{{ feature }}</span>
          </li>
        </ul>
        <div class="mt-6">
          <BaseBadge v-if="tier.id === subscription?.plan" tone="accent">
            Current plan
          </BaseBadge>
          <BaseButton v-else-if="tier.id === 'team'" block variant="secondary" to="/contact">
            {{ tier.ctaLabel }}
          </BaseButton>
          <BaseButton
            v-else-if="tier.id !== 'free'"
            :disabled="pendingPlan === tier.id"
            block
            @click="startCheckout(tier.id)"
          >
            {{ pendingPlan === tier.id ? "Redirecting..." : tier.ctaLabel }}
          </BaseButton>
          <BaseBadge v-else tone="neutral">
            Always available
          </BaseBadge>
        </div>
      </article>
    </div>
  </div>
</template>
