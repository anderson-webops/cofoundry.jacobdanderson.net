import { billingSubscriptionMutationSchema } from "~/shared/utils/validation"
import { requireAuthenticatedSession } from "../../utils/auth"
import { resolveServerBillingAccessPolicy } from "../../utils/billing-access"
import { updateMockSubscriptionRenewal } from "../../utils/billing-persistence"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const session = await requireAuthenticatedSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 10,
    scope: "billing:subscription",
    windowMs: 10 * 60 * 1000,
  })

  const payload = billingSubscriptionMutationSchema.parse(await readBody(event))

  if (runtimeConfig.public.billingMode === "stripe") {
    throw createError({
      statusCode: 409,
      statusMessage: "Use the Stripe customer portal to manage live billing subscriptions.",
    })
  }

  const billingPolicy = resolveServerBillingAccessPolicy(event)
  if (!billingPolicy.mockBillingPreviewEnabled) {
    throw createError({
      statusCode: 409,
      statusMessage: "Billing changes are operator-managed until Stripe billing is enabled.",
    })
  }

  const workspace = await updateMockSubscriptionRenewal(event, session, payload.action)
  if (!workspace) {
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to update billing state in this environment.",
    })
  }

  return {
    data: workspace.seed,
    mode: "mock",
    session: workspace.session,
    subscription: workspace.state.subscription,
  }
})
