import { createStripeClient } from "~/server/utils/stripe"
import { billingCheckoutSchema } from "~/shared/utils/validation"

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const payload = billingCheckoutSchema.parse(await readBody(event))
  const stripe = createStripeClient(event)

  if (
    runtimeConfig.public.billingMode === "mock"
    || !stripe
    || !runtimeConfig.public.appUrl
    || !runtimeConfig.public[`stripePrice${payload.plan === "pro" ? "Pro" : "Team"}Monthly`]
  ) {
    return {
      mode: "mock",
      checkoutUrl: `${runtimeConfig.public.appUrl}/app/billing?checkout=success&plan=${payload.plan}`,
    }
  }

  const priceId = payload.plan === "pro"
    ? runtimeConfig.public.stripePriceProMonthly
    : runtimeConfig.public.stripePriceTeamMonthly

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${runtimeConfig.public.appUrl}/app/billing?checkout=success&plan=${payload.plan}`,
    cancel_url: `${runtimeConfig.public.appUrl}/app/billing?checkout=cancelled`,
  })

  return {
    mode: "stripe",
    checkoutUrl: session.url,
  }
})
