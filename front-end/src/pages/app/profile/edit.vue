<script setup lang="ts">
import { computed } from "vue"
import { navigateTo } from "#app"
import { definePageMeta } from "#app/composables/pages"
import ProfileEditorForm from "~/components/app/ProfileEditorForm.vue"
import PageIntro from "~/components/ui/PageIntro.vue"
import { useCurrentMember } from "~/composables/useCurrentMember"
import { usePageSeo } from "~/composables/usePageSeo"
import { useToastStore } from "~/stores/toast"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Edit profile")

const toastStore = useToastStore()
const { authStore, profile, workspaceStore } = useCurrentMember()

const initialValues = computed(() => profile.value
  ? {
      displayName: profile.value.displayName,
      photoUrl: profile.value.photoUrl,
      headline: profile.value.headline,
      bio: profile.value.bio,
      location: profile.value.location,
      remotePreference: profile.value.remotePreference,
      primaryRole: profile.value.roleScope.primaryRole,
      roles: profile.value.roles,
      yearsExperience: profile.value.yearsExperience,
      industries: profile.value.industries,
      startupStagePreferences: profile.value.startupStagePreferences,
      compensationPreferences: profile.value.compensationPreferences,
      equityExpectationRange: profile.value.equityExpectationRange,
      timeCommitment: profile.value.timeCommitment,
      weeklyAvailabilityHours: profile.value.commitmentProfile.weeklyAvailabilityHours,
      startTimeline: profile.value.intent.startTimeline,
      fullTimeBy: profile.value.commitmentProfile.fullTimeBy,
      runwayBucket: profile.value.commitmentProfile.runwayBucket,
      currentStatus: profile.value.commitmentProfile.currentStatus,
      equityPhilosophy: profile.value.governancePreferences.equityPhilosophy,
      leadershipPreference: profile.value.governancePreferences.leadershipPreference,
      decisionModelPreference: profile.value.governancePreferences.decisionModelPreference,
      deadlockPreference: profile.value.governancePreferences.deadlockPreference,
      companyPreferences: profile.value.intent.companyPreferences,
      nonNegotiables: profile.value.intent.nonNegotiables,
      introCapacity: profile.value.intent.introCapacity,
      nonResponsibilities: profile.value.roleScope.nonResponsibilities,
      accountabilityMilestones: profile.value.roleScope.accountabilityMilestones,
      existingAssets: profile.value.ipReadiness.existingAssets,
      existingAssetsNotes: profile.value.ipReadiness.existingAssetsNotes,
      priorObligations: profile.value.ipReadiness.priorObligations,
      readyToAssignIp: profile.value.ipReadiness.readyToAssignIp,
      linkedin: profile.value.links.linkedin,
      github: profile.value.links.github,
      portfolio: profile.value.links.portfolio,
      website: profile.value.links.website,
      hasIdea: profile.value.hasIdea,
      wantsToJoinIdea: profile.value.wantsToJoinIdea,
      values: profile.value.values,
      workStylePreferences: profile.value.workStylePreferences,
      profileVisibility: profile.value.privacy.profileVisibility,
    }
  : undefined)

async function submitProfile(payload: any) {
  if (!authStore.currentUser)
    return

  workspaceStore.updateCurrentProfile(authStore.currentUser.id, payload)
  await workspaceStore.persistWorkspace(true)
  toastStore.push({
    title: "Profile updated",
    message: "Your discovery profile was saved.",
    tone: "success",
  })
  await navigateTo("/app/profile")
}
</script>

<template>
  <div v-if="initialValues" class="gap-6 grid">
    <PageIntro
      eyebrow="Profile"
      title="Edit your profile"
    />
    <div class="panel p-6">
      <ProfileEditorForm :initial-values="initialValues" submit-label="Save profile" @submitted="submitProfile" />
    </div>
  </div>
</template>
