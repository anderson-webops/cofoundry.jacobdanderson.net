<script setup lang="ts">
import { appDescription, appName } from "~/shared/constants/app"

const trailingSlashPattern = /\/$/

const workspaceStore = useWorkspaceStore()
workspaceStore.ensureReady()
const runtimeConfig = useRuntimeConfig()
const route = useRoute()
const { scheme } = useThemeScheme()
const privateRoutePattern = /^(?:\/admin|\/app|\/auth|\/api|\/onboarding)(?:\/|$)/
const noindexRoute = computed(() => privateRoutePattern.test(route.path))
const analyticsScripts = import.meta.env.PROD
  ? [
      {
        "defer": true,
        "src": "https://analytics.jacobdanderson.net/script.js",
        "data-website-id": "89771691-ddd3-439b-bf75-7b62c50c41c2",
      },
    ]
  : []
const siteUrl = computed(() => {
  const configured = runtimeConfig.public.appUrl || "https://cofoundry.jacobdanderson.net"
  return new URL(route.path || "/", `${configured.replace(trailingSlashPattern, "")}/`).toString()
})
const structuredData = computed(() => [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "description": appDescription,
    "name": appName,
    "url": "https://cofoundry.jacobdanderson.net",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "description": appDescription,
    "name": appName,
    "url": "https://cofoundry.jacobdanderson.net",
  },
])

useHead(() => ({
  htmlAttrs: {
    "data-theme-scheme": scheme.value,
    "lang": "en",
  },
  meta: noindexRoute.value
    ? [
        {
          name: "robots",
          content: "noindex,nofollow",
        },
      ]
    : [],
  link: [
    {
      rel: "canonical",
      href: siteUrl.value,
    },
  ],
  script: [
    ...analyticsScripts,
    ...structuredData.value.map((entry, index) => ({
      innerHTML: JSON.stringify(entry),
      key: `structured-data-${index}`,
      type: "application/ld+json",
    })),
  ],
}))

useSeoMeta({
  title: appName,
  description: appDescription,
  ogSiteName: appName,
  ogType: "website",
  ogUrl: () => siteUrl.value,
  robots: () => (noindexRoute.value ? "noindex,nofollow" : undefined),
  twitterCard: "summary_large_image",
  twitterDescription: appDescription,
  twitterTitle: appName,
})
</script>

<template>
  <VitePwaManifest />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ToastStack />
</template>
