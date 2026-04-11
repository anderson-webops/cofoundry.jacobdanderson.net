<script setup lang="ts">
import { formatCommitment, formatCompensation, formatRemotePreference, formatStage } from "~/shared/utils/format"
import { getProfileByUserId } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

const route = useRoute()
const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()

const opportunity = computed(() => workspaceStore.data.opportunities.find(item => item.id === route.params.id))
const ownerProfile = computed(() => opportunity.value ? getProfileByUserId(workspaceStore.data, opportunity.value.ownerUserId) : null)
const roles = computed(() => workspaceStore.data.opportunityRoles.filter(role => role.opportunityId === route.params.id))

usePageSeo("Opportunity details")

function expressInterest() {
  if (!authStore.currentUser || !opportunity.value)
    return

  workspaceStore.sendConnectRequest(
    authStore.currentUser.id,
    opportunity.value.ownerUserId,
    `I am interested in ${opportunity.value.startupName} because the role and stage fit my current search well.`,
  )
  toastStore.push({
    title: "Interest sent",
    message: "The founder will see your request and can accept to unlock messaging.",
    tone: "success",
  })
}
</script>

<template>
  <div v-if="opportunity" class="gap-6 grid">
    <PageIntro
      eyebrow="Opportunity"
      :title="opportunity.startupName"
      :description="opportunity.oneLinePitch"
    >
      <template #actions>
        <BaseButton variant="secondary" @click="workspaceStore.toggleBookmark(authStore.currentUser!.id, 'opportunity', opportunity.id)">
          Save opportunity
        </BaseButton>
        <BaseButton v-if="authStore.currentUser?.id !== opportunity.ownerUserId" @click="expressInterest">
          Express interest
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-6 grid xl:grid-cols-[1.1fr_0.9fr]">
      <section class="panel p-6">
        <div class="flex flex-wrap gap-2">
          <BaseBadge tone="accent">
            {{ formatStage(opportunity.stage) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ formatRemotePreference(opportunity.remotePreference) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ formatCommitment(opportunity.expectedCommitment) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ formatCompensation(opportunity.compensationStructure) }}
          </BaseBadge>
        </div>

        <div class="mt-6 gap-6 grid">
          <div>
            <h2 class="text-lg font-semibold">
              Problem
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.problem }}
            </p>
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              Target users
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.targetUsers }}
            </p>
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              Traction
            </h2>
            <p class="muted text-sm leading-7 mt-3">
              {{ opportunity.traction }}
            </p>
          </div>
        </div>
      </section>

      <section class="gap-4 grid">
        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Founder
          </h2>
          <p class="text-sm font-semibold mt-3">
            {{ ownerProfile?.displayName }}
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ ownerProfile?.headline }}
          </p>
        </div>

        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Roles needed
          </h2>
          <div class="mt-4 gap-4 grid">
            <div v-for="role in roles" :key="role.id" class="panel-inset p-4">
              <p class="font-semibold">
                {{ role.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ role.summary }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span v-for="skill in role.skills" :key="skill" class="pill">
                  {{ skill }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <EmptyState
    v-else
    icon="i-carbon-launch"
    title="Opportunity not found"
    description="The opportunity may have been removed or the route is incorrect."
  >
    <BaseButton to="/app/opportunities">
      Back to opportunities
    </BaseButton>
  </EmptyState>
</template>
