-- Stripe can retry and deliver webhook events out of order. Persist the last
-- applied event on each subscription and reconcile under a row lock.

alter table public.subscriptions
  add column if not exists stripe_last_event_created_at timestamptz,
  add column if not exists stripe_last_event_id text;

create unique index if not exists subscriptions_stripe_customer_unique_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists subscriptions_stripe_subscription_unique_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists subscriptions_stripe_checkout_session_unique_idx
  on public.subscriptions (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create or replace function public.cofoundry_record_stripe_checkout_session(
  p_user_id text,
  p_session_id text,
  p_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.subscriptions%rowtype;
  normalized_customer_id text := nullif(trim(p_customer_id), '');
  normalized_session_id text := nullif(trim(p_session_id), '');
  normalized_user_id text := nullif(trim(p_user_id), '');
begin
  if normalized_user_id is null or normalized_session_id is null then
    raise exception 'A CoFoundry user id and Stripe checkout session id are required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('cofoundry:stripe-user:' || normalized_user_id, 0));

  select * into current_row
  from public.subscriptions
  where user_id = normalized_user_id
  for update;

  if not found then
    raise exception 'The Stripe checkout owner does not have a subscription row.';
  end if;

  if current_row.stripe_customer_id is not null
    and normalized_customer_id is not null
    and current_row.stripe_customer_id <> normalized_customer_id then
    raise exception 'Stripe customer identity does not match the existing subscription owner.';
  end if;

  if exists (
    select 1
    from public.subscriptions
    where stripe_checkout_session_id = normalized_session_id
      and user_id <> normalized_user_id
  ) then
    raise exception 'Stripe checkout session is already bound to another account.';
  end if;

  if normalized_customer_id is not null and exists (
    select 1
    from public.subscriptions
    where stripe_customer_id = normalized_customer_id
      and user_id <> normalized_user_id
  ) then
    raise exception 'Stripe customer is already bound to another account.';
  end if;

  update public.subscriptions
  set
    stripe_checkout_session_id = normalized_session_id,
    stripe_customer_id = coalesce(current_row.stripe_customer_id, normalized_customer_id)
  where user_id = normalized_user_id;

  return jsonb_build_object(
    'customerId', coalesce(current_row.stripe_customer_id, normalized_customer_id),
    'sessionId', normalized_session_id,
    'userId', normalized_user_id
  );
end
$$;

revoke all on function public.cofoundry_record_stripe_checkout_session(text, text, text)
from public, anon, authenticated;
grant execute on function public.cofoundry_record_stripe_checkout_session(text, text, text)
to service_role;

create or replace function public.cofoundry_apply_stripe_subscription_event(
  p_event_created_at timestamptz,
  p_event_id text,
  p_subscription jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  incoming_user_id text := trim(p_subscription ->> 'user_id');
  incoming_customer_id text := nullif(trim(p_subscription ->> 'stripe_customer_id'), '');
  current_row public.subscriptions%rowtype;
begin
  if p_event_id is null or trim(p_event_id) = '' or p_event_created_at is null then
    raise exception 'Stripe event identity and creation time are required.';
  end if;

  if incoming_user_id is null or incoming_user_id = '' then
    raise exception 'A CoFoundry user id is required for Stripe reconciliation.';
  end if;

  select * into current_row
  from public.subscriptions
  where user_id = incoming_user_id
  for update;

  if found and current_row.stripe_last_event_id = p_event_id then
    return jsonb_build_object('applied', false, 'reason', 'duplicate', 'userId', incoming_user_id);
  end if;

  if found
    and current_row.stripe_last_event_created_at is not null
    and current_row.stripe_last_event_created_at > p_event_created_at then
    return jsonb_build_object('applied', false, 'reason', 'stale', 'userId', incoming_user_id);
  end if;

  if found
    and current_row.stripe_customer_id is not null
    and incoming_customer_id is not null
    and current_row.stripe_customer_id <> incoming_customer_id then
    raise exception 'Stripe customer identity does not match the existing subscription owner.';
  end if;

  insert into public.subscriptions (
    id,
    user_id,
    plan,
    status,
    billing_cycle,
    renews_at,
    cancel_at_period_end,
    visibility_boost,
    unlimited_messaging,
    proposal_workflow,
    contract_builder,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    stripe_current_period_end,
    stripe_status,
    stripe_last_event_created_at,
    stripe_last_event_id
  )
  select
    row_data.id,
    row_data.user_id,
    row_data.plan,
    row_data.status,
    row_data.billing_cycle,
    row_data.renews_at,
    row_data.cancel_at_period_end,
    row_data.visibility_boost,
    row_data.unlimited_messaging,
    row_data.proposal_workflow,
    row_data.contract_builder,
    row_data.stripe_customer_id,
    row_data.stripe_subscription_id,
    row_data.stripe_price_id,
    row_data.stripe_current_period_end,
    row_data.stripe_status,
    p_event_created_at,
    p_event_id
  from jsonb_to_record(p_subscription) as row_data(
    id text,
    user_id text,
    plan text,
    status text,
    billing_cycle text,
    renews_at timestamptz,
    cancel_at_period_end boolean,
    visibility_boost boolean,
    unlimited_messaging boolean,
    proposal_workflow boolean,
    contract_builder boolean,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    stripe_current_period_end timestamptz,
    stripe_status text
  )
  on conflict (user_id) do update set
    id = excluded.id,
    plan = excluded.plan,
    status = excluded.status,
    billing_cycle = excluded.billing_cycle,
    renews_at = excluded.renews_at,
    cancel_at_period_end = excluded.cancel_at_period_end,
    visibility_boost = excluded.visibility_boost,
    unlimited_messaging = excluded.unlimited_messaging,
    proposal_workflow = excluded.proposal_workflow,
    contract_builder = excluded.contract_builder,
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    stripe_current_period_end = excluded.stripe_current_period_end,
    stripe_status = excluded.stripe_status,
    stripe_last_event_created_at = excluded.stripe_last_event_created_at,
    stripe_last_event_id = excluded.stripe_last_event_id;

  return jsonb_build_object('applied', true, 'reason', 'updated', 'userId', incoming_user_id);
end
$$;

revoke all on function public.cofoundry_apply_stripe_subscription_event(timestamptz, text, jsonb)
from public, anon, authenticated;
grant execute on function public.cofoundry_apply_stripe_subscription_event(timestamptz, text, jsonb)
to service_role;
