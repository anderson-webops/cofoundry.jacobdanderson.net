<script setup lang="ts">
import { appTagline } from "~/shared/constants/app"

const runtimeConfig = useRuntimeConfig()
const { getPrimaryAccessCta } = useProductAccess()
const primaryAccessCta = computed(() => getPrimaryAccessCta("site-footer"))
const footerLinkClass = "min-h-[44px] w-full inline-flex items-center rounded-xl -mx-3 px-3 transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
const supportLinkClass = "muted text-sm underline underline-offset-4 min-h-[44px] inline-flex items-center rounded-xl px-2 transition hover:text-[var(--text)]"
const headingClass = "text-xs text-[var(--text)] tracking-[0.08em] font-bold mb-2 uppercase"
</script>

<template>
  <footer class="mt-8 py-14 border-t border-[var(--line)] bg-[var(--bg-muted)]">
    <div class="page-shell gap-12 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
      <div class="max-w-sm">
        <AppLogo />
        <p class="muted leading-7 mt-4">
          {{ appTagline }}
        </p>
        <div class="mt-6 flex flex-wrap gap-3 items-center">
          <BaseButton size="md" variant="secondary" :to="primaryAccessCta.to" class="min-h-[44px]">
            {{ primaryAccessCta.label }}
          </BaseButton>
          <a :href="`mailto:${runtimeConfig.public.supportEmail}`" :class="supportLinkClass">
            {{ runtimeConfig.public.supportEmail }}
          </a>
        </div>
      </div>
      <div class="gap-8 grid grid-cols-2 sm:grid-cols-3">
        <nav aria-labelledby="footer-explore" class="muted text-[0.9375rem] grid content-start">
          <h2 id="footer-explore" :class="headingClass">
            Explore
          </h2>
          <NuxtLink to="/find-cofounder" :class="footerLinkClass">
            Find a cofounder
          </NuxtLink>
          <NuxtLink to="/people" :class="footerLinkClass">
            Public profiles
          </NuxtLink>
          <NuxtLink to="/startups" :class="footerLinkClass">
            Startup searches
          </NuxtLink>
        </nav>
        <nav aria-labelledby="footer-learn" class="muted text-[0.9375rem] grid content-start">
          <h2 id="footer-learn" :class="headingClass">
            Learn
          </h2>
          <NuxtLink to="/trust" :class="footerLinkClass">
            Trust Center
          </NuxtLink>
          <NuxtLink to="/contracts" :class="footerLinkClass">
            Agreement guides
          </NuxtLink>
          <NuxtLink to="/faq" :class="footerLinkClass">
            FAQ
          </NuxtLink>
        </nav>
        <nav aria-labelledby="footer-company" class="muted text-[0.9375rem] grid content-start">
          <h2 id="footer-company" :class="headingClass">
            Company
          </h2>
          <NuxtLink to="/contact" :class="footerLinkClass">
            Contact
          </NuxtLink>
          <NuxtLink to="/terms" :class="footerLinkClass">
            Terms of Service
          </NuxtLink>
          <NuxtLink to="/privacy" :class="footerLinkClass">
            Privacy Policy
          </NuxtLink>
        </nav>
      </div>
    </div>
    <div class="page-shell mt-12 pt-6 border-t border-[var(--line)] flex flex-wrap gap-4 items-center justify-between">
      <p class="muted text-sm">
        CoFoundry does not take automatic equity.
      </p>
      <div class="max-w-full w-[12.5rem]">
        <ThemeSchemePicker compact align="start" panel-align="end" />
      </div>
    </div>
  </footer>
</template>
