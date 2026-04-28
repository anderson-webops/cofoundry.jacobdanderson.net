<script setup lang="ts">
import type { StructuredIntro } from "~/shared/types/domain"
import { commitmentOptions, compensationOptions, equityPhilosophyOptions, industryOptions, remoteOptions, roleOptions, runwayBucketOptions, stageOptions } from "~/shared/constants/options"
import { buildSubscriptionUsage, formatUsageQuota } from "~/shared/utils/billing"
import { createEmptySearchFilters, filterOpportunities, filterProfiles } from "~/shared/utils/discovery"
import { formatCommitment, formatCompensation, formatEquityPhilosophy, formatRemotePreference, formatRunwayBucket, formatStage } from "~/shared/utils/format"
import { buildProfileReadiness, getOutreachUnlockMessage } from "~/shared/utils/formation"
import { getProfileSkills } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Discover")

const toastStore = useToastStore()
const { authStore, subscription, workspaceStore } = useCurrentMember()

const scope = ref<"profiles" | "opportunities">("profiles")
const filters = reactive(createEmptySearchFilters())
const connectDialogOpen = ref(false)
const connectTargetUserId = ref("")
const connectRoleContext = ref("")
const currentUserId = computed(() => authStore.currentUser?.id || "")
const currentProfile = computed(() => currentUserId.value ? workspaceStore.data.profiles.find(profile => profile.userId === currentUserId.value) : null)
const currentReadiness = computed(() => currentProfile.value ? buildProfileReadiness(currentProfile.value) : null)
const usage = computed(() => authStore.currentUser ? buildSubscriptionUsage(workspaceStore.data, authStore.currentUser.id, subscription.value || undefined) : null)
const showPlanLimitNotice = computed(() => Boolean(usage.value?.intros.exhausted || usage.value?.savedSearches.exhausted))
const connectTargetProfile = computed(() => connectTargetUserId.value ? workspaceStore.data.profiles.find(profile => profile.userId === connectTargetUserId.value) : null)

const profileResults = computed(() => filterProfiles(workspaceStore.data, filters, currentProfile.value || undefined))
const opportunityResults = computed(() => filterOpportunities(workspaceStore.data, filters, currentProfile.value || undefined))
const currentBookmarks = computed(() => currentUserId.value ? workspaceStore.data.bookmarks.filter(bookmark => bookmark.userId === currentUserId.value) : [])
const resultCount = computed(() => scope.value === "profiles" ? profileResults.value.length : opportunityResults.value.length)
const resultLabel = computed(() => `${resultCount.value} ${scope.value === "profiles" ? `profile${resultCount.value === 1 ? "" : "s"}` : `opportunit${resultCount.value === 1 ? "y" : "ies"}`}`)
const activeFilterChips = computed(() => {
  const chips: { id: string, label: string, type: string, value?: string }[] = []

  if (filters.query)
    chips.push({ id: `query-${filters.query}`, label: `Query: ${filters.query}`, type: "query" })

  if (filters.location)
    chips.push({ id: `location-${filters.location}`, label: `Location: ${filters.location}`, type: "location" })

  if (filters.stage !== "any")
    chips.push({ id: `stage-${filters.stage}`, label: `Stage: ${formatStage(filters.stage)}`, type: "stage" })

  if (filters.timeCommitment !== "any")
    chips.push({ id: `commitment-${filters.timeCommitment}`, label: `Commitment: ${formatCommitment(filters.timeCommitment)}`, type: "timeCommitment" })

  if (filters.remotePreference !== "any")
    chips.push({ id: `remote-${filters.remotePreference}`, label: `Remote: ${formatRemotePreference(filters.remotePreference)}`, type: "remotePreference" })

  if (filters.compensationType !== "any")
    chips.push({ id: `comp-${filters.compensationType}`, label: `Compensation: ${formatCompensation(filters.compensationType)}`, type: "compensationType" })

  if (filters.minimumWeeklyHours)
    chips.push({ id: `hours-${filters.minimumWeeklyHours}`, label: `Min hours: ${filters.minimumWeeklyHours}/week`, type: "minimumWeeklyHours" })

  if (filters.runwayBucket !== "any")
    chips.push({ id: `runway-${filters.runwayBucket}`, label: `Runway: ${formatRunwayBucket(filters.runwayBucket)}`, type: "runwayBucket" })

  if (filters.equityPhilosophy !== "any")
    chips.push({ id: `equity-${filters.equityPhilosophy}`, label: `Equity: ${formatEquityPhilosophy(filters.equityPhilosophy)}`, type: "equityPhilosophy" })

  filters.roles.forEach(role => chips.push({ id: `role-${role}`, label: `Role: ${role}`, type: "role", value: role }))
  filters.industries.forEach(industry => chips.push({ id: `industry-${industry}`, label: `Industry: ${industry}`, type: "industry", value: industry }))

  return chips
})

function skillLabels(profileId: string) {
  return getProfileSkills(workspaceStore.data, profileId).map(item => item.skill.label)
}

function openConnectDialog(userId: string, roleContext = "") {
  connectTargetUserId.value = userId
  connectRoleContext.value = roleContext
  connectDialogOpen.value = true
}

async function submitConnectRequest(payload: { note: string, structuredIntro: StructuredIntro }) {
  if (!authStore.currentUser || !connectTargetUserId.value)
    return

  if (currentReadiness.value && !currentReadiness.value.readyForOutreach) {
    toastStore.push({
      title: "Profile gate still locked",
      message: getOutreachUnlockMessage(currentProfile.value!),
      tone: "warning",
    })
    return
  }

  if (usage.value?.intros.exhausted) {
    toastStore.push({
      title: "Monthly intro limit reached",
      message: "Free and lower-volume plans meter new introductions. Upgrade to keep running your search process without moving off-platform.",
      tone: "warning",
    })
    return
  }

  const sent = await workspaceStore.sendConnectRequest(authStore.currentUser.id, connectTargetUserId.value, payload)
  if (!sent) {
    toastStore.push({
      title: "Request blocked",
      message: currentProfile.value ? getOutreachUnlockMessage(currentProfile.value) : "Finish your profile and phone verification before sending connect requests.",
      tone: "warning",
    })
    return
  }

  toastStore.push({
    title: "Structured intro sent",
    message: "If the other person accepts, messaging will unlock automatically and your proposed next step will carry into the conversation.",
    tone: "success",
  })
  connectDialogOpen.value = false
}

function toggleBookmark(targetType: "profile" | "opportunity", targetId: string) {
  if (!authStore.currentUser)
    return

  const saved = workspaceStore.toggleBookmark(authStore.currentUser.id, targetType, targetId)
  toastStore.push({
    title: saved ? "Saved" : "Removed",
    message: saved ? "Added to your bookmarks." : "Removed from your bookmarks.",
    tone: "info",
  })
}

function saveCurrentSearch() {
  if (!authStore.currentUser)
    return

  const saved = workspaceStore.saveSearch(
    authStore.currentUser.id,
    scope.value,
    `${scope.value === "profiles" ? "Profiles" : "Opportunities"} · ${new Date().toLocaleDateString()}`,
    filters,
  )

  if (!saved) {
    toastStore.push({
      title: "Saved-search limit reached",
      message: "Free keeps one saved search live. Upgrade to Pro for unlimited saved searches and alerts.",
      tone: "warning",
    })
    return
  }

  toastStore.push({
    title: "Search saved",
    message: "You can find this search again from your saved search list.",
    tone: "success",
  })
}

function isBookmarked(targetType: "profile" | "opportunity", targetId: string) {
  return currentBookmarks.value.some(bookmark => bookmark.targetType === targetType && bookmark.targetId === targetId)
}

function quotaText(key: "intros" | "savedSearches") {
  const quota = usage.value?.[key]
  return quota ? formatUsageQuota(quota) : ""
}

function clearAllFilters() {
  Object.assign(filters, createEmptySearchFilters())
}

function removeFilterChip(chip: { type: string, value?: string }) {
  if (chip.type === "query")
    filters.query = ""
  else if (chip.type === "location")
    filters.location = ""
  else if (chip.type === "stage")
    filters.stage = "any"
  else if (chip.type === "timeCommitment")
    filters.timeCommitment = "any"
  else if (chip.type === "remotePreference")
    filters.remotePreference = "any"
  else if (chip.type === "compensationType")
    filters.compensationType = "any"
  else if (chip.type === "minimumWeeklyHours")
    filters.minimumWeeklyHours = ""
  else if (chip.type === "runwayBucket")
    filters.runwayBucket = "any"
  else if (chip.type === "equityPhilosophy")
    filters.equityPhilosophy = "any"
  else if (chip.type === "role" && chip.value)
    filters.roles = filters.roles.filter(role => role !== chip.value)
  else if (chip.type === "industry" && chip.value)
    filters.industries = filters.industries.filter(industry => industry !== chip.value)
}
</script>

<template>
  <div class="gap-5 grid md:gap-6">
    <PageIntro
      eyebrow="Discover"
      title="Search founders, collaborators, and startup opportunities."
      description="Everything here is filtered for startup team formation, not gig work. Save searches, bookmark strong fits, and unlock contact through mutual interest."
    >
      <template #actions>
        <BaseBadge v-if="usage" tone="accent">
          {{ quotaText("intros") }}
        </BaseBadge>
        <BaseButton variant="secondary" @click="saveCurrentSearch">
          Save search
        </BaseButton>
      </template>
    </PageIntro>

    <div class="panel p-5 gap-5 grid">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="pill" :class="scope === 'profiles' ? 'pill-active' : ''" @click="scope = 'profiles'">
          Profiles
        </button>
        <button type="button" class="pill" :class="scope === 'opportunities' ? 'pill-active' : ''" @click="scope = 'opportunities'">
          Opportunities
        </button>
      </div>

      <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-6">
        <TextInput v-model="filters.query" label="Search" helper="Role, problem, industry, or headline." />
        <TextInput v-model="filters.location" label="Location" />
        <SelectInput v-model="filters.stage" label="Stage" :options="[{ label: 'Any stage', value: 'any' }, ...stageOptions]" />
        <SelectInput v-model="filters.timeCommitment" label="Commitment" :options="[{ label: 'Any commitment', value: 'any' }, ...commitmentOptions]" />
        <SelectInput v-model="filters.remotePreference" label="Remote" :options="[{ label: 'Any setup', value: 'any' }, ...remoteOptions]" />
        <SelectInput
          v-model="filters.compensationType"
          label="Compensation"
          :options="[{ label: 'Any compensation', value: 'any' }, ...compensationOptions.map(option => ({ label: formatCompensation(option), value: option }))]"
        />
      </div>

      <div v-if="scope === 'profiles'" class="gap-4 grid md:grid-cols-3">
        <TextInput v-model="filters.minimumWeeklyHours" label="Minimum hours/week" type="number" helper="Filter for the amount of weekly bandwidth you need." />
        <SelectInput v-model="filters.runwayBucket" label="Runway" :options="[{ label: 'Any runway', value: 'any' }, ...runwayBucketOptions]" />
        <SelectInput v-model="filters.equityPhilosophy" label="Equity philosophy" :options="[{ label: 'Any philosophy', value: 'any' }, ...equityPhilosophyOptions]" />
      </div>

      <div class="gap-4 grid xl:grid-cols-2">
        <PillPicker v-model="filters.roles" label="Roles" :options="roleOptions" />
        <PillPicker v-model="filters.industries" label="Industries" :options="industryOptions" />
      </div>
    </div>

    <div class="surface-row flex flex-col gap-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-sm font-semibold">
            {{ resultLabel }} in view
          </p>
          <p class="muted text-sm leading-6 mt-2">
            {{ activeFilterChips.length
              ? "These are the filters actively shaping the current result set. Remove the ones that are over-constraining the search."
              : "No filters are active yet. Start narrow enough to be credible, then widen only if the result set is too thin." }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <p class="muted text-sm">
            {{ activeFilterChips.length }} active filter{{ activeFilterChips.length === 1 ? "" : "s" }}
          </p>
          <BaseButton variant="ghost" size="sm" @click="clearAllFilters">
            Clear all
          </BaseButton>
        </div>
      </div>

      <div v-if="activeFilterChips.length" class="flex flex-wrap gap-2">
        <button
          v-for="chip in activeFilterChips"
          :key="chip.id"
          type="button"
          class="pill"
          @click="removeFilterChip(chip)"
        >
          <span>{{ chip.label }}</span>
          <span class="i-carbon-close" />
        </button>
      </div>
    </div>

    <p v-if="showPlanLimitNotice" class="muted text-sm leading-6">
      Plan limits: {{ quotaText("intros") }}; {{ quotaText("savedSearches") }}. Matched conversations remain available after mutual interest.
    </p>

    <div v-if="scope === 'profiles'" class="gap-4 grid lg:grid-cols-2 xl:grid-cols-3">
      <ProfileCard
        v-for="profileItem in profileResults"
        :key="profileItem.id"
        :profile="profileItem"
        :skills="skillLabels(profileItem.id)"
      >
        <BaseButton variant="secondary" @click="toggleBookmark('profile', profileItem.id)">
          {{ isBookmarked("profile", profileItem.id) ? "Bookmarked" : "Bookmark" }}
        </BaseButton>
        <BaseButton
          v-if="authStore.currentUser && authStore.currentUser.id !== profileItem.userId"
          @click="openConnectDialog(profileItem.userId, profileItem.roleScope.primaryRole || profileItem.roles[0] || 'Founding role')"
        >
          Send structured intro
        </BaseButton>
      </ProfileCard>

      <EmptyState
        v-if="!profileResults.length"
        icon="i-carbon-search"
        title="No profiles match this search"
        description="Broaden the roles, industry, or location filters to see more collaborators and founders."
      >
        <BaseButton variant="secondary" @click="clearAllFilters">
          Clear filters
        </BaseButton>
        <BaseButton variant="ghost" @click="scope = 'opportunities'">
          Switch to opportunities
        </BaseButton>
      </EmptyState>
    </div>

    <div v-else class="gap-4 grid lg:grid-cols-2 xl:grid-cols-3">
      <OpportunityCard
        v-for="opportunity in opportunityResults"
        :key="opportunity.id"
        :opportunity="opportunity"
      >
        <BaseButton variant="secondary" @click="toggleBookmark('opportunity', opportunity.id)">
          {{ isBookmarked("opportunity", opportunity.id) ? "Saved" : "Save" }}
        </BaseButton>
        <BaseButton :to="`/app/opportunities/${opportunity.id}`">
          View
        </BaseButton>
      </OpportunityCard>

      <EmptyState
        v-if="!opportunityResults.length"
        icon="i-carbon-launch"
        title="No opportunities match this search"
        description="Try loosening the stage or industry filters, or switch to profiles to find collaborators directly."
      >
        <BaseButton variant="secondary" @click="clearAllFilters">
          Clear filters
        </BaseButton>
        <BaseButton variant="ghost" @click="scope = 'profiles'">
          Switch to profiles
        </BaseButton>
      </EmptyState>
    </div>

    <StructuredIntroDialog
      v-model="connectDialogOpen"
      context="profile"
      :target-label="connectTargetProfile?.displayName || 'this profile'"
      :default-role-context="connectRoleContext"
      :unlock-copy="currentProfile ? getOutreachUnlockMessage(currentProfile) : 'Outreach is gated behind baseline trust checks.'"
      :quota-copy="usage ? `This plan has ${quotaText('intros')} this month.` : ''"
      @submit="submitConnectRequest"
    />
  </div>
</template>
