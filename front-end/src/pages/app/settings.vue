<script setup lang="ts">
import type { ContactRevealStage } from "~/shared/types/domain"
import { contactRevealStageOptions } from "~/shared/constants/options"
import { formatContactRevealStage, formatTrustTier } from "~/shared/utils/format"
import { buildProfileTrustTier } from "~/shared/utils/formation"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Settings")

const toastStore = useToastStore()
const { policy } = useProductAccess()
const { authStore, profile, workspaceStore } = useCurrentMember()
const contactRevealStage = ref<ContactRevealStage>(profile.value?.privacy.contactRevealStage || "matches")
const trustTier = computed(() => profile.value ? buildProfileTrustTier(profile.value) : "level_a")

watch(profile, (value) => {
  contactRevealStage.value = value?.privacy.contactRevealStage || "matches"
}, { immediate: true })

watch(contactRevealStage, (value, oldValue) => {
  if (!authStore.currentUser || !oldValue || value === oldValue)
    return

  workspaceStore.updateContactRevealStage(authStore.currentUser.id, value)
  toastStore.push({
    title: "Contact rule updated",
    message: `Contact details now reveal ${formatContactRevealStage(value)}.`,
    tone: "success",
  })
})

function resetDemoData() {
  workspaceStore.resetToSeed()
  toastStore.push({
    title: "Workspace reset",
    message: "The local review workspace was restored to the seeded state.",
    tone: "success",
  })
}

function verify(type: "phone" | "linkedin" | "github" | "website" | "work_domain" | "government_id", label: string) {
  if (!authStore.currentUser || !profile.value)
    return

  if (type === "linkedin" && !profile.value.links.linkedin) {
    toastStore.push({
      title: "Add LinkedIn first",
      message: "Attach your LinkedIn URL on the profile editor before verifying it.",
      tone: "warning",
    })
    return
  }

  if (type === "github" && !profile.value.links.github) {
    toastStore.push({
      title: "Add GitHub first",
      message: "Attach your GitHub URL on the profile editor before verifying it.",
      tone: "warning",
    })
    return
  }

  if ((type === "website" || type === "work_domain") && !profile.value.links.website) {
    toastStore.push({
      title: "Add a website first",
      message: "Attach your personal or company site before verifying the domain.",
      tone: "warning",
    })
    return
  }

  workspaceStore.completeTrustVerification(authStore.currentUser.id, type)
  toastStore.push({
    title: "Verification completed",
    message: `${label} is now reflected on your trust surface in the current environment.`,
    tone: "success",
  })
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Settings"
      title="Workspace settings"
      description="Manage profile visibility, contact rules, and trust verification."
    />

    <div class="gap-6 grid xl:grid-cols-2">
      <div class="panel p-6">
        <h2 class="text-lg font-semibold">
          Profile and privacy
        </h2>
        <div class="muted text-sm mt-5 gap-3 grid">
          <div>Current visibility: {{ profile?.privacy.profileVisibility }}</div>
          <div>Contact details visible to matches only: {{ profile?.privacy.contactDetailsVisibleToMatchesOnly ? "Yes" : "No" }}</div>
          <div>Contact reveal stage: {{ formatContactRevealStage(profile?.privacy.contactRevealStage || "matches") }}</div>
          <div>Remote preference: {{ profile?.remotePreference }}</div>
        </div>
        <div class="mt-5">
          <SelectInput
            v-model="contactRevealStage"
            label="Reveal contact details"
            helper="Choose when direct contact should unlock for other members."
            :options="contactRevealStageOptions"
          />
        </div>
        <div class="mt-5">
          <BaseButton variant="secondary" to="/app/profile/edit">
            Edit profile
          </BaseButton>
        </div>
      </div>

      <div class="panel p-6">
        <h2 class="text-lg font-semibold">
          Trust program
        </h2>
        <div class="mt-5">
          <TrustSignalStrip v-if="profile" :profile="profile" />
        </div>
        <div class="muted text-sm mt-4 gap-3 grid">
          <div>Current tier: {{ formatTrustTier(trustTier) }}</div>
          <div>Level A: verified email and baseline profile.</div>
          <div>Level B: verified identity rails, proof, availability, and intent clarity.</div>
          <div>Level C: government ID assurance for higher-risk actions like contract signing.</div>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" @click="verify('phone', 'Phone verification')">
            Verify phone
          </BaseButton>
          <BaseButton variant="secondary" @click="verify('linkedin', 'LinkedIn verification')">
            Verify LinkedIn
          </BaseButton>
          <BaseButton variant="secondary" @click="verify('github', 'GitHub verification')">
            Verify GitHub
          </BaseButton>
          <BaseButton variant="secondary" @click="verify('website', 'Website verification')">
            Verify website
          </BaseButton>
          <BaseButton variant="secondary" @click="verify('work_domain', 'Work-domain verification')">
            Verify work domain
          </BaseButton>
          <BaseButton variant="secondary" @click="verify('government_id', 'Government ID verification')">
            Verify ID
          </BaseButton>
        </div>
      </div>

      <div v-if="policy.showDemoConveniences" class="panel p-6">
        <h2 class="text-lg font-semibold">
          Development controls
        </h2>
        <div class="muted text-sm mt-5 gap-3 grid">
          <div>These controls exist for local review and staged product walkthroughs.</div>
          <div>They are not part of the normal production workspace experience.</div>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" @click="resetDemoData">
            Reset review workspace
          </BaseButton>
        </div>
      </div>

      <div class="panel p-6">
        <h2 class="text-lg font-semibold">
          Support and safety
        </h2>
        <div class="muted text-sm mt-5 gap-3 grid">
          <div>CoFoundry will not ask for diligence fees, wire transfers, or crypto payments in chat.</div>
          <div>Move off-platform only after a mutual match and only when the contact reveal rule has been satisfied.</div>
        </div>
        <div class="mt-5">
          <BaseButton variant="secondary" to="/contact">
            Contact support
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>
