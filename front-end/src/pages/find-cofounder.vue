<script setup lang="ts">
import { workspaceSeed } from "~/shared/data/seed"
import { getIndustryHubs, getPublicOpportunities, getPublicProfiles, getRoleHubs, getStageHubs } from "~/shared/utils/directory"

const publicProfiles = getPublicProfiles(workspaceSeed)
const publicOpportunities = getPublicOpportunities(workspaceSeed)
const roleHubs = getRoleHubs(workspaceSeed)
const industryHubs = getIndustryHubs(workspaceSeed)
const stageHubs = getStageHubs(workspaceSeed)
const { buildAccessRequestPath, policy } = useProductAccess()
const directoryAccessCta = computed(() => policy.value.accountsEnabled
  ? { label: "Create your profile", to: "/auth/sign-up" }
  : { label: "Request access", to: buildAccessRequestPath("find-cofounder", "access") })

usePageSeo(
  "Find a cofounder",
  "Browse public founder profiles, startup searches, and team-formation resources organized by role, industry, and stage.",
  {
    canonicalPath: "/find-cofounder",
  },
)
</script>

<template>
  <div>
    <section class="page-section">
      <div class="page-shell gap-8 grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p class="section-kicker">
            Public founder directory
          </p>
          <h1 class="text-4xl tracking-tight font-semibold mt-4 max-w-3xl md:text-6xl">
            Browse founders, cofounders, and startup searches by role, stage, and market.
          </h1>
          <p class="muted text-lg leading-8 mt-6 max-w-2xl">
            Browse opt-in public profiles and startup searches. Direct contact stays inside CoFoundry until both sides opt in.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" :to="directoryAccessCta.to">
              {{ directoryAccessCta.label }}
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/people">
              Browse public profiles
            </BaseButton>
          </div>
        </div>

        <div class="surface-row-list">
          <div class="surface-row">
            <p class="section-kicker">
              Public inventory
            </p>
            <div class="mt-4 gap-5 grid grid-cols-2">
              <div>
                <p class="text-3xl font-semibold">
                  {{ publicProfiles.length }}
                </p>
                <p class="muted text-sm mt-1">
                  public profiles
                </p>
              </div>
              <div>
                <p class="text-3xl font-semibold">
                  {{ publicOpportunities.length }}
                </p>
                <p class="muted text-sm mt-1">
                  startup searches
                </p>
              </div>
            </div>
          </div>
          <div class="surface-row">
            <p class="text-sm font-semibold">
              Private until mutual
            </p>
            <p class="muted text-sm leading-6 mt-3">
              Direct email, phone, and member-only details stay inside CoFoundry until both sides opt in.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell">
        <PageIntro
          eyebrow="Directory shortcuts"
          title="Narrow by role, market, or stage."
          description="Use these shortcuts to jump into the part of the network that is most relevant to your search."
        >
          <template #actions>
            <BaseButton variant="secondary" to="/roles">
              View all hubs
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-10 gap-8 grid lg:grid-cols-3">
          <div>
            <p class="section-kicker">
              Roles
            </p>
            <div class="plain-link-list mt-4">
              <NuxtLink
                v-for="hub in roleHubs.slice(0, 6)"
                :key="hub.slug"
                :to="`/roles/${hub.slug}`"
                class="plain-link-item"
              >
                <span class="font-semibold">{{ hub.label }}</span>
                <span class="muted text-sm">{{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches</span>
              </NuxtLink>
            </div>
          </div>

          <div>
            <p class="section-kicker">
              Industries
            </p>
            <div class="plain-link-list mt-4">
              <NuxtLink
                v-for="hub in industryHubs.slice(0, 5)"
                :key="hub.slug"
                :to="`/industries/${hub.slug}`"
                class="plain-link-item"
              >
                <span class="font-semibold">{{ hub.label }}</span>
                <span class="muted text-sm">{{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches</span>
              </NuxtLink>
            </div>
          </div>

          <div>
            <p class="section-kicker">
              Stages
            </p>
            <div class="plain-link-list mt-4">
              <NuxtLink
                v-for="hub in stageHubs.slice(0, 5)"
                :key="hub.slug"
                :to="`/stage/${hub.slug}`"
                class="plain-link-item"
              >
                <span class="font-semibold">{{ hub.label }}</span>
                <span class="muted text-sm">{{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell">
        <PageIntro
          eyebrow="Featured public inventory"
          title="Start with people or active searches."
          description="Use the full profile and startup-search indexes when you are ready to scan more broadly."
        >
          <template #actions>
            <BaseButton variant="secondary" to="/people">
              All profiles
            </BaseButton>
            <BaseButton variant="secondary" to="/startups">
              All startup searches
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-8 gap-6 grid lg:grid-cols-2">
          <article class="panel p-6">
            <div class="flex flex-wrap gap-3 items-center justify-between">
              <h2 class="text-xl font-semibold">
                Public profiles
              </h2>
              <BaseBadge tone="neutral">
                {{ publicProfiles.length }}
              </BaseBadge>
            </div>
            <div class="plain-link-list mt-5">
              <NuxtLink
                v-for="entry in publicProfiles.slice(0, 4)"
                :key="entry.slug"
                :to="`/people/${entry.slug}`"
                class="plain-link-item"
              >
                <span>
                  <span class="font-semibold block">{{ entry.profile.displayName }}</span>
                  <span class="muted text-sm">{{ entry.profile.headline }}</span>
                </span>
                <span class="i-carbon-arrow-right text-[var(--accent)]" />
              </NuxtLink>
            </div>
          </article>

          <article class="panel p-6">
            <div class="flex flex-wrap gap-3 items-center justify-between">
              <h2 class="text-xl font-semibold">
                Startup searches
              </h2>
              <BaseBadge tone="neutral">
                {{ publicOpportunities.length }}
              </BaseBadge>
            </div>
            <div class="plain-link-list mt-5">
              <NuxtLink
                v-for="entry in publicOpportunities.slice(0, 4)"
                :key="entry.slug"
                :to="`/startups/${entry.slug}`"
                class="plain-link-item"
              >
                <span>
                  <span class="font-semibold block">{{ entry.opportunity.startupName }}</span>
                  <span class="muted text-sm">{{ entry.opportunity.oneLinePitch }}</span>
                </span>
                <span class="i-carbon-arrow-right text-[var(--accent)]" />
              </NuxtLink>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
