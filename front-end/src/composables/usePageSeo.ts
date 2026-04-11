import { appDescription, appName } from "~/shared/constants/app"

export function usePageSeo(title: string, description = appDescription) {
  useSeoMeta({
    title: `${title} · ${appName}`,
    description,
    ogTitle: `${title} · ${appName}`,
    ogDescription: description,
    twitterCard: "summary_large_image",
  })
}
