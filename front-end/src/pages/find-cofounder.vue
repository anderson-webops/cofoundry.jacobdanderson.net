<script setup lang="ts">
import { contractGuidePages, trustCenterPages } from "~/shared/data/public-content"
import { workspaceSeed } from "~/shared/data/seed"
import { getIndustryHubs, getPublicOpportunities, getPublicProfiles, getRoleHubs, getStageHubs } from "~/shared/utils/directory"

const publicProfiles = getPublicProfiles(workspaceSeed)
const publicOpportunities = getPublicOpportunities(workspaceSeed)
const roleHubs = getRoleHubs(workspaceSeed)
const industryHubs = getIndustryHubs(workspaceSeed)
const stageHubs = getStageHubs(workspaceSeed)

usePageSeo(
  "Find a cofounder",
  "Browse public founder profiles, startup searches, and serious team-formation resources organized by role, industry, and stage.",
  {
    canonicalPath: "/find-cofounder",
  },
)
</script>

<template>
  <div>
    <section class="py-16 md:py-20">
      <div class="page-shell gap-8 grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p class="section-kicker">
            Public founder directory
          </p>
          <h1 class="text-4xl tracking-tight font-semibold mt-4 max-w-3xl md:text-6xl">
            Search startup team formation by role, stage, and company shape.
          </h1>
          <p class="muted text-lg leading-8 mt-6 max-w-2xl">
            CoFoundry exposes opt-in public founder profiles and startup searches for people who want to be found. Direct contact still runs through mutual intent, but the public layer proves that real inventory exists before you sign up.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" to="/auth/sign-up">
              Create your profile
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/people">
              Browse public profiles
            </BaseButton>
          </div>
        </div>

        <div class="panel p-6 md:p-8">
          <div class="gap-4 grid sm:grid-cols-2">
            <MetricTile label="Public profiles" :value="publicProfiles.length" />
            <MetricTile label="Public startup searches" :value="publicOpportunities.length" />
            <MetricTile label="Role hubs" :value="roleHubs.length" />
            <MetricTile label="Stage hubs" :value="stageHubs.length" />
          </div>
          <div class="panel-inset mt-6 p-4">
            <p class="text-sm font-semibold">
              Why this page exists
            </p>
            <p class="muted text-sm leading-6 mt-3">
              Serious founder matching works better when people can browse real, structured inventory before they decide whether the product is worth joining.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell">
        <PageIntro
          eyebrow="Browse by role"
          title="Start with the role gap you are actually trying to close."
          description="Role-first discovery is the cleanest search pattern in early-stage team formation. These public hubs reflect live founder inventory and active startup searches."
        >
          <template #actions>
            <BaseButton variant="secondary" to="/roles">
              View all role hubs
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-10 gap-5 grid md:grid-cols-2 xl:grid-cols-3">
          <NuxtLink
            v-for="hub in roleHubs.slice(0, 6)"
            :key="hub.slug"
            :to="`/roles/${hub.slug}`"
            class="panel p-6 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
          >
            <div class="flex gap-4 items-start justify-between">
              <div>
                <h2 class="text-xl font-semibold">
                  {{ hub.label }}
                </h2>
                <p class="muted text-sm leading-6 mt-3">
                  {{ hub.description }}
                </p>
              </div>
              <BaseBadge tone="accent">
                {{ hub.profileCount + hub.opportunityCount }} pages
              </BaseBadge>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell gap-8 grid lg:grid-cols-2">
        <div>
          <PageIntro
            eyebrow="Browse by industry"
            title="Find founder searches in markets you already understand."
            description="Industry hubs work when they map to real operator judgment, not generic startup content."
          />
          <div class="mt-8 gap-4 grid">
            <NuxtLink
              v-for="hub in industryHubs.slice(0, 5)"
              :key="hub.slug"
              :to="`/industries/${hub.slug}`"
              class="panel p-5 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <div class="flex gap-3 items-center justify-between">
                <div>
                  <h2 class="font-semibold">
                    {{ hub.label }}
                  </h2>
                  <p class="muted text-sm leading-6 mt-2">
                    {{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches
                  </p>
                </div>
                <span class="i-carbon-arrow-up-right text-xl text-[var(--accent)]" />
              </div>
            </NuxtLink>
          </div>
        </div>

        <div>
          <PageIntro
            eyebrow="Browse by stage"
            title="Sort for the pace and ambiguity level you actually want."
            description="Idea-stage and traction-stage searches have different expectations. Public stage hubs make that difference visible."
          />
          <div class="mt-8 gap-4 grid">
            <NuxtLink
              v-for="hub in stageHubs.slice(0, 5)"
              :key="hub.slug"
              :to="`/stage/${hub.slug}`"
              class="panel p-5 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <div class="flex gap-3 items-center justify-between">
                <div>
                  <h2 class="font-semibold">
                    {{ hub.label }}
                  </h2>
                  <p class="muted text-sm leading-6 mt-2">
                    {{ hub.profileCount }} profiles · {{ hub.opportunityCount }} searches
                  </p>
                </div>
                <span class="i-carbon-arrow-up-right text-xl text-[var(--accent)]" />
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell">
        <PageIntro
          eyebrow="Public profiles"
          title="Opt-in profiles that prove seriousness before contact unlocks."
          description="These pages stay lightweight on purpose: enough proof, intent, and company-fit detail to judge whether a conversation is worth earning."
        >
          <template #actions>
            <BaseButton variant="secondary" to="/people">
              View all public profiles
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-10 gap-5 grid xl:grid-cols-3">
          <ProfileCard
            v-for="entry in publicProfiles.slice(0, 3)"
            :key="entry.slug"
            :profile="entry.profile"
            :skills="entry.skillLabels"
          >
            <BaseButton variant="secondary" :to="`/people/${entry.slug}`">
              View public profile
            </BaseButton>
          </ProfileCard>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell">
        <PageIntro
          eyebrow="Public startup searches"
          title="See how founders frame the role before you ask for an intro."
          description="The public startup layer is intentionally high-signal: problem, stage, role expectations, trust markers, and the kind of commitment the founder expects."
        >
          <template #actions>
            <BaseButton variant="secondary" to="/startups">
              View startup searches
            </BaseButton>
          </template>
        </PageIntro>

        <div class="mt-10 gap-5 grid xl:grid-cols-3">
          <OpportunityCard
            v-for="entry in publicOpportunities.slice(0, 3)"
            :key="entry.slug"
            :opportunity="entry.opportunity"
          >
            <BaseButton variant="secondary" :to="`/startups/${entry.slug}`">
              View startup search
            </BaseButton>
          </OpportunityCard>
        </div>
      </div>
    </section>

    <section class="py-16">
      <div class="page-shell gap-8 grid lg:grid-cols-2">
        <div class="panel p-6 md:p-8">
          <p class="section-kicker">
            Trust Center
          </p>
          <h2 class="text-3xl tracking-tight font-semibold mt-3">
            Search visibility only works if the safety model is explicit.
          </h2>
          <div class="mt-6 gap-4 grid">
            <NuxtLink
              v-for="page in trustCenterPages"
              :key="page.slug"
              :to="`/trust/${page.slug}`"
              class="panel-inset p-4 transition hover:border-[var(--accent)]"
            >
              <p class="font-semibold">
                {{ page.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ page.description }}
              </p>
            </NuxtLink>
          </div>
        </div>

        <div class="panel p-6 md:p-8">
          <p class="section-kicker">
            Contract resources
          </p>
          <h2 class="text-3xl tracking-tight font-semibold mt-3">
            Learn the founder terms before a real negotiation forces them.
          </h2>
          <div class="mt-6 gap-4 grid">
            <NuxtLink
              v-for="page in contractGuidePages"
              :key="page.slug"
              :to="`/contracts/${page.slug}`"
              class="panel-inset p-4 transition hover:border-[var(--accent)]"
            >
              <p class="font-semibold">
                {{ page.title }}
              </p>
              <p class="muted text-sm leading-6 mt-2">
                {{ page.description }}
              </p>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
