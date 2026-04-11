import type { SessionUser } from "~/shared/types/domain"
import { completeOnboarding } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  const { session } = await readBody<{ session: SessionUser }>(event)

  if (!session)
    throw createError({ statusCode: 400, statusMessage: "Missing session payload." })

  return {
    session: completeOnboarding(event, session),
  }
})
