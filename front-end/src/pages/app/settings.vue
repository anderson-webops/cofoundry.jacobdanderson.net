<script setup lang="ts">
definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Settings")

const runtimeConfig = useRuntimeConfig()
const toastStore = useToastStore()
const { authStore, profile, workspaceStore } = useCurrentMember()

async function signOut() {
  await authStore.signOut()
  await navigateTo("/auth/sign-in")
}

function resetDemoData() {
  workspaceStore.resetToSeed()
  toastStore.push({
    title: "Demo data reset",
    message: "The local mock workspace was restored to the seeded state.",
    tone: "success",
  })
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Settings"
      title="Workspace settings"
      description="Profile visibility, environment modes, and local development controls live here."
    />

    <div class="gap-6 grid xl:grid-cols-2">
      <div class="panel p-6">
        <h2 class="text-lg font-semibold">
          Profile and privacy
        </h2>
        <div class="muted text-sm mt-5 gap-3 grid">
          <div>Current visibility: {{ profile?.privacy.profileVisibility }}</div>
          <div>Contact details visible to matches only: {{ profile?.privacy.contactDetailsVisibleToMatchesOnly ? "Yes" : "No" }}</div>
          <div>Remote preference: {{ profile?.remotePreference }}</div>
        </div>
        <div class="mt-5">
          <BaseButton variant="secondary" to="/app/profile/edit">
            Edit profile
          </BaseButton>
        </div>
      </div>

      <div class="panel p-6">
        <h2 class="text-lg font-semibold">
          Runtime modes
        </h2>
        <div class="muted text-sm mt-5 gap-3 grid">
          <div>Backend mode: {{ runtimeConfig.public.backendMode }}</div>
          <div>Billing mode: {{ runtimeConfig.public.billingMode }}</div>
          <div>Investment module: {{ runtimeConfig.public.featureInvestmentModule ? "Enabled" : "Disabled" }}</div>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" @click="resetDemoData">
            Reset mock data
          </BaseButton>
          <BaseButton variant="ghost" @click="signOut">
            Sign out
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
