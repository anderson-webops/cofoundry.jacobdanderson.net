<script setup lang="ts">
import { appDescription, appName } from "~/shared/constants/app"

const workspaceStore = useWorkspaceStore()
workspaceStore.ensureReady()

useHead({
  htmlAttrs: {
    lang: "en",
  },
})

useSeoMeta({
  title: appName,
  description: appDescription,
  ogSiteName: appName,
})
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ToastStack />
</template>
