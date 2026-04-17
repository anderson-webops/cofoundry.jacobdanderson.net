import type { SessionUser } from "~/shared/types/domain"
import { completeOnboarding, requireAuthenticatedSession } from "~/server/utils/auth"

export default defineEventHandler(async (event) => {
  const currentSession = await requireAuthenticatedSession(event)
  const { session } = await readBody<{ session: SessionUser }>(event)

  if (!session)
    throw createError({ statusCode: 400, statusMessage: "Missing session payload." })

  if (session.id !== currentSession.id)
    throw createError({ statusCode: 403, statusMessage: "You can only complete onboarding for your own account." })

  return {
    session: await completeOnboarding(event, {
      ...currentSession,
      ...session,
      id: currentSession.id,
      email: currentSession.email,
    }),
  }
})
