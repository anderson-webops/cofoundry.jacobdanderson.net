<script setup lang="ts">
import { commitmentOptions, industryOptions, roleOptions, stageOptions } from "~/shared/constants/options"
import { createEmptySearchFilters, filterOpportunities, filterProfiles } from "~/shared/utils/discovery"
import { getProfileSkills } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Discover")

const toastStore = useToastStore()
const { authStore, workspaceStore } = useCurrentMember()

const scope = ref<"profiles" | "opportunities">("profiles")
const viewMode = ref<"card" | "list">("card")
const filters = reactive(createEmptySearchFilters())
const connectDialogOpen = ref(false)
const connectTargetUserId = ref("")
const connectNote = ref("")
const currentUserId = computed(() => authStore.currentUser?.id || "")

const profileResults = computed(() => filterProfiles(workspaceStore.data, filters))
const opportunityResults = computed(() => filterOpportunities(workspaceStore.data, filters))
const currentBookmarks = computed(() => currentUserId.value ? workspaceStore.data.bookmarks.filter(bookmark => bookmark.userId === currentUserId.value) : [])

function skillLabels(profileId: string) {
  return getProfileSkills(workspaceStore.data, profileId).map(item => item.skill.label)
}

function openConnectDialog(userId: string) {
  connectTargetUserId.value = userId
  connectNote.value = ""
  connectDialogOpen.value = true
}

function submitConnectRequest() {
  if (!authStore.currentUser || !connectTargetUserId.value)
    return

  workspaceStore.sendConnectRequest(authStore.currentUser.id, connectTargetUserId.value, connectNote.value)
  toastStore.push({
    title: "Connect request sent",
    message: "If the other person accepts, messaging will unlock automatically.",
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

  workspaceStore.saveSearch(
    authStore.currentUser.id,
    scope.value,
    `${scope.value === "profiles" ? "Profiles" : "Opportunities"} · ${new Date().toLocaleDateString()}`,
    filters,
  )
  toastStore.push({
    title: "Search saved",
    message: "You can find this search again from your saved search list.",
    tone: "success",
  })
}

function isBookmarked(targetType: "profile" | "opportunity", targetId: string) {
  return currentBookmarks.value.some(bookmark => bookmark.targetType === targetType && bookmark.targetId === targetId)
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Discover"
      title="Search founders, collaborators, and startup opportunities."
      description="Everything here is filtered for startup team formation, not gig work. Save searches, bookmark strong fits, and unlock contact through mutual interest."
    >
      <template #actions>
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
        <button type="button" class="pill" :class="viewMode === 'card' ? 'pill-active' : ''" @click="viewMode = 'card'">
          Cards
        </button>
        <button type="button" class="pill" :class="viewMode === 'list' ? 'pill-active' : ''" @click="viewMode = 'list'">
          List
        </button>
      </div>

      <div class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
        <TextInput v-model="filters.query" label="Search" helper="Role, problem, industry, or headline." />
        <TextInput v-model="filters.location" label="Location" />
        <SelectInput v-model="filters.stage" label="Stage" :options="[{ label: 'Any stage', value: 'any' }, ...stageOptions]" />
        <SelectInput v-model="filters.timeCommitment" label="Commitment" :options="[{ label: 'Any commitment', value: 'any' }, ...commitmentOptions]" />
      </div>

      <div class="gap-4 grid xl:grid-cols-2">
        <PillPicker v-model="filters.roles" label="Roles" :options="roleOptions" />
        <PillPicker v-model="filters.industries" label="Industries" :options="industryOptions" />
      </div>
    </div>

    <div v-if="scope === 'profiles'" class="gap-4 grid" :class="viewMode === 'card' ? 'lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'">
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
          @click="openConnectDialog(profileItem.userId)"
        >
          Connect
        </BaseButton>
      </ProfileCard>

      <EmptyState
        v-if="!profileResults.length"
        icon="i-carbon-search"
        title="No profiles match this search"
        description="Broaden the roles, industry, or location filters to see more collaborators and founders."
      />
    </div>

    <div v-else class="gap-4 grid" :class="viewMode === 'card' ? 'lg:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'">
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
      />
    </div>

    <BaseDialog v-model="connectDialogOpen" title="Send connect request" description="Direct contact stays hidden until the request is accepted.">
      <TextareaInput v-model="connectNote" label="Why this fit?" helper="Explain the specific role, stage, or operating fit you see." rows="5" />
      <div class="mt-5 flex justify-end">
        <BaseButton @click="submitConnectRequest">
          Send request
        </BaseButton>
      </div>
    </BaseDialog>
  </div>
</template>
