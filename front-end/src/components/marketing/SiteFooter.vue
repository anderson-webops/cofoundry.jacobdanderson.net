<script setup lang="ts">
const runtimeConfig = useRuntimeConfig()
const { getPrimaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("site-footer"))
const footerLinkClass = "min-h-[44px] w-full inline-flex items-center rounded-xl px-3 transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
const supportLinkClass = "muted text-sm underline underline-offset-4 min-h-[44px] inline-flex items-center rounded-xl px-2 transition hover:text-[var(--text)]"
</script>

<template>
  <footer class="py-10 border-t border-[var(--line)]">
    <div class="page-shell flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <div>
        <AppLogo />
        <p class="muted text-sm leading-6 mt-3 max-w-md">
          CoFoundry helps founders and collaborators find fit, test the relationship, and put terms in writing.
        </p>
        <div class="mt-4 flex flex-wrap gap-3 items-center">
          <BaseButton size="md" variant="secondary" :to="primaryAccessCta.to" class="min-h-[44px]">
            {{ primaryAccessCta.label }}
          </BaseButton>
          <a :href="`mailto:${runtimeConfig.public.supportEmail}`" :class="supportLinkClass">
            {{ runtimeConfig.public.supportEmail }}
          </a>
        </div>
      </div>
      <div class="gap-8 grid md:grid-cols-3">
        <div class="muted text-sm gap-1 grid">
          <NuxtLink to="/find-cofounder" :class="footerLinkClass">
            Find a cofounder
          </NuxtLink>
          <NuxtLink to="/people" :class="footerLinkClass">
            Public profiles
          </NuxtLink>
          <NuxtLink to="/startups" :class="footerLinkClass">
            Public startup searches
          </NuxtLink>
        </div>
        <div class="muted text-sm gap-1 grid">
          <NuxtLink to="/trust" :class="footerLinkClass">
            Trust Center
          </NuxtLink>
          <NuxtLink to="/contracts" :class="footerLinkClass">
            Contract resources
          </NuxtLink>
          <NuxtLink to="/faq" :class="footerLinkClass">
            FAQ
          </NuxtLink>
        </div>
        <div class="muted text-sm gap-1 grid">
          <NuxtLink to="/terms" :class="footerLinkClass">
            Terms of Service
          </NuxtLink>
          <NuxtLink to="/privacy" :class="footerLinkClass">
            Privacy Policy
          </NuxtLink>
          <NuxtLink to="/contact" :class="footerLinkClass">
            Contact
          </NuxtLink>
          <div class="pt-2 max-w-full w-[12.5rem]">
            <ThemeSchemePicker compact align="start" panel-align="end" />
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
