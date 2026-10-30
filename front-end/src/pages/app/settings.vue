<script setup lang="ts">
import type { ContactRevealStage, PrivacyRequestType } from "~/shared/types/domain"
import { contactRevealStageOptions } from "~/shared/constants/options"
import { formatContactRevealStage, formatTrustTier } from "~/shared/utils/format"
import { buildProfileTrustTier } from "~/shared/utils/formation"

type TrustVerificationType = "email" | "phone" | "linkedin" | "github" | "website" | "work_domain" | "government_id"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Settings")

const toastStore = useToastStore()
const { policy } = useProductAccess()
const { authStore, profile, workspaceStore } = useCurrentMember()
const currentUser = computed(() => authStore.currentUser
  ? workspaceStore.data.users.find(user => user.id === authStore.currentUser?.id)
  : null)
const contactRevealStage = ref<ContactRevealStage>(profile.value?.privacy.contactRevealStage || "matches")
const exportingData = ref(false)
const notificationPreferencesSaving = ref(false)
const privacyRequestDetails = ref("")
const privacyRequestSubmitting = ref(false)
const privacyRequestType = ref<PrivacyRequestType>("account_deletion")
const trustVerificationPending = ref<TrustVerificationType | "">("")
const trustTier = computed(() => profile.value
  ? buildProfileTrustTier(profile.value)
  : "level_a")
const unreadDigestEmailEnabled = computed(() => currentUser.value?.notificationPreferences?.unreadDigestEmail === true)
const workflowEmailEnabled = computed(() => currentUser.value?.notificationPreferences?.workflowEmail === true)
const privacyRequestOptions = [
  { label: "Account deletion", value: "account_deletion" },
  { label: "Data export help", value: "data_export" },
  { label: "Data correction", value: "correction" },
  { label: "Visibility request", value: "visibility" },
  { label: "Safety or privacy concern", value: "safety_privacy" },
]

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

async function downloadDataExport() {
  if (!import.meta.client)
    return

  exportingData.value = true

  try {
    const payload = await $fetch("/api/account/export")
    const blob = new Blob([
      JSON.stringify(payload, null, 2)
    ], { type: "application/json" })
    const href = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = href
    link.download = `cofoundry-data-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(href)
    toastStore.push({
      title: "Export prepared",
      message: "Your account export was downloaded as a JSON file.",
      tone: "success",
    })
  }
  finally {
    exportingData.value = false
  }
}

async function submitPrivacyRequest() {
  if (!privacyRequestDetails.value.trim())
    return

  privacyRequestSubmitting.value = true

  try {
    await $fetch("/api/account/privacy-request", {
      method: "POST",
      body: {
        details: privacyRequestDetails.value,
        type: privacyRequestType.value,
      },
    })
    privacyRequestDetails.value = ""
    toastStore.push({
      title: "Request recorded",
      message: "We received your privacy request.",
      tone: "success",
    })
  }
  finally {
    privacyRequestSubmitting.value = false
  }
}

async function setUnreadDigestEmail(enabled: boolean) {
  if (!currentUser.value)
    return

  notificationPreferencesSaving.value = true

  try {
    await workspaceStore.updateNotificationPreferences(currentUser.value.id, {
      ...(currentUser.value.notificationPreferences || { unreadDigestEmail: false, workflowEmail: false }),
      unreadDigestEmail: enabled,
    })
    toastStore.push({
      title: "Email preference updated",
      message: enabled
        ? "Scheduled unread workspace digests are enabled for your account."
        : "Scheduled unread workspace digests are disabled for your account.",
      tone: "success",
    })
  }
  finally {
    notificationPreferencesSaving.value = false
  }
}

async function setWorkflowEmail(enabled: boolean) {
  if (!currentUser.value)
    return

  notificationPreferencesSaving.value = true

  try {
    await workspaceStore.updateNotificationPreferences(currentUser.value.id, {
      ...(currentUser.value.notificationPreferences || { unreadDigestEmail: false, workflowEmail: false }),
      workflowEmail: enabled,
    })
    toastStore.push({
      title: "Email preference updated",
      message: enabled
        ? "Relationship workflow emails are enabled for your account."
        : "Relationship workflow emails are disabled for your account.",
      tone: "success",
    })
  }
  finally {
    notificationPreferencesSaving.value = false
  }
}

async function requestTrustVerification(type: TrustVerificationType, label: string) {
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

  trustVerificationPending.value = type

  try {
    await $fetch("/api/account/privacy-request", {
      method: "POST",
      body: {
        details: `Trust verification review requested: ${label}. Please review the member profile evidence and update trust badges only after operator or provider confirmation.`,
        type: "safety_privacy",
      },
    })
    toastStore.push({
      title: "Verification review requested",
      message: `${label} will update after operator or provider confirmation.`,
      tone: "success",
    })
  }
  finally {
    trustVerificationPending.value = ""
  }
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Settings"
      title="Workspace settings"
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
          Email notifications
        </h2>
        <p class="muted text-sm leading-6 mt-4">
          Control optional product workflow emails. Service-critical account, security, billing, trust, and support notices are handled separately.
        </p>
        <div class="surface-row mt-5 flex flex-wrap gap-4 items-center justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              Relationship workflow email
            </p>
            <p class="muted text-sm leading-6 mt-1">
              Email me when intros, accepted intros, unread messages, proposals, or signature requests need action.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="workflowEmailEnabled"
            :disabled="notificationPreferencesSaving"
            class="p-1 border border-[var(--border)] rounded-full bg-[var(--surface-strong)] shrink-0 h-8 w-14 transition relative disabled:opacity-60 disabled:cursor-wait"
            :class="workflowEmailEnabled ? 'bg-[var(--accent)]/25' : ''"
            @click="setWorkflowEmail(!workflowEmailEnabled)"
          >
            <span
              class="rounded-full bg-[var(--text)] h-6 w-6 block transition"
              :class="workflowEmailEnabled ? 'translate-x-6 bg-[var(--accent)]' : 'translate-x-0'"
            />
            <span class="sr-only">
              {{ workflowEmailEnabled ? "Disable relationship workflow email" : "Enable relationship workflow email" }}
            </span>
          </button>
        </div>
        <div class="surface-row mt-5 flex flex-wrap gap-4 items-center justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold">
              Scheduled unread digest
            </p>
            <p class="muted text-sm leading-6 mt-1">
              Send a periodic email when intros, replies, proposals, signatures, or admin notices are waiting in your workspace.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="unreadDigestEmailEnabled"
            :disabled="notificationPreferencesSaving"
            class="p-1 border border-[var(--border)] rounded-full bg-[var(--surface-strong)] shrink-0 h-8 w-14 transition relative disabled:opacity-60 disabled:cursor-wait"
            :class="unreadDigestEmailEnabled ? 'bg-[var(--accent)]/25' : ''"
            @click="setUnreadDigestEmail(!unreadDigestEmailEnabled)"
          >
            <span
              class="rounded-full bg-[var(--text)] h-6 w-6 block transition"
              :class="unreadDigestEmailEnabled ? 'translate-x-6 bg-[var(--accent)]' : 'translate-x-0'"
            />
            <span class="sr-only">
              {{ unreadDigestEmailEnabled ? "Disable scheduled unread digest" : "Enable scheduled unread digest" }}
            </span>
          </button>
        </div>
        <p class="muted text-xs leading-5 mt-4">
          The inbox “Email digest” action still sends a one-off digest when you explicitly request it.
        </p>
      </div>

      <div class="panel p-6">
        <h2 class="text-lg font-semibold">
          Trust program
        </h2>
        <div class="mt-5">
          <TrustSignalStrip v-if="profile" :profile="profile" />
        </div>
        <div class="muted text-sm mt-4 gap-3 grid">
          <div>Email: {{ currentUser?.verifiedEmail ? "verified" : "pending operator review" }}</div>
          <div>Current tier: {{ formatTrustTier(trustTier) }}</div>
          <div>Level A: verified email and baseline profile.</div>
          <div>Level B: verified identity rails, proof, availability, and intent clarity.</div>
          <div>Level C: government ID assurance for higher-risk actions like contract signing.</div>
          <div>Request a review when your evidence is ready. Trust badges update only after operator or provider confirmation.</div>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton v-if="!currentUser?.verifiedEmail" variant="secondary" :disabled="trustVerificationPending === 'email'" @click="requestTrustVerification('email', 'Email verification')">
            {{ trustVerificationPending === "email" ? "Requesting..." : "Request email review" }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="trustVerificationPending === 'phone'" @click="requestTrustVerification('phone', 'Phone verification')">
            {{ trustVerificationPending === "phone" ? "Requesting..." : "Request phone review" }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="trustVerificationPending === 'linkedin'" @click="requestTrustVerification('linkedin', 'LinkedIn verification')">
            {{ trustVerificationPending === "linkedin" ? "Requesting..." : "Request LinkedIn review" }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="trustVerificationPending === 'github'" @click="requestTrustVerification('github', 'GitHub verification')">
            {{ trustVerificationPending === "github" ? "Requesting..." : "Request GitHub review" }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="trustVerificationPending === 'website'" @click="requestTrustVerification('website', 'Website verification')">
            {{ trustVerificationPending === "website" ? "Requesting..." : "Request website review" }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="trustVerificationPending === 'work_domain'" @click="requestTrustVerification('work_domain', 'Work-domain verification')">
            {{ trustVerificationPending === "work_domain" ? "Requesting..." : "Request work-domain review" }}
          </BaseButton>
          <BaseButton variant="secondary" :disabled="trustVerificationPending === 'government_id'" @click="requestTrustVerification('government_id', 'Government ID verification')">
            {{ trustVerificationPending === "government_id" ? "Requesting..." : "Request ID review" }}
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
          Data and privacy requests
        </h2>
        <p class="muted text-sm leading-6 mt-4">
          Download your current account data or create a privacy request for deletion, correction, visibility, or safety follow-up.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <BaseButton variant="secondary" :disabled="exportingData" @click="downloadDataExport">
            {{ exportingData ? "Preparing export..." : "Download data export" }}
          </BaseButton>
        </div>
        <div class="surface-divider mt-5 gap-4 grid">
          <SelectInput
            v-model="privacyRequestType"
            label="Request type"
            :options="privacyRequestOptions"
          />
          <TextareaInput
            v-model="privacyRequestDetails"
            label="Request details"
            helper="Include the account, data, or visibility issue you want reviewed."
            :rows="4"
          />
          <div class="flex justify-end">
            <BaseButton :disabled="privacyRequestSubmitting || privacyRequestDetails.trim().length < 12" @click="submitPrivacyRequest">
              {{ privacyRequestSubmitting ? "Recording..." : "Submit privacy request" }}
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <div class="surface-row">
      <p class="muted text-sm leading-6">
        For support or safety concerns, <NuxtLink to="/contact" class="text-[var(--accent)]">
          contact support
        </NuxtLink>. CoFoundry will not ask for diligence fees, wire transfers, or crypto payments in chat.
      </p>
    </div>
  </div>
</template>
