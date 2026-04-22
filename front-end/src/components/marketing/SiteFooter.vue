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
          CoFoundry helps founders and early collaborators find the right fit, test the working relationship, and put terms in writing.
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
          <div class="pt-2 max-w-full w-[12.5rem]">
            <ThemeSchemePicker compact align="start" />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
