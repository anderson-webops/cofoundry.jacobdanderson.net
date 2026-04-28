<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"
import { getPlanPriceLabel } from "~/shared/utils/billing"
import { formatBillingCycle, formatDate, formatPlanName } from "~/shared/utils/format"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Billing")

const route = useRoute()
const toastStore = useToastStore()
const { getServiceLabels } = useProductAccess()
const { authStore, subscription, workspaceStore } = useCurrentMember()
const serviceLabels = getServiceLabels()

const pendingPlan = ref("")
const billingModeLabel = computed(() => serviceLabels.billing)
const currentPriceLabel = computed(() => getPlanPriceLabel(subscription.value?.plan || "free", subscription.value?.billingCycle || "monthly"))

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
        title: "Billing preview",
        message: "Self-serve checkout is not live in this environment, so CoFoundry is routing you through the current preview flow.",
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
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Billing"
      title="Transparent pricing, usage, and cancellation"
      description="CoFoundry charges for more outbound reach and proposal-to-agreement tools. Messaging after a mutual match stays available on every plan."
    >
      <template #actions>
        <BaseBadge tone="accent">
          {{ billingModeLabel }}
        </BaseBadge>
      </template>
    </PageIntro>

    <section class="panel p-6">
      <div class="flex gap-4 items-start justify-between">
        <div>
          <h2 class="text-xl font-semibold">
            Current plan
          </h2>
          <p class="muted text-sm leading-6 mt-3">
            Renewal and cancellation controls stay visible here. There is no off-platform cancellation step.
          </p>
        </div>
        <BaseBadge :tone="subscription?.cancelAtPeriodEnd ? 'warning' : 'neutral'">
          {{ subscription?.cancelAtPeriodEnd ? "Cancels at period end" : "Active" }}
        </BaseBadge>
      </div>

      <div class="surface-row-list mt-5 md:gap-x-6 md:grid md:grid-cols-2">
        <div class="surface-row md:pr-4">
          <p class="text-sm font-semibold">
            Plan
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ formatPlanName(subscription?.plan || "free") }} · {{ billingModeLabel }}
          </p>
        </div>
        <div class="surface-row md:pr-4">
          <p class="text-sm font-semibold">
            Current charge
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ currentPriceLabel }} · {{ formatBillingCycle(subscription?.billingCycle || "monthly") }}
          </p>
        </div>
        <div class="surface-row md:pr-4">
          <p class="text-sm font-semibold">
            Renewal
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ subscription?.renewsAt ? formatDate(subscription.renewsAt) : "No renewal scheduled" }}
          </p>
        </div>
        <div class="surface-row md:pr-4">
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
          <p v-if="tier.id === subscription?.plan" class="text-sm text-[var(--accent)] font-semibold">
            Current plan
          </p>
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
          <p v-else class="muted text-sm">
            Always available
          </p>
        </div>
      </article>
    </div>
  </div>
</template>
