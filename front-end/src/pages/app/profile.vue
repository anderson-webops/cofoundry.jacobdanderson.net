<script setup lang="ts">
import { formatContactRevealStage, formatCurrentWorkStatus, formatDeadlockPreference, formatDecisionModelPreference, formatEquityPhilosophy, formatLeadershipPreference, formatRelativeDate, formatRunwayBucket, formatStartTimeline } from "~/shared/utils/format"
import { buildProfileReadiness } from "~/shared/utils/formation"
import { getProfileSkills } from "~/shared/utils/workspace"

definePageMeta({
  layout: "app",
  middleware: ["auth", "onboarding"],
})

usePageSeo("Profile")

const { profile, workspaceStore } = useCurrentMember()
const tab = ref<"public" | "private">("public")

const skillEntries = computed(() => profile.value ? getProfileSkills(workspaceStore.data, profile.value.id) : [])
const readiness = computed(() => profile.value ? buildProfileReadiness(profile.value) : null)
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
              <BaseBadge :tone="readiness?.profileComplete ? 'success' : 'warning'">
                {{ readiness?.profileComplete ? "Completed profile" : `Profile strength ${readiness?.percent}%` }}
              </BaseBadge>
              <BaseBadge :tone="readiness?.trustReady ? 'success' : 'accent'">
                {{ readiness?.trustPercent || 0 }}% trust-critical
              </BaseBadge>
              <BaseBadge :tone="profile.verificationBadges.emailVerified ? 'success' : 'warning'">
                Verified email
              </BaseBadge>
              <BaseBadge :tone="profile.verificationBadges.linkedAccounts ? 'accent' : 'neutral'">
                {{ profile.verificationBadges.linkedAccounts ? "Linked accounts" : "No linked accounts" }}
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-4">
              A visible trust score is no longer shown to members. CoFoundry ranks profiles privately and exposes the underlying evidence instead.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <BaseBadge tone="neutral">
            {{ profile.location }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ profile.roleScope.primaryRole || profile.roles[0] }}
          </BaseBadge>
        </div>

        <div class="mt-4">
          <TrustSignalStrip :profile="profile" />
        </div>

        <p class="muted text-base leading-7 mt-6">
          {{ profile.bio }}
        </p>

        <div class="mt-6 gap-4 grid md:grid-cols-2">
          <MetricTile label="Location" :value="profile.location" />
          <MetricTile label="Trust-critical fields" :value="`${readiness?.trustPercent || 0}%`" context="Recognizable profile, verification rails, proof, role context, availability, and intent clarity." />
          <MetricTile label="Profile readiness" :value="`${readiness?.percent || 0}%`" />
          <MetricTile label="Commitment" :value="profile.timeCommitment.replaceAll('_', ' ')" />
          <MetricTile label="Start timeline" :value="formatStartTimeline(profile.intent.startTimeline)" />
          <MetricTile label="Hours / week" :value="profile.commitmentProfile.weeklyAvailabilityHours" />
          <MetricTile label="Runway" :value="formatRunwayBucket(profile.commitmentProfile.runwayBucket)" />
        </div>

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
            Public-lite view
          </button>
          <button type="button" class="pill" :class="tab === 'private' ? 'pill-active' : ''" @click="tab = 'private'">
            Private full view
          </button>
        </div>

        <div v-if="tab === 'public'" class="mt-6 gap-5 grid">
          <IntentChecklistPanel :profile="profile" title="What serious matches can evaluate quickly" />
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
          <div class="panel-inset p-4 gap-3 grid">
            <h2 class="text-lg font-semibold">
              Intent profile
            </h2>
            <div class="muted text-sm leading-6">
              Start timeline: {{ formatStartTimeline(profile.intent.startTimeline) }}
            </div>
            <div class="muted text-sm leading-6">
              Commitment: {{ profile.commitmentProfile.weeklyAvailabilityHours }}h/week · full-time by {{ profile.commitmentProfile.fullTimeBy }}
            </div>
            <div class="muted text-sm leading-6">
              Runway and status: {{ formatRunwayBucket(profile.commitmentProfile.runwayBucket) }} · {{ formatCurrentWorkStatus(profile.commitmentProfile.currentStatus) }}
            </div>
            <div class="muted text-sm leading-6">
              Conversation capacity: {{ profile.intent.introCapacity }}
            </div>
            <div class="muted text-sm leading-6">
              Median reply time: {{ profile.trustSignals.medianReplyHours }} hours · last active {{ formatRelativeDate(profile.trustSignals.lastActiveAt) }}
            </div>
            <div class="muted text-sm leading-6">
              Contact reveal rule: {{ formatContactRevealStage(profile.privacy.contactRevealStage) }}
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="preference in profile.intent.companyPreferences" :key="preference" class="pill">
                {{ preference }}
              </span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="item in profile.intent.nonNegotiables" :key="item" class="pill">
                {{ item }}
              </span>
            </div>
          </div>
          <div class="panel-inset p-4 gap-3 grid">
            <h2 class="text-lg font-semibold">
              Governance defaults
            </h2>
            <div class="muted text-sm leading-6">
              Equity philosophy: {{ formatEquityPhilosophy(profile.governancePreferences.equityPhilosophy) }}
            </div>
            <div class="muted text-sm leading-6">
              Leadership preference: {{ formatLeadershipPreference(profile.governancePreferences.leadershipPreference) }}
            </div>
            <div class="muted text-sm leading-6">
              Decision model: {{ formatDecisionModelPreference(profile.governancePreferences.decisionModelPreference) }}
            </div>
            <div class="muted text-sm leading-6">
              Deadlock plan: {{ formatDeadlockPreference(profile.governancePreferences.deadlockPreference) }}
            </div>
          </div>
          <div class="panel-inset p-4 gap-3 grid">
            <h2 class="text-lg font-semibold">
              Role boundaries and IP readiness
            </h2>
            <div class="muted text-sm leading-6">
              Primary role: {{ profile.roleScope.primaryRole }}
            </div>
            <div class="muted text-sm leading-6">
              Non-responsibilities: {{ profile.roleScope.nonResponsibilities.join(", ") }}
            </div>
            <div class="muted text-sm leading-6">
              Accountability milestones: {{ profile.roleScope.accountabilityMilestones.join(", ") }}
            </div>
            <div class="muted text-sm leading-6">
              Existing assets: {{ profile.ipReadiness.existingAssets.join(", ") }}
            </div>
            <div class="muted text-sm leading-6">
              Prior constraints: {{ profile.ipReadiness.priorObligations.replaceAll("_", " ") }} · {{ profile.ipReadiness.readyToAssignIp ? "ready to assign IP" : "needs IP discussion" }}
            </div>
          </div>
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
