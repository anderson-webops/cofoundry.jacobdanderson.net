import type { H3Event } from "h3"
import type Stripe from "stripe"
import type { SessionUser, SubscriptionPlan, SubscriptionStatus } from "~/shared/types/domain"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>

interface PersistedSubscriptionBillingRow {
  stripe_customer_id: string | null
}

function getStripeId(value: string | { id: string } | null | undefined) {
  if (!value)
    return null

  return typeof value === "string" ? value : value.id
}

function toSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "canceled")
    return status

  return "inactive"
}

function planCapabilities(plan: SubscriptionPlan) {
  const paid = plan !== "free"
  return {
    contract_builder: paid,
    proposal_workflow: paid,
    unlimited_messaging: paid,
    visibility_boost: paid,
  }
}

function getFirstSubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data[0]
}

function getPeriodEnd(item: Stripe.SubscriptionItem | undefined) {
  const periodEnd = item?.current_period_end
  return typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null
}

export function resolveStripePlanFromPriceId(event: H3Event, priceId?: string | null): SubscriptionPlan {
  const runtimeConfig = useRuntimeConfig(event)

  if (!priceId)
    return "free"

  if (priceId === runtimeConfig.public.stripePriceTeamMonthly)
    return "team"

  if (priceId === runtimeConfig.public.stripePriceProMonthly)
    return "pro"

  return "free"
}

async function selectStripeCustomerId(adminClient: AdminClient, userId: string) {
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<PersistedSubscriptionBillingRow>()

  if (error)
    throw error

  return data?.stripe_customer_id || null
}

export async function createOrReuseStripeCustomer(event: H3Event, stripe: Stripe, session: SessionUser) {
  let adminClient: AdminClient | null = null

  if (isSupabaseEnabled(event)) {
    adminClient = createSupabaseAdminClient(event)
    if (!adminClient)
      throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

    const existingCustomerId = await selectStripeCustomerId(adminClient, session.id)
    if (existingCustomerId)
      return existingCustomerId
  }

  const customer = await stripe.customers.create({
    email: session.email,
    metadata: {
      cofoundryUserId: session.id,
    },
    name: session.name,
  })

  if (adminClient) {
    const { error } = await adminClient
      .from("subscriptions")
      .update({ stripe_customer_id: customer.id })
      .eq("user_id", session.id)

    if (error)
      throw error
  }

  return customer.id
}

export async function recordStripeCheckoutSession(event: H3Event, userId: string, sessionId: string, customerId: string | null) {
  if (!isSupabaseEnabled(event))
    return

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("subscriptions")
    .update({
      stripe_checkout_session_id: sessionId,
      stripe_customer_id: customerId,
    })
    .eq("user_id", userId)

  if (error)
    throw error
}

export async function syncStripeSubscription(event: H3Event, subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  if (!isSupabaseEnabled(event))
    return null

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const userId = subscription.metadata.cofoundryUserId || fallbackUserId
  if (!userId)
    return null

  const item = getFirstSubscriptionItem(subscription)
  const priceId = item?.price.id || null
  const plan = resolveStripePlanFromPriceId(event, priceId)
  const currentPeriodEnd = getPeriodEnd(item)
  const customerId = getStripeId(subscription.customer)

  const { data, error } = await adminClient
    .from("subscriptions")
    .upsert({
      id: `subscription_${userId}`,
      user_id: userId,
      plan,
      status: toSubscriptionStatus(subscription.status),
      billing_cycle: item?.price.recurring?.interval === "year" ? "annual" : "monthly",
      renews_at: subscription.cancel_at_period_end ? currentPeriodEnd : currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_current_period_end: currentPeriodEnd,
      stripe_status: subscription.status,
      ...planCapabilities(plan),
    }, { onConflict: "user_id" })
    .select()
    .single()

  if (error)
    throw error

  return data
}
