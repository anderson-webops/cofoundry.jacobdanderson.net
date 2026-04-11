<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { buildPublicProfileSlug, getPublicProfileBySlug, getRoleHubs, slugifySegment } from "~/shared/utils/directory"
import { formatContactRevealStage, formatDate, formatRemotePreference, formatRunwayBucket, formatStage, formatStartTimeline } from "~/shared/utils/format"
import { buildProfileReadiness } from "~/shared/utils/formation"

const route = useRoute()
const slug = String(route.params.slug)
const entry = getPublicProfileBySlug(workspaceSeed, slug)

if (!entry)
  throw createError({ statusCode: 404, statusMessage: "Public profile not found" })

const { profile } = entry
const readiness = buildProfileReadiness(profile)
const runtimeConfig = useRuntimeConfig()
const { getIntroCta } = useProductAccess()
const introCta = computed(() => getIntroCta(`public-profile-${entry.slug}`))
const publicProfileUrl = runtimeConfig.public.appUrl
  ? new URL(`/people/${buildPublicProfileSlug(profile)}`, `${runtimeConfig.public.appUrl}/`).toString()
  : undefined
const roleHubSlugs = new Set(getRoleHubs(workspaceSeed).map(entry => entry.slug))
const linkedRoles = [...new Set([profile.roleScope.primaryRole, ...profile.roles])]
  .filter((role): role is string => Boolean(role) && roleHubSlugs.has(slugifySegment(role)))
const structuredData = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "name": `${profile.displayName} on CoFoundry`,
  ...(publicProfileUrl ? { url: publicProfileUrl } : {}),
  "mainEntity": {
    "@type": "Person",
    "name": profile.displayName,
    "description": profile.headline,
    "jobTitle": profile.roleScope.primaryRole || profile.roles[0],
    "knowsAbout": profile.industries,
    "sameAs": [profile.links.linkedin, profile.links.github, profile.links.portfolio, profile.links.website].filter(Boolean),
  },
}

usePageSeo(profile.displayName, profile.headline, {
  canonicalPath: `/people/${entry.slug}`,
  structuredData,
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Public profile"
      :title="profile.displayName"
      :description="profile.headline"
    >
      <template #actions>
        <BaseButton variant="secondary" to="/people">
          All public profiles
        </BaseButton>
        <BaseButton :to="introCta.to">
          {{ introCta.label }}
        </BaseButton>
      </template>
    </PageIntro>

    <div class="mt-10 gap-6 grid xl:grid-cols-[0.95fr_1.05fr]">
      <section class="panel p-6">
        <div class="flex gap-4 items-start">
          <ProfileAvatar :display-name="profile.displayName" :photo-url="profile.photoUrl" size="lg" />
          <div>
            <div class="flex flex-wrap gap-2">
              <BaseBadge :tone="readiness.trustReady ? 'success' : 'accent'">
                {{ readiness.trustPercent }}% trust-critical
              </BaseBadge>
              <BaseBadge tone="neutral">
                Public-lite profile
              </BaseBadge>
            </div>
            <p class="muted text-sm leading-6 mt-4">
              CoFoundry does not expose a public trust score. Public pages show the evidence and verification surface instead.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <BaseBadge tone="neutral">
            {{ formatRemotePreference(profile.remotePreference) }}
          </BaseBadge>
          <BaseBadge tone="neutral">
            {{ profile.location }}
          </BaseBadge>
          <BaseBadge tone="accent">
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
          <MetricTile label="Start timeline" :value="formatStartTimeline(profile.intent.startTimeline)" />
          <MetricTile label="Trust-critical fields" :value="`${readiness.trustPercent}%`" />
          <MetricTile label="Hours / week" :value="profile.commitmentProfile.weeklyAvailabilityHours" />
          <MetricTile label="Runway" :value="formatRunwayBucket(profile.commitmentProfile.runwayBucket)" />
          <MetricTile label="Contact rule" :value="formatContactRevealStage(profile.privacy.contactRevealStage)" />
        </div>

        <div class="mt-6">
          <TrustReadinessPanel
            :profile="profile"
            title="Public trust surface"
            description="Public visitors see the signals that are fast to scan and hard to fake before any private details unlock."
          />
        </div>

        <div class="mt-6">
          <h2 class="text-lg font-semibold">
            Public highlights
          </h2>
          <ul class="muted text-sm leading-7 mt-4 gap-3 grid">
            <li v-for="item in profile.summaryHighlights" :key="item">
              {{ item }}
            </li>
          </ul>
        </div>
      </section>

      <section class="gap-6 grid">
        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Role and company fit
          </h2>
          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink
              v-for="role in linkedRoles"
              :key="role"
              :to="`/roles/${slugifySegment(role)}`"
              class="pill"
            >
              {{ role }}
            </NuxtLink>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink
              v-for="industry in profile.industries"
              :key="industry"
              :to="`/industries/${slugifySegment(industry)}`"
              class="pill"
            >
              {{ industry }}
            </NuxtLink>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <NuxtLink
              v-for="stage in profile.startupStagePreferences"
              :key="stage"
              :to="`/stage/${slugifySegment(formatStage(stage))}`"
              class="pill"
            >
              {{ formatStage(stage) }}
            </NuxtLink>
          </div>
        </div>

        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Evidence and proof of work
          </h2>
          <div class="mt-4 gap-4 grid">
            <a
              v-for="artifact in profile.trustSignals.builderProofs"
              :key="artifact.id"
              :href="artifact.url"
              target="_blank"
              rel="ugc nofollow noopener noreferrer"
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

        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Public links
          </h2>
          <div class="mt-4 gap-3 grid">
            <a v-if="profile.links.linkedin" :href="profile.links.linkedin" target="_blank" rel="ugc nofollow noopener noreferrer" class="panel-inset p-4">LinkedIn</a>
            <a v-if="profile.links.github" :href="profile.links.github" target="_blank" rel="ugc nofollow noopener noreferrer" class="panel-inset p-4">GitHub</a>
            <a v-if="profile.links.portfolio" :href="profile.links.portfolio" target="_blank" rel="ugc nofollow noopener noreferrer" class="panel-inset p-4">Portfolio</a>
            <a v-if="profile.links.website" :href="profile.links.website" target="_blank" rel="ugc nofollow noopener noreferrer" class="panel-inset p-4">Website</a>
          </div>
        </div>

        <div class="panel p-6">
          <h2 class="text-lg font-semibold">
            Ventures
          </h2>
          <div class="mt-4 gap-3 grid">
            <div v-for="venture in profile.ventures" :key="venture.id" class="panel-inset p-4">
              <p class="font-semibold">
                {{ venture.name }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ venture.role }} · {{ formatStage(venture.stage) }}
              </p>
            </div>
          </div>
          <p class="muted text-xs mt-4">
            Profile availability snapshot last updated {{ formatDate(profile.trustSignals.lastActiveAt) }}.
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
