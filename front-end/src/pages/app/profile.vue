<script setup lang="ts">
import { getProfileSkills } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Profile")

const { profile, workspaceStore } = useCurrentMember()
const tab = ref<"public" | "private">("public")

const skillEntries = computed(() => profile.value ? getProfileSkills(workspaceStore.data, profile.value.id) : [])
</script>

<template>
  <div v-if="profile" class="gap-6 grid">
    <PageIntro
      eyebrow="Profile"
      :title="profile.displayName"
      :description="profile.headline"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/app/profile/edit">
          Edit profile
        </BaseButton>
      </template>
    </PageIntro>

    <div class="gap-6 grid xl:grid-cols-[0.95fr_1.05fr]">
      <section class="panel p-6">
        <div class="flex flex-wrap gap-2">
          <BaseBadge :tone="profile.verificationBadges.profileComplete ? 'success' : 'warning'">
            {{ profile.verificationBadges.profileComplete ? "Completed profile" : "Needs more detail" }}
          </BaseBadge>
          <BaseBadge :tone="profile.verificationBadges.emailVerified ? 'success' : 'warning'">
            Verified email
          </BaseBadge>
          <BaseBadge :tone="profile.verificationBadges.linkedAccounts ? 'accent' : 'neutral'">
            {{ profile.verificationBadges.linkedAccounts ? "Linked accounts" : "No linked accounts" }}
          </BaseBadge>
        </div>

        <p class="muted text-base leading-7 mt-6">
          {{ profile.bio }}
        </p>

        <div class="mt-6 gap-4 grid md:grid-cols-2">
          <MetricTile label="Location" :value="profile.location" />
          <MetricTile label="Commitment" :value="profile.timeCommitment.replaceAll('_', ' ')" />
          <MetricTile label="Compensation" :value="profile.compensationPreferences.join(', ')" />
          <MetricTile label="Equity range" :value="profile.equityExpectationRange" />
        </div>

        <div class="mt-6">
          <h2 class="text-lg font-semibold">
            Skills
          </h2>
          <div class="mt-4 flex flex-wrap gap-2">
            <span v-for="entry in skillEntries" :key="entry.id" class="pill">
              {{ entry.skill.label }} · {{ entry.level }}
            </span>
          </div>
        </div>
      </section>

      <section class="panel p-6">
        <div class="flex gap-2">
          <button type="button" class="pill" :class="tab === 'public' ? 'pill-active' : ''" @click="tab = 'public'">
            Public-lite view
          </button>
          <button type="button" class="pill" :class="tab === 'private' ? 'pill-active' : ''" @click="tab = 'private'">
            Private full view
          </button>
        </div>

        <div v-if="tab === 'public'" class="mt-6 gap-5 grid">
          <div>
            <h2 class="text-lg font-semibold">
              Public highlights
            </h2>
            <ul class="muted text-sm leading-7 mt-4 gap-3 grid">
              <li v-for="item in profile.summaryHighlights" :key="item">
                {{ item }}
              </li>
            </ul>
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              Portfolio
            </h2>
            <div class="mt-4 gap-3 grid">
              <div v-for="project in profile.portfolio" :key="project.id" class="panel-inset p-4">
                <p class="font-semibold">
                  {{ project.name }}
                </p>
                <p class="muted text-sm leading-6 mt-2">
                  {{ project.summary }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="mt-6 gap-5 grid">
          <div>
            <h2 class="text-lg font-semibold">
              Values and work style
            </h2>
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="value in profile.values" :key="value" class="pill">
                {{ value }}
              </span>
              <span v-for="preference in profile.workStylePreferences" :key="preference" class="pill">
                {{ preference }}
              </span>
            </div>
          </div>
          <div>
            <h2 class="text-lg font-semibold">
              Links
            </h2>
            <div class="text-sm mt-4 gap-3 grid">
              <a :href="profile.links.linkedin" target="_blank" class="panel-inset p-4">LinkedIn</a>
              <a :href="profile.links.github || '#'" target="_blank" class="panel-inset p-4">GitHub</a>
              <a :href="profile.links.portfolio || '#'" target="_blank" class="panel-inset p-4">Portfolio</a>
              <a :href="profile.links.website || '#'" target="_blank" class="panel-inset p-4">Website</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
