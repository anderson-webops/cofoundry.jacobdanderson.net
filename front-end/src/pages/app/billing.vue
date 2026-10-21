<script setup lang="ts">
import type { SessionUser, Subscription, WorkspaceSeed } from "~/shared/types/domain"
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
const { getServiceLabels, policy } = useProductAccess()
const { authStore, subscription, workspaceStore } = useCurrentMember()
const runtimeConfig = useRuntimeConfig()
const serviceLabels = getServiceLabels()

const pendingPlan = ref("")
const pendingPortal = ref(false)
const billingModeLabel = computed(() => serviceLabels.billing)
const currentPriceLabel = computed(() => getPlanPriceLabel(subscription.value?.plan || "free", subscription.value?.billingCycle || "monthly"))
const mockBillingPreviewEnabled = computed(() => policy.value.mockBillingPreviewEnabled)
const operatorManagedBilling = computed(() => policy.value.operatorManagedBilling)
const selfServeBillingEnabled = computed(() => policy.value.selfServeBillingEnabled)
const stripeBillingMode = computed(() => runtimeConfig.public.billingMode === "stripe")
const billingContactPath = computed(() => "/contact?source=app-billing&topic=pricing")

if (route.query.checkout === "success" && authStore.currentUser)
  await workspaceStore.loadWorkspace(true)

function canMutateBillingInApp() {
  return selfServeBillingEnabled.value || mockBillingPreviewEnabled.value
}

function paidPlanCtaLabel(tierName: string) {
  if (operatorManagedBilling.value)
    return `Request ${tierName}`

  return `Preview ${tierName}`
}

async function startCheckout(plan: "pro" | "team") {
  if (!canMutateBillingInApp()) {
    await navigateTo(`/contact?source=app-billing-${plan}&topic=pricing`)
    return
  }

  pendingPlan.value = plan

  try {
    const response = await $fetch<{ checkoutUrl: string, data?: WorkspaceSeed, mode: string, session?: SessionUser, subscription?: Subscription }>("/api/billing/checkout", {
      method: "POST",
      body: { plan, interval: "monthly" },
    })

    if (response.data && response.session)
      workspaceStore.applyAuthoritativeWorkspace({ data: response.data, session: response.session })

    if (response.mode === "mock") {
      toastStore.push({
        title: "Billing state updated",
        message: "This local or staging billing preview updated the workspace plan without contacting Stripe.",
        tone: "info",
      })
    }

    if (response.mode === "managed") {
      toastStore.push({
        title: "Billing is operator-managed",
        message: "Plan changes route through the CoFoundry team until Stripe self-service is enabled.",
        tone: "info",
      })
    }

    await navigateTo(response.checkoutUrl, { external: true })
  }
  finally {
    pendingPlan.value = ""
  }
}

async function openBillingPortal() {
  if (operatorManagedBilling.value) {
    await navigateTo(billingContactPath.value)
    return
  }

  pendingPortal.value = true

  try {
    const response = await $fetch<{ mode: string, portalUrl: string }>("/api/billing/portal", {
      method: "POST",
    })

    if (response.mode === "mock") {
      toastStore.push({
        title: "Billing state preview",
        message: "This environment uses local or staging billing controls instead of Stripe portal sessions.",
        tone: "info",
      })
    }

    if (response.mode === "managed") {
      toastStore.push({
        title: "Billing is operator-managed",
        message: "Plan management routes through the CoFoundry team until Stripe self-service is enabled.",
        tone: "info",
      })
    }

    await navigateTo(response.portalUrl, { external: true })
  }
  finally {
    pendingPortal.value = false
  }
}

async function toggleCancellation() {
  if (!authStore.currentUser || !subscription.value || subscription.value.plan === "free")
    return

  if (!mockBillingPreviewEnabled.value) {
    await navigateTo(billingContactPath.value)
    return
  }

  if (subscription.value.cancelAtPeriodEnd) {
    const response = await $fetch<{ data: WorkspaceSeed, session: SessionUser }>("/api/billing/subscription", {
      method: "POST",
      body: { action: "resume" },
    })
    workspaceStore.applyAuthoritativeWorkspace(response)
    toastStore.push({
      title: "Cancellation removed",
      message: "The subscription will keep renewing on its normal schedule.",
      tone: "success",
    })
    return
  }

  const response = await $fetch<{ data: WorkspaceSeed, session: SessionUser }>("/api/billing/subscription", {
    method: "POST",
    body: { action: "cancel_at_period_end" },
  })
  workspaceStore.applyAuthoritativeWorkspace(response)
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
      title="Billing"
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
          <p v-if="operatorManagedBilling" class="muted text-sm leading-6 mt-3">
            Contact the CoFoundry team for plan changes.
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
              : operatorManagedBilling
                ? "Contact the CoFoundry team to cancel."
                : subscription?.cancelAtPeriodEnd
                  ? "Already scheduled. The plan stays active until the current term ends."
                  : "Available through Manage billing." }}
          </p>
        </div>
      </div>

      <div class="mt-5 flex flex-wrap gap-3">
        <BaseButton
          v-if="subscription?.plan !== 'free' && (selfServeBillingEnabled || mockBillingPreviewEnabled)"
          :disabled="pendingPortal"
          variant="primary"
          @click="openBillingPortal"
        >
          {{ pendingPortal ? "Opening..." : selfServeBillingEnabled ? "Manage billing" : "Manage billing state" }}
        </BaseButton>
        <BaseButton
          v-else-if="subscription?.plan !== 'free' && operatorManagedBilling"
          :to="billingContactPath"
          variant="primary"
        >
          Contact billing
        </BaseButton>
        <BaseButton
          v-if="subscription?.plan !== 'free' && mockBillingPreviewEnabled && !stripeBillingMode"
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
            v-else-if="tier.id !== 'free' && canMutateBillingInApp()"
            :disabled="pendingPlan === tier.id"
            block
            @click="startCheckout(tier.id)"
          >
            {{ pendingPlan === tier.id ? "Redirecting..." : selfServeBillingEnabled ? tier.ctaLabel : paidPlanCtaLabel(tier.name) }}
          </BaseButton>
          <BaseButton
            v-else-if="tier.id !== 'free'"
            :to="`/contact?source=app-billing-${tier.id}&topic=pricing`"
            block
            variant="secondary"
          >
            {{ paidPlanCtaLabel(tier.name) }}
          </BaseButton>
          <p v-else class="muted text-sm">
            Always available
          </p>
        </div>
      </article>
    </div>
  </div>
</template>
