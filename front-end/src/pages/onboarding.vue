<script setup lang="ts">
import { recommendOpportunitiesForProfile, recommendProfilesForProfile } from "~/shared/utils/discovery"
import { buildProfileReadiness } from "~/shared/utils/formation"

definePageMeta({
  layout: "auth",
  middleware: ["auth"],
})

usePageSeo("Onboarding")

const toastStore = useToastStore()
const { authStore, profile, workspaceStore } = useCurrentMember()
const previewUnlocked = ref(Boolean(authStore.currentUser?.onboardingCompleted))

function inferIntentMode(): "start" | "join" | "explore" {
  if (profile.value?.hasIdea && profile.value?.wantsToJoinIdea)
    return "explore"

  if (profile.value?.hasIdea)
    return "start"

  return "join"
}

const initialValues = computed(() => {
  if (!profile.value)
    return undefined

  return {
    intentMode: inferIntentMode(),
    displayName: profile.value.displayName,
    headline: profile.value.headline,
    bio: profile.value.bio,
    location: profile.value.location,
    remotePreference: profile.value.remotePreference,
    primaryRole: profile.value.roleScope.primaryRole,
    roles: profile.value.roles,
    industries: profile.value.industries,
    timeCommitment: profile.value.timeCommitment,
    weeklyAvailabilityHours: profile.value.commitmentProfile.weeklyAvailabilityHours,
    startTimeline: profile.value.intent.startTimeline,
    fullTimeBy: profile.value.commitmentProfile.fullTimeBy,
    runwayBucket: profile.value.commitmentProfile.runwayBucket,
    equityPhilosophy: profile.value.governancePreferences.equityPhilosophy,
    companyPreferences: profile.value.intent.companyPreferences,
    profileVisibility: profile.value.privacy.profileVisibility,
  }
})

const readiness = computed(() => profile.value ? buildProfileReadiness(profile.value) : null)
const profilePreview = computed(() => profile.value ? recommendProfilesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const opportunityPreview = computed(() => profile.value ? recommendOpportunitiesForProfile(workspaceStore.data, profile.value).slice(0, 3) : [])
const shouldShowProfilePreview = computed(() => profile.value ? profile.value.hasIdea && !profile.value.wantsToJoinIdea : false)

async function submitProfile(payload: any) {
  if (!authStore.currentUser)
    return

  workspaceStore.completeMinimumOnboarding(authStore.currentUser.id, payload)
  await authStore.completeOnboarding({
    ...authStore.currentUser,
    name: payload.displayName,
    role: payload.intentMode === "join" ? "collaborator" : authStore.currentUser.role,
    onboardingCompleted: true,
  })

  previewUnlocked.value = true

  toastStore.push({
    title: "Match preview unlocked",
    message: "You can now see relevant introductions right away, then finish the deeper profile fields before outreach.",
    tone: "success",
  })
}
</script>

<template>
  <div>
    <p class="section-kicker">
      Onboarding
    </p>
    <h1 class="text-3xl tracking-tight font-semibold mt-3">
      Reach the first credible match before the form gets heavy.
    </h1>
    <p class="muted text-sm leading-6 mt-4">
      This first pass is intentionally short. CoFoundry needs enough signal to rank the right people: role, weekly bandwidth, runway, timing, and equity philosophy. The deeper profile fields can unlock outreach, proposals, and contracts.
    </p>

    <div v-if="!previewUnlocked" class="mt-8">
      <MinimumOnboardingForm
        v-if="initialValues"
        :initial-values="initialValues"
        @submitted="submitProfile"
      />
    </div>

    <div v-else class="mt-8 gap-6 grid">
      <div class="panel p-6">
        <div class="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <p class="text-sm font-semibold">
              Match preview ready
            </p>
            <p class="muted text-sm leading-6 mt-2">
              {{ shouldShowProfilePreview ? "These are the collaborators CoFoundry would put in front of you first." : "These are the founder opportunities CoFoundry would put in front of you first." }}
            </p>
          </div>
          <BaseBadge :tone="readiness?.readyForOutreach ? 'success' : 'accent'">
            {{ readiness?.percent || 0 }}% profile strength
          </BaseBadge>
        </div>

        <div class="panel-inset mt-5 p-5">
          <p class="text-sm font-semibold">
            Outreach unlock rule
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ readiness?.readyForOutreach ? "You are ready to send connect requests." : `Add ${readiness?.missingOutreachItems.join(", ")} to unlock outreach.` }}
          </p>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton to="/app">
            Go to workspace
          </BaseButton>
          <BaseButton variant="secondary" to="/app/profile/edit">
            Finish full profile
          </BaseButton>
          <BaseButton variant="ghost" to="/app/settings">
            Open trust settings
          </BaseButton>
        </div>
      </div>

      <div v-if="shouldShowProfilePreview && profilePreview.length" class="gap-4 grid lg:grid-cols-3">
        <ProfileCard
          v-for="item in profilePreview"
          :key="item.profile.id"
          :profile="item.profile"
          :skills="[]"
        >
          <BaseBadge tone="accent">
            Match score {{ item.score }}
          </BaseBadge>
          <BaseButton variant="secondary" to="/app/discover">
            Review fit
          </BaseButton>
        </ProfileCard>
      </div>

      <div v-else-if="opportunityPreview.length" class="gap-4 grid lg:grid-cols-3">
        <OpportunityCard
          v-for="item in opportunityPreview"
          :key="item.opportunity.id"
          :opportunity="item.opportunity"
        >
          <BaseBadge tone="accent">
            Match score {{ item.score }}
          </BaseBadge>
          <BaseButton variant="secondary" :to="`/app/opportunities/${item.opportunity.id}`">
            Review fit
          </BaseButton>
        </OpportunityCard>
      </div>

      <EmptyState
        v-else
        icon="i-carbon-search"
        title="No preview yet"
        description="Finish the deeper profile fields and trust steps to widen the recommendation set."
      >
        <BaseButton to="/app/profile/edit">
          Finish full profile
        </BaseButton>
      </EmptyState>
    </div>
  </div>
</template>
