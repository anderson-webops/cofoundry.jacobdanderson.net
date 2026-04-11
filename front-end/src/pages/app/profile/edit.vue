<script setup lang="ts">
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
      headline: profile.value.headline,
      bio: profile.value.bio,
      location: profile.value.location,
      remotePreference: profile.value.remotePreference,
      roles: profile.value.roles,
      yearsExperience: profile.value.yearsExperience,
      industries: profile.value.industries,
      startupStagePreferences: profile.value.startupStagePreferences,
      compensationPreferences: profile.value.compensationPreferences,
      equityExpectationRange: profile.value.equityExpectationRange,
      timeCommitment: profile.value.timeCommitment,
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

function submitProfile(payload: any) {
  if (!authStore.currentUser)
    return

  workspaceStore.updateCurrentProfile(authStore.currentUser.id, payload)
  toastStore.push({
    title: "Profile updated",
    message: "Your discovery profile was saved.",
    tone: "success",
  })
  navigateTo("/app/profile")
}
</script>

<template>
  <div v-if="initialValues" class="gap-6 grid">
    <PageIntro
      eyebrow="Profile"
      title="Edit your profile"
      description="Keep your founder signal current so recommendations, visibility, and contract context stay accurate."
    />
    <div class="panel p-6">
      <ProfileEditorForm :initial-values="initialValues" submit-label="Save profile" @submitted="submitProfile" />
    </div>
  </div>
</template>
