<script setup lang="ts">
import { formatContactRevealStage, formatCurrentWorkStatus, formatDeadlockPreference, formatDecisionModelPreference, formatEquityPhilosophy, formatLeadershipPreference, formatRelativeDate, formatRunwayBucket, formatStartTimeline } from "~/shared/utils/format"
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
        <div class="flex gap-4 items-start">
          <ProfileAvatar :display-name="profile.displayName" :photo-url="profile.photoUrl" size="lg" />
          <div class="min-w-0">
            <div class="flex flex-wrap gap-2">
              <BaseBadge tone="neutral">
                {{ profile.location }}
              </BaseBadge>
              <BaseBadge tone="neutral">
                {{ profile.roleScope.primaryRole || profile.roles[0] }}
              </BaseBadge>
              <BaseBadge :tone="profile.verificationBadges.emailVerified ? 'success' : 'warning'">
                {{ profile.verificationBadges.emailVerified ? "Verified email" : "Email pending" }}
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-4">
              This is the member-facing version of your public discovery profile.
            </p>
          </div>
        </div>

        <div class="mt-4">
          <TrustSignalStrip :profile="profile" />
        </div>

        <p class="muted text-base leading-7 mt-6">
          {{ profile.bio }}
        </p>

        <div class="mt-6">
          <TrustReadinessPanel :profile="profile" />
        </div>

        <div class="mt-6">
          <h2 class="text-lg font-semibold">
            Evidence and proof of work
          </h2>
          <div class="mt-4 gap-3 grid">
            <a
              v-for="artifact in profile.trustSignals.builderProofs"
              :key="artifact.id"
              :href="artifact.url"
              target="_blank"
              class="panel-inset p-4"
            >
              <p class="font-semibold">
                {{ artifact.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ artifact.summary }}
              </p>
              <p class="text-sm mt-3">
                {{ artifact.outcome }}
              </p>
            </a>
          </div>
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
            Public profile
          </button>
          <button type="button" class="pill" :class="tab === 'private' ? 'pill-active' : ''" @click="tab = 'private'">
            Private details
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
          <details class="panel-inset p-4">
            <summary class="text-lg font-semibold cursor-pointer">
              Intent profile
            </summary>
            <div class="muted text-sm leading-6 mt-4 gap-3 grid">
              <div>Start timeline: {{ formatStartTimeline(profile.intent.startTimeline) }}</div>
              <div>Commitment: {{ profile.commitmentProfile.weeklyAvailabilityHours }}h/week · full-time by {{ profile.commitmentProfile.fullTimeBy }}</div>
              <div>Runway and status: {{ formatRunwayBucket(profile.commitmentProfile.runwayBucket) }} · {{ formatCurrentWorkStatus(profile.commitmentProfile.currentStatus) }}</div>
              <div>Conversation capacity: {{ profile.intent.introCapacity }}</div>
              <div>Median reply time: {{ profile.trustSignals.medianReplyHours }} hours · last active {{ formatRelativeDate(profile.trustSignals.lastActiveAt) }}</div>
              <div>Contact reveal rule: {{ formatContactRevealStage(profile.privacy.contactRevealStage) }}</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="preference in profile.intent.companyPreferences" :key="preference" class="pill">
                {{ preference }}
              </span>
              <span v-for="item in profile.intent.nonNegotiables" :key="item" class="pill">
                {{ item }}
              </span>
            </div>
          </details>

          <details class="panel-inset p-4">
            <summary class="text-lg font-semibold cursor-pointer">
              Governance defaults
            </summary>
            <div class="muted text-sm leading-6 mt-4 gap-3 grid">
              <div>Equity philosophy: {{ formatEquityPhilosophy(profile.governancePreferences.equityPhilosophy) }}</div>
              <div>Leadership preference: {{ formatLeadershipPreference(profile.governancePreferences.leadershipPreference) }}</div>
              <div>Decision model: {{ formatDecisionModelPreference(profile.governancePreferences.decisionModelPreference) }}</div>
              <div>Deadlock plan: {{ formatDeadlockPreference(profile.governancePreferences.deadlockPreference) }}</div>
            </div>
          </details>

          <details class="panel-inset p-4">
            <summary class="text-lg font-semibold cursor-pointer">
              Role boundaries and IP readiness
            </summary>
            <div class="muted text-sm leading-6 mt-4 gap-3 grid">
              <div>Primary role: {{ profile.roleScope.primaryRole }}</div>
              <div>Non-responsibilities: {{ profile.roleScope.nonResponsibilities.join(", ") }}</div>
              <div>Accountability milestones: {{ profile.roleScope.accountabilityMilestones.join(", ") }}</div>
              <div>Existing assets: {{ profile.ipReadiness.existingAssets.join(", ") }}</div>
              <div>Prior constraints: {{ profile.ipReadiness.priorObligations.replaceAll("_", " ") }} · {{ profile.ipReadiness.readyToAssignIp ? "ready to assign IP" : "needs IP discussion" }}</div>
            </div>
          </details>
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
