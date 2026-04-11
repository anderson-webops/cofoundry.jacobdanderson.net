<template>
  <footer class="py-10 border-t border-[var(--line)]">
    <div class="page-shell flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
      <div>
        <AppLogo />
        <p class="muted text-sm leading-6 mt-3 max-w-md">
          CoFoundry is a software platform for forming startup teams, structuring proposals, and generating working agreements. Contracts are templates and not legal advice.
        </p>
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
  </footer>
</template>
