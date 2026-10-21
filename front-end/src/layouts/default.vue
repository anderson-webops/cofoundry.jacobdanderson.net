<template>
  <div class="flex flex-col min-h-screen">
    <SiteHeader />
    <main id="main-content" tabindex="-1" class="outline-none flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
