<script setup lang="ts">
definePageMeta({
  layout: "auth",
  middleware: ["auth"],
})

usePageSeo("Onboarding")

const toastStore = useToastStore()
const { authStore, profile, workspaceStore } = useCurrentMember()

const initialValues = computed(() => {
  if (!profile.value)
    return undefined

  return {
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
})

async function submitProfile(payload: any) {
  if (!authStore.currentUser)
    return

  workspaceStore.updateCurrentProfile(authStore.currentUser.id, payload)
  await authStore.completeOnboarding({
    ...authStore.currentUser,
    name: payload.displayName,
    onboardingCompleted: true,
  })

  toastStore.push({
    title: "Onboarding complete",
    message: "Your profile is now ready for discovery and matching.",
    tone: "success",
  })
  await navigateTo("/app")
}
</script>

<template>
  <div>
    <p class="section-kicker">
      Onboarding
    </p>
    <h1 class="text-3xl tracking-tight font-semibold mt-3">
      Build a profile people can actually evaluate.
    </h1>
    <p class="muted text-sm leading-6 mt-4">
      CoFoundry is optimized for startup team formation. The questions here exist so matching, proposals, and contracts all have better context later.
    </p>

    <div class="mt-8">
      <ProfileEditorForm
        v-if="initialValues"
        :initial-values="initialValues"
        stepped
        submit-label="Complete onboarding"
        @submitted="submitProfile"
      />
    </div>
  </div>
</template>
