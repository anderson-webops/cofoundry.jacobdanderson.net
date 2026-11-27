import { defineEventHandler, readBody } from "h3"
import { reportSubmissionSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../utils/auth"
import { createMemberReport } from "../utils/member-submissions"
import { assertRateLimit, buildRateLimitKey } from "../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 10,
    scope: "reports:create",
    windowMs: 60 * 60 * 1000,
  })

  return createMemberReport(event, session, reportSubmissionSchema.parse(await readBody(event)))
})
