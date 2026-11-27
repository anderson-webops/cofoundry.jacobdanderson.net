import { computed } from "vue"
import { useRuntimeConfig } from "#app"

export function useFeatureFlag(flag: "featureInvestmentModule") {
  const runtimeConfig = useRuntimeConfig()
  return computed(() => Boolean(runtimeConfig.public[flag]))
}
