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
    photoUrl: profile.value.photoUrl,
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
  await workspaceStore.persistWorkspace(true)
  await authStore.completeOnboarding()

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
      Start with a strong profile.
    </h1>
    <p class="muted text-sm leading-6 mt-4">
      Add enough detail to unlock your first recommendations, then finish the deeper fields before you send intros.
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
              {{ shouldShowProfilePreview ? "These are the collaborators you would see first." : "These are the founder opportunities you would see first." }}
            </p>
          </div>
          <BaseBadge :tone="readiness?.trustReady ? 'success' : 'accent'">
            {{ readiness?.trustPercent || 0 }}% profile signals
          </BaseBadge>
        </div>

        <div class="panel-inset mt-5 p-5">
          <p class="text-sm font-semibold">
            Outreach status
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ readiness?.readyForOutreach ? "You are ready to send connect requests." : `Add ${readiness?.missingOutreachItems.join(", ")} to unlock outreach.` }}
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ readiness?.trustReady ? "Your proof and verification details are in place." : `Still missing: ${readiness?.missingTrustItems.join(", ")}.` }}
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
            Open settings
          </BaseButton>
        </div>
      </div>

      <div v-if="shouldShowProfilePreview && profilePreview.length" class="gap-4 grid 2xl:grid-cols-3 lg:grid-cols-2">
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

      <div v-else-if="opportunityPreview.length" class="gap-4 grid 2xl:grid-cols-3 lg:grid-cols-2">
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
