<script setup lang="ts">
import { buildActivationPlan } from "~/shared/utils/activation"
import { buildProfileReadiness } from "~/shared/utils/formation"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Activation plan")

const { authStore, profile, workspaceStore } = useCurrentMember()
const currentUserId = computed(() => authStore.currentUser?.id || "")
const activationPlan = computed(() => currentUserId.value ? buildActivationPlan(workspaceStore.data, currentUserId.value) : null)
const readiness = computed(() => profile.value ? buildProfileReadiness(profile.value) : null)
const openTrustItems = computed(() => readiness.value?.trustChecklist.filter(item => !item.complete) || [])
const openProfileItems = computed(() => readiness.value?.checklist.filter(item => !item.complete) || [])
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Activation"
      title="Make the first relationship work."
      description="A production account should not just enter the app. It should reach a trustworthy profile, one focused intro, and a clear follow-up queue."
    >
      <template #actions>
        <BaseButton to="/app/profile/edit">
          Edit profile
        </BaseButton>
        <BaseButton variant="secondary" to="/app/inbox">
          Open inbox
        </BaseButton>
      </template>
    </PageIntro>

    <template v-if="activationPlan">
      <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Activation" :value="`${activationPlan.percent}%`" context="Profile, trust, intro, and follow-through gates." />
        <MetricTile label="Profile readiness" :value="`${activationPlan.profilePercent}%`" context="Detailed profile signals complete." />
        <MetricTile label="Trust readiness" :value="`${activationPlan.trustPercent}%`" context="Trust-critical signals complete." />
        <MetricTile label="Inbox actions" :value="activationPlan.inboxActionCount" context="Items still needing direct follow-through." />
      </div>

      <ActivationCockpit :plan="activationPlan" />

      <div class="gap-5 grid lg:grid-cols-2">
        <section class="panel p-6">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold">
                Profile blockers
              </h2>
              <p class="muted text-sm leading-6 mt-2">
                These determine whether recommendations and outreach are credible enough for a production member.
              </p>
            </div>
            <BaseBadge :tone="openProfileItems.length ? 'warning' : 'success'">
              {{ openProfileItems.length ? `${openProfileItems.length} open` : "Clear" }}
            </BaseBadge>
          </div>

          <div class="surface-row-list mt-5">
            <div v-for="item in openProfileItems" :key="item.id" class="surface-row">
              <p class="text-sm font-semibold">
                {{ item.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.description }}
              </p>
            </div>
            <EmptyState
              v-if="!openProfileItems.length"
              icon="i-carbon-checkmark-outline"
              title="Profile blockers are clear"
              description="The full profile checklist is complete enough for production matching."
            />
          </div>
        </section>

        <section class="panel p-6">
          <div class="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold">
                Trust blockers
              </h2>
              <p class="muted text-sm leading-6 mt-2">
                Trust issues should be resolved before members increase intro volume.
              </p>
            </div>
            <BaseBadge :tone="openTrustItems.length ? 'warning' : 'success'">
              {{ openTrustItems.length ? `${openTrustItems.length} open` : "Clear" }}
            </BaseBadge>
          </div>

          <div class="surface-row-list mt-5">
            <div v-for="item in openTrustItems" :key="item.id" class="surface-row">
              <p class="text-sm font-semibold">
                {{ item.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ item.description }}
              </p>
            </div>
            <EmptyState
              v-if="!openTrustItems.length"
              icon="i-carbon-checkmark-outline"
              title="Trust blockers are clear"
              description="The trust-critical checklist is complete for the current member profile."
            />
          </div>
        </section>
      </div>
    </template>

    <EmptyState
      v-else
      icon="i-carbon-user-profile"
      title="Activation plan unavailable"
      description="The current account does not have a workspace profile loaded yet."
    />
  </div>
</template>
