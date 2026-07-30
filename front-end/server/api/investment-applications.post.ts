import { investmentApplicationSubmissionSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../utils/auth"
import { createMemberInvestmentApplication } from "../utils/member-submissions"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  if (!runtimeConfig.public.featureInvestmentModule)
    throw createError({ statusCode: 404, statusMessage: "The investment module is not enabled." })

  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 5,
    scope: "investment-applications:create",
    windowMs: 24 * 60 * 60 * 1000,
  })

  return createMemberInvestmentApplication(
    event,
    session,
    investmentApplicationSubmissionSchema.parse(await readBody(event)),
  )
})
