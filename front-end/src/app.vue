<script setup lang="ts">
import { appDescription, appName } from "~/shared/constants/app"
import { isPrivateWorkspaceRoutePath } from "~/shared/constants/route-surfaces"
import { buildSiteStructuredData, buildSiteUrl } from "~/shared/utils/seo"
import { themeSchemeStyleContent } from "~/shared/utils/theme"

const workspaceStore = useWorkspaceStore()
workspaceStore.ensureReady()
const route = useRoute()
const canonicalAppUrl = useCanonicalAppUrl()
const { scheme } = useThemeScheme()
const noindexRoute = computed(() => isPrivateWorkspaceRoutePath(route.path))
const analyticsScripts = import.meta.env.PROD
  ? [
      {
        "defer": true,
        "key": "cofoundry-analytics-dedicated",
        "src": "https://analytics.cofoundry.jacobdanderson.net/script.js",
        "data-website-id": "82564e10-5962-49df-8332-50e0c04c7485",
      },
      {
        "defer": true,
        "key": "cofoundry-analytics-central",
        "src": "https://analytics.jacobdanderson.net/script.js",
        "data-website-id": "89771691-ddd3-439b-bf75-7b62c50c41c2",
      },
    ]
  : []
const siteUrl = computed(() => {
  return buildSiteUrl(canonicalAppUrl, route.path || "/")
})
const structuredData = computed(() => buildSiteStructuredData(canonicalAppUrl))

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
    ...(siteUrl.value
      ? [
          {
            rel: "canonical" as const,
            href: siteUrl.value,
          },
        ]
      : []),
  ],
  script: [
    ...analyticsScripts,
    ...structuredData.value.map((entry, index) => ({
      innerHTML: JSON.stringify(entry),
      key: `structured-data-${index}`,
      type: "application/ld+json" as const,
    })),
  ],
  style: [
    {
      innerHTML: themeSchemeStyleContent,
      key: "cofoundry-theme-schemes",
    },
  ],
}))

useSeoMeta({
  title: appName,
  description: appDescription,
  ogSiteName: appName,
  ogType: "website",
  ogUrl: () => siteUrl.value || undefined,
  robots: () => (noindexRoute.value ? "noindex,nofollow" : undefined),
  twitterCard: "summary_large_image",
  twitterDescription: appDescription,
  twitterTitle: appName,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ToastStack />
</template>
