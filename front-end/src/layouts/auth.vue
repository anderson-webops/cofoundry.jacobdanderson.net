<script setup lang="ts">
useHead({
  meta: [
    {
      name: "robots",
      content: "noindex, nofollow",
    },
  ],
})
</script>

<template>
  <div class="px-4 py-8 min-h-screen">
    <div class="page-shell">
      <div class="mb-8 flex items-center justify-between">
        <AppLogo />
        <ThemeToggle />
      </div>
      <div class="gap-8 grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section class="hero-auth-panel p-8 rounded-[2rem] relative overflow-hidden">
          <div class="hero-spotlight" />
          <p class="section-kicker auth-hero-kicker">
            Founder relationships deserve structure
          </p>
          <h1 class="text-4xl tracking-tight font-semibold mt-4 max-w-xl md:text-5xl">
            Match with people you can actually build a company with.
          </h1>
          <p class="auth-hero-copy text-base leading-7 mt-5 max-w-lg">
            CoFoundry helps founders, collaborators, and early operators align on fit, scope, and ownership before the relationship gets fuzzy.
          </p>
        </section>
        <section class="panel mx-auto p-6 max-w-xl w-full md:p-8">
          <slot />
        </section>
      </div>
    </div>
  </div>
</template>
