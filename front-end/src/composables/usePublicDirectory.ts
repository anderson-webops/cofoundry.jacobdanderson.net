import type { PublicDirectorySnapshot } from "~/shared/utils/directory"

export async function usePublicDirectory() {
  const { data, error } = await useAsyncData(
    "cofoundry-public-directory",
    () => $fetch<PublicDirectorySnapshot>("/api/public/directory"),
  )

  if (error.value) {
    throw createError({
      statusCode: 503,
      statusMessage: "The public directory is temporarily unavailable.",
    })
  }

  if (!data.value) {
    throw createError({
      statusCode: 503,
      statusMessage: "The public directory is temporarily unavailable.",
    })
  }

  return data.value
}
