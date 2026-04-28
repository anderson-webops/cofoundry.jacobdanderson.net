<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { buildPublicProfileSlug, getPublicProfileBySlug, getRoleHubs, slugifySegment } from "~/shared/utils/directory"
import { formatContactRevealStage, formatDate, formatRemotePreference, formatStage, formatStartTimeline } from "~/shared/utils/format"

const route = useRoute()
const slug = String(route.params.slug)
const entry = getPublicProfileBySlug(workspaceSeed, slug)

if (!entry)
  throw createError({ statusCode: 404, statusMessage: "Public profile not found" })

const { profile } = entry
const runtimeConfig = useRuntimeConfig()
const { getIntroCta } = useProductAccess()
const introCta = computed(() => getIntroCta(`public-profile-${entry.slug}`))
const publicProfileUrl = runtimeConfig.public.appUrl
  ? new URL(`/people/${buildPublicProfileSlug(profile)}`, `${runtimeConfig.public.appUrl}/`).toString()
  : undefined
const roleHubSlugs = new Set(getRoleHubs(workspaceSeed).map(entry => entry.slug))
const linkedRoles = [...new Set([profile.roleScope.primaryRole, ...profile.roles])]
  .filter((role): role is string => Boolean(role) && roleHubSlugs.has(slugifySegment(role)))
const publicLinks = [
  { label: "LinkedIn", href: profile.links.linkedin },
  { label: "GitHub", href: profile.links.github },
  { label: "Portfolio", href: profile.links.portfolio },
  { label: "Website", href: profile.links.website },
].filter((link): link is { label: string, href: string } => Boolean(link.href))
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
  <div class="page-shell page-section">
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
            <p class="text-sm text-[var(--accent)] font-semibold">
              Public discovery profile
            </p>
            <p class="muted text-sm leading-6 mt-3">
              Evidence, fit, and verified context are shown before private contact details unlock.
            </p>
          </div>
        </div>

        <p class="muted text-sm mt-4">
          {{ formatRemotePreference(profile.remotePreference) }} · {{ profile.location }} · {{ profile.roleScope.primaryRole || profile.roles[0] }}
        </p>

        <div class="mt-4">
          <TrustSignalStrip :profile="profile" />
        </div>

        <p class="muted text-base leading-7 mt-6">
          {{ profile.bio }}
        </p>

        <div class="surface-row mt-6">
          <p class="text-sm font-semibold">
            Availability snapshot
          </p>
          <p class="muted text-sm leading-6 mt-2">
            Starts {{ formatStartTimeline(profile.intent.startTimeline) }} · {{ profile.commitmentProfile.weeklyAvailabilityHours }}h/week · contact {{ formatContactRevealStage(profile.privacy.contactRevealStage) }}.
          </p>
        </div>
      </section>

      <section class="gap-5 grid">
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
          <div class="surface-row-list mt-4">
            <a
              v-for="artifact in profile.trustSignals.builderProofs"
              :key="artifact.id"
              :href="artifact.url"
              target="_blank"
              rel="ugc nofollow noopener noreferrer"
              class="surface-row block"
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

        <div v-if="publicLinks.length || profile.ventures.length" class="panel p-6">
          <h2 class="text-lg font-semibold">
            Outside context
          </h2>
          <div class="surface-row-list mt-4">
            <a
              v-for="link in publicLinks"
              :key="link.label"
              :href="link.href"
              target="_blank"
              rel="ugc nofollow noopener noreferrer"
              class="surface-row block transition hover:text-[var(--accent)]"
            >
              {{ link.label }}
            </a>
            <div v-for="venture in profile.ventures" :key="venture.id" class="surface-row">
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
