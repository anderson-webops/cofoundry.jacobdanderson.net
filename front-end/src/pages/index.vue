<script setup lang="ts">
import { appDescription, appTagline } from "~/shared/constants/app"

const { getPrimaryAccessCta } = useProductAccess()
const heroAccessCta = computed(() => getPrimaryAccessCta("home-hero"))

usePageSeo("Build startup teams with more structure", appDescription, {
  canonicalPath: "/",
})
</script>

<template>
  <div>
    <section class="page-section relative overflow-hidden">
      <div class="page-shell">
        <div class="fade-up">
          <h1 class="text-5xl tracking-tight font-semibold max-w-3xl md:text-7xl">
            {{ appTagline }}
          </h1>
          <p class="muted text-lg leading-8 mt-6 max-w-2xl">
            Founder and collaborator profiles, mutual introductions, trial sprints, proposal negotiation, and agreement tools.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <BaseButton size="lg" :to="heroAccessCta.to">
              {{ heroAccessCta.label }}
            </BaseButton>
            <BaseButton size="lg" variant="secondary" to="/how-it-works">
              See how it works
            </BaseButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
