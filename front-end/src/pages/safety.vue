<script setup lang="ts">
import { trustPillars } from "~/shared/data/marketing"

usePageSeo("Trust & Safety")
</script>

<template>
  <div class="page-shell py-16 md:py-20">
    <PageIntro
      eyebrow="Trust & Safety"
      title="Designed to reduce spam, ambiguity, and bad-faith founder behavior."
      description="The platform keeps contact gated until interest is mutual, exposes moderation tooling early, and treats structured negotiation as a safety feature rather than a growth tactic."
    />

    <div class="mt-10 gap-6 grid lg:grid-cols-3">
      <article v-for="pillar in trustPillars" :key="pillar.title" class="panel p-6">
        <h2 class="text-xl font-semibold">
          {{ pillar.title }}
        </h2>
        <p class="muted text-sm leading-7 mt-4">
          {{ pillar.body }}
        </p>
      </article>
    </div>

    <div class="panel mt-10 p-6 md:p-8">
      <h2 class="text-2xl font-semibold">
        Enforcement in the MVP
      </h2>
      <ul class="text-sm leading-7 mt-6 gap-4 grid">
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Flag profiles, messages, and opportunities from inside the product.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Admin moderation queue with suspension tools and action history.</span>
        </li>
        <li class="flex gap-3">
          <span class="i-carbon-checkmark-filled text-[var(--accent)] mt-1" />
          <span>Profile completion and verification badges to help users assess trust signals.</span>
        </li>
      </ul>
    </div>
  </div>
</template>
