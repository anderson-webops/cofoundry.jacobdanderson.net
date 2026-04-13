<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()
const { getPrimaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("site-footer"))
</script>

<template>
  <footer class="py-10 border-t border-[var(--line)]">
    <div class="page-shell flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <div>
        <AppLogo />
        <p class="muted text-sm leading-6 mt-3 max-w-md">
          CoFoundry is a software platform for forming startup teams, structuring proposals, and generating working agreements. Contracts are templates and not legal advice.
        </p>
        <div class="mt-4 flex flex-wrap gap-3 items-center">
          <BaseButton size="sm" variant="secondary" :to="primaryAccessCta.to">
            {{ primaryAccessCta.label }}
          </BaseButton>
          <a :href="`mailto:${runtimeConfig.public.supportEmail}`" class="muted text-sm underline underline-offset-4">
            {{ runtimeConfig.public.supportEmail }}
          </a>
        </div>
      </div>
      <div class="gap-8 grid md:grid-cols-3">
        <div class="muted text-sm gap-3 grid">
          <NuxtLink to="/find-cofounder">
            Find a cofounder
          </NuxtLink>
          <NuxtLink to="/people">
            Public profiles
          </NuxtLink>
          <NuxtLink to="/startups">
            Public startup searches
          </NuxtLink>
        </div>
        <div class="muted text-sm gap-3 grid">
          <NuxtLink to="/trust">
            Trust Center
          </NuxtLink>
          <NuxtLink to="/contracts">
            Contract resources
          </NuxtLink>
          <NuxtLink to="/faq">
            FAQ
          </NuxtLink>
        </div>
        <div class="muted text-sm gap-3 grid">
          <NuxtLink to="/terms">
            Terms of Service
          </NuxtLink>
          <NuxtLink to="/privacy">
            Privacy Policy
          </NuxtLink>
          <NuxtLink to="/contact">
            Contact
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="page-shell mt-8 pt-6 border-t border-[var(--line)] flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <p class="muted text-sm leading-6 max-w-xl">
        Choose a palette family here. Light and dark mode still follow the selected scheme.
      </p>
      <ThemeSchemePicker compact />
    </div>
  </footer>
</template>
