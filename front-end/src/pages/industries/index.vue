<script setup lang="ts">
const industryHubs = (await usePublicDirectory()).industryHubs

usePageSeo("Industry hubs", "Browse public founder and startup searches organized by industry.", {
  canonicalPath: "/industries",
})
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Industry hubs"
      title="Find teams in markets where your judgment compounds."
      description="Industry pages work best when they collect real public founder searches and collaborators who already understand the market constraints."
    />

    <div class="mt-10 gap-5 grid md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="hub in industryHubs"
        :key="hub.slug"
        :to="`/industries/${hub.slug}`"
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
            {{ hub.profileCount + hub.opportunityCount }}
          </BaseBadge>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
