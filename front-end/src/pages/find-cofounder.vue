<script setup lang="ts">
import { formatHubInventoryLabel } from "~/shared/utils/directory"

const directory = await usePublicDirectory()
const publicProfiles = directory.profiles
const publicOpportunities = directory.opportunities
const roleHubs = directory.roleHubs
const industryHubs = directory.industryHubs
const stageHubs = directory.stageHubs
const { buildAccessRequestPath, policy } = useProductAccess()
const directoryAccessCta = computed(() => policy.value.accountsEnabled
  ? { label: "Create your profile", to: "/auth/sign-up" }
  : {
      label: "Request access",
      to: buildAccessRequestPath("find-cofounder", "access")
    })

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
          <h1 class="text-4xl tracking-tight font-semibold max-w-3xl md:text-6xl">
            Browse founders, cofounders, and startup searches by role, stage, and market.
          </h1>
          <p class="muted text-lg leading-8 mt-6 max-w-2xl">
            Direct contact details stay inside CoFoundry until both sides opt in.
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
        </div>
      </div>
    </section>

    <section class="page-section-tight">
      <div class="page-shell">
        <PageIntro
          :heading-level="2"
          title="Browse by role, industry, or stage."
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
                <span class="muted text-sm">{{ formatHubInventoryLabel(hub) }}</span>
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
                <span class="muted text-sm">{{ formatHubInventoryLabel(hub) }}</span>
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
                <span class="muted text-sm">{{ formatHubInventoryLabel(hub) }}</span>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
