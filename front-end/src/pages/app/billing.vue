<script setup lang="ts">
import { pricingTiers } from "~/shared/data/marketing"
import { formatPlanName } from "~/shared/utils/format"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Billing")

const route = useRoute()
const toastStore = useToastStore()
const { authStore, subscription, workspaceStore } = useCurrentMember()

const pendingPlan = ref("")

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
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Billing"
      title="Subscription and entitlement management"
      description="Free is enough to create a profile and browse. Pro and Team unlock deeper workflow features, visibility, and collaboration."
    >
      <template #actions>
        <BaseBadge tone="accent">
          Current plan: {{ formatPlanName(subscription?.plan || "free") }}
        </BaseBadge>
      </template>
    </PageIntro>

    <div class="gap-4 grid md:grid-cols-4">
      <MetricTile label="Messaging" :value="subscription?.unlimitedMessaging ? 'Unlocked' : 'Limited'" />
      <MetricTile label="Proposals" :value="subscription?.proposalWorkflow ? 'Unlocked' : 'Locked'" />
      <MetricTile label="Contracts" :value="subscription?.contractBuilder ? 'Unlocked' : 'Locked'" />
      <MetricTile label="Visibility boost" :value="subscription?.visibilityBoost ? 'On' : 'Off'" />
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
          <BaseButton
            v-if="tier.id !== 'free'"
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
