<template>
  <footer class="py-10 border-t border-[var(--line)]">
    <div class="page-shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div>
        <AppLogo />
        <p class="muted text-sm leading-6 mt-3 max-w-md">
          CoFoundry is a software platform for forming startup teams, structuring proposals, and generating working agreements. Contracts are templates and not legal advice.
        </p>
      </div>
      <div class="muted text-sm gap-3 grid md:text-right">
        <NuxtLink to="/terms">
          Terms of Service
        </NuxtLink>
        <NuxtLink to="/privacy">
          Privacy Policy
        </NuxtLink>
        <NuxtLink to="/safety">
          Trust & Safety
        </NuxtLink>
        <NuxtLink to="/contact">
          Contact
        </NuxtLink>
      </div>
    </div>
  </footer>
</template>
