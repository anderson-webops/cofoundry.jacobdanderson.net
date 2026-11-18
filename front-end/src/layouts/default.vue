<script setup lang="ts">
import SiteFooter from "~/components/marketing/SiteFooter.vue"
import SiteHeader from "~/components/marketing/SiteHeader.vue"
</script>

<template>
  <div>
    <SiteHeader />
    <main>
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
