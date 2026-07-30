-- Replace the member-owned workspace document in one database transaction.
-- The RPC is callable only by the server's service role; browser roles retain
-- no direct public-schema access.

create or replace function public.cofoundry_replace_member_workspace(
  p_bookmarks jsonb,
  p_opportunities jsonb,
  p_profile_state jsonb,
  p_saved_searches jsonb,
  p_subscription jsonb,
  p_user jsonb,
  p_replace_subscription boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_user_id text := trim(p_user ->> 'id');
begin
  if workspace_user_id is null or workspace_user_id = '' then
    raise exception 'A workspace user id is required.';
  end if;

  if p_profile_state ->> 'user_id' is distinct from workspace_user_id
    or p_subscription ->> 'user_id' is distinct from workspace_user_id then
    raise exception 'Workspace records must belong to the same user.';
  end if;

  if jsonb_typeof(coalesce(p_bookmarks, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_saved_searches, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_opportunities, '[]'::jsonb)) <> 'array' then
    raise exception 'Workspace collections must be JSON arrays.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cofoundry:member-workspace:' || workspace_user_id, 0)
  );

  insert into public.users as existing_user (
    id,
    email,
    role,
    created_at,
    linked_providers,
    verified_email,
    onboarding_completed,
    email_digest_enabled,
    workflow_email_enabled,
    suspended_at
  )
  select
    row_data.id,
    row_data.email,
    case when row_data.role in ('founder', 'collaborator') then row_data.role else 'founder' end,
    row_data.created_at,
    row_data.linked_providers,
    row_data.verified_email,
    row_data.onboarding_completed,
    row_data.email_digest_enabled,
    row_data.workflow_email_enabled,
    row_data.suspended_at
  from jsonb_to_record(p_user) as row_data(
    id text,
    email text,
    role text,
    created_at timestamptz,
    linked_providers text[],
    verified_email boolean,
    onboarding_completed boolean,
    email_digest_enabled boolean,
    workflow_email_enabled boolean,
    suspended_at timestamptz
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case
      when existing_user.role in ('admin', 'investor_admin') then existing_user.role
      when excluded.role in ('founder', 'collaborator') then excluded.role
      else existing_user.role
    end,
    linked_providers = excluded.linked_providers,
    verified_email = existing_user.verified_email or excluded.verified_email,
    onboarding_completed = existing_user.onboarding_completed or excluded.onboarding_completed,
    email_digest_enabled = excluded.email_digest_enabled,
    workflow_email_enabled = excluded.workflow_email_enabled,
    suspended_at = existing_user.suspended_at;

  insert into public.member_profile_state (user_id, profile, updated_at)
  select row_data.user_id, row_data.profile, row_data.updated_at
  from jsonb_to_record(p_profile_state) as row_data(
    user_id text,
    profile jsonb,
    updated_at timestamptz
  )
  on conflict (user_id) do update set
    profile = excluded.profile,
    updated_at = excluded.updated_at;

  insert into public.subscriptions as existing_subscription (
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
    stripe_checkout_session_id,
    stripe_current_period_end,
    stripe_status
  )
  select
    row_data.id,
    row_data.user_id,
    case when p_replace_subscription then row_data.plan else 'free' end,
    case when p_replace_subscription then row_data.status else 'active' end,
    case when p_replace_subscription then row_data.billing_cycle else 'monthly' end,
    case when p_replace_subscription then row_data.renews_at else null end,
    case when p_replace_subscription then row_data.cancel_at_period_end else false end,
    case when p_replace_subscription then row_data.visibility_boost else false end,
    case when p_replace_subscription then row_data.unlimited_messaging else false end,
    case when p_replace_subscription then row_data.proposal_workflow else false end,
    case when p_replace_subscription then row_data.contract_builder else false end,
    case when p_replace_subscription then row_data.stripe_customer_id else null end,
    case when p_replace_subscription then row_data.stripe_subscription_id else null end,
    case when p_replace_subscription then row_data.stripe_price_id else null end,
    case when p_replace_subscription then row_data.stripe_checkout_session_id else null end,
    case when p_replace_subscription then row_data.stripe_current_period_end else null end,
    case when p_replace_subscription then row_data.stripe_status else null end
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
    stripe_checkout_session_id text,
    stripe_current_period_end timestamptz,
    stripe_status text
  )
  on conflict (user_id) do update set
    id = case when p_replace_subscription then excluded.id else existing_subscription.id end,
    plan = case when p_replace_subscription then excluded.plan else existing_subscription.plan end,
    status = case when p_replace_subscription then excluded.status else existing_subscription.status end,
    billing_cycle = case when p_replace_subscription then excluded.billing_cycle else existing_subscription.billing_cycle end,
    renews_at = case when p_replace_subscription then excluded.renews_at else existing_subscription.renews_at end,
    cancel_at_period_end = case when p_replace_subscription then excluded.cancel_at_period_end else existing_subscription.cancel_at_period_end end,
    visibility_boost = case when p_replace_subscription then excluded.visibility_boost else existing_subscription.visibility_boost end,
    unlimited_messaging = case when p_replace_subscription then excluded.unlimited_messaging else existing_subscription.unlimited_messaging end,
    proposal_workflow = case when p_replace_subscription then excluded.proposal_workflow else existing_subscription.proposal_workflow end,
    contract_builder = case when p_replace_subscription then excluded.contract_builder else existing_subscription.contract_builder end,
    stripe_customer_id = case when p_replace_subscription then excluded.stripe_customer_id else existing_subscription.stripe_customer_id end,
    stripe_subscription_id = case when p_replace_subscription then excluded.stripe_subscription_id else existing_subscription.stripe_subscription_id end,
    stripe_price_id = case when p_replace_subscription then excluded.stripe_price_id else existing_subscription.stripe_price_id end,
    stripe_checkout_session_id = case when p_replace_subscription then excluded.stripe_checkout_session_id else existing_subscription.stripe_checkout_session_id end,
    stripe_current_period_end = case when p_replace_subscription then excluded.stripe_current_period_end else existing_subscription.stripe_current_period_end end,
    stripe_status = case when p_replace_subscription then excluded.stripe_status else existing_subscription.stripe_status end;

  delete from public.bookmarks where user_id = workspace_user_id;
  insert into public.bookmarks (id, user_id, target_type, target_id, created_at)
  select
    row_data.id,
    workspace_user_id,
    row_data.target_type,
    row_data.target_id,
    row_data.created_at
  from jsonb_to_recordset(coalesce(p_bookmarks, '[]'::jsonb)) as row_data(
    id text,
    target_type text,
    target_id text,
    created_at timestamptz
  );

  delete from public.saved_searches where user_id = workspace_user_id;
  insert into public.saved_searches (id, user_id, label, scope, filters, created_at)
  select
    row_data.id,
    workspace_user_id,
    row_data.label,
    row_data.scope,
    row_data.filters,
    row_data.created_at
  from jsonb_to_recordset(coalesce(p_saved_searches, '[]'::jsonb)) as row_data(
    id text,
    label text,
    scope text,
    filters jsonb,
    created_at timestamptz
  );

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_opportunities, '[]'::jsonb)) as incoming
    join public.startup_opportunities as existing
      on existing.id = incoming ->> 'id'
    where existing.owner_user_id <> workspace_user_id
  ) then
    raise exception 'Opportunity ids must remain owned by the same member.';
  end if;

  delete from public.startup_opportunities as existing
  where existing.owner_user_id = workspace_user_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_opportunities, '[]'::jsonb)) as incoming
      where incoming ->> 'id' = existing.id
    );

  insert into public.startup_opportunities as existing_opportunity (
    id,
    owner_user_id,
    startup_name,
    slug,
    one_line_pitch,
    problem,
    target_users,
    stage,
    traction,
    roles_needed,
    expected_commitment,
    compensation_structure,
    equity_range,
    industries,
    location,
    remote_preference,
    official_website,
    verification_method,
    verification_status,
    risk_flags,
    created_at,
    updated_at,
    is_open
  )
  select
    row_data.id,
    workspace_user_id,
    row_data.startup_name,
    row_data.slug,
    row_data.one_line_pitch,
    row_data.problem,
    row_data.target_users,
    row_data.stage,
    row_data.traction,
    row_data.roles_needed,
    row_data.expected_commitment,
    row_data.compensation_structure,
    row_data.equity_range,
    row_data.industries,
    row_data.location,
    row_data.remote_preference,
    row_data.official_website,
    row_data.verification_method,
    row_data.verification_status,
    row_data.risk_flags,
    row_data.created_at,
    row_data.updated_at,
    row_data.is_open
  from jsonb_to_recordset(coalesce(p_opportunities, '[]'::jsonb)) as row_data(
    id text,
    startup_name text,
    slug text,
    one_line_pitch text,
    problem text,
    target_users text,
    stage text,
    traction text,
    roles_needed text[],
    expected_commitment text,
    compensation_structure text,
    equity_range text,
    industries text[],
    location text,
    remote_preference text,
    official_website text,
    verification_method text,
    verification_status text,
    risk_flags jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    is_open boolean
  )
  on conflict (id) do update set
    startup_name = excluded.startup_name,
    slug = excluded.slug,
    one_line_pitch = excluded.one_line_pitch,
    problem = excluded.problem,
    target_users = excluded.target_users,
    stage = excluded.stage,
    traction = excluded.traction,
    roles_needed = excluded.roles_needed,
    expected_commitment = excluded.expected_commitment,
    compensation_structure = excluded.compensation_structure,
    equity_range = excluded.equity_range,
    industries = excluded.industries,
    location = excluded.location,
    remote_preference = excluded.remote_preference,
    official_website = excluded.official_website,
    verification_method = excluded.verification_method,
    verification_status = case
      when existing_opportunity.startup_name is distinct from excluded.startup_name
        or existing_opportunity.one_line_pitch is distinct from excluded.one_line_pitch
        or existing_opportunity.problem is distinct from excluded.problem
        or existing_opportunity.target_users is distinct from excluded.target_users
        or existing_opportunity.stage is distinct from excluded.stage
        or existing_opportunity.traction is distinct from excluded.traction
        or existing_opportunity.roles_needed is distinct from excluded.roles_needed
        or existing_opportunity.expected_commitment is distinct from excluded.expected_commitment
        or existing_opportunity.compensation_structure is distinct from excluded.compensation_structure
        or existing_opportunity.equity_range is distinct from excluded.equity_range
        or existing_opportunity.industries is distinct from excluded.industries
        or existing_opportunity.location is distinct from excluded.location
        or existing_opportunity.remote_preference is distinct from excluded.remote_preference
        or existing_opportunity.official_website is distinct from excluded.official_website
        or existing_opportunity.verification_method is distinct from excluded.verification_method
      then excluded.verification_status
      else existing_opportunity.verification_status
    end,
    risk_flags = excluded.risk_flags,
    created_at = existing_opportunity.created_at,
    updated_at = case
      when existing_opportunity.startup_name is distinct from excluded.startup_name
        or existing_opportunity.one_line_pitch is distinct from excluded.one_line_pitch
        or existing_opportunity.problem is distinct from excluded.problem
        or existing_opportunity.target_users is distinct from excluded.target_users
        or existing_opportunity.stage is distinct from excluded.stage
        or existing_opportunity.traction is distinct from excluded.traction
        or existing_opportunity.roles_needed is distinct from excluded.roles_needed
        or existing_opportunity.expected_commitment is distinct from excluded.expected_commitment
        or existing_opportunity.compensation_structure is distinct from excluded.compensation_structure
        or existing_opportunity.equity_range is distinct from excluded.equity_range
        or existing_opportunity.industries is distinct from excluded.industries
        or existing_opportunity.location is distinct from excluded.location
        or existing_opportunity.remote_preference is distinct from excluded.remote_preference
        or existing_opportunity.official_website is distinct from excluded.official_website
        or existing_opportunity.verification_method is distinct from excluded.verification_method
      then excluded.updated_at
      else existing_opportunity.updated_at
    end,
    is_open = excluded.is_open
  where existing_opportunity.owner_user_id = workspace_user_id;

  return jsonb_build_object(
    'userId', workspace_user_id,
    'bookmarkCount', jsonb_array_length(coalesce(p_bookmarks, '[]'::jsonb)),
    'savedSearchCount', jsonb_array_length(coalesce(p_saved_searches, '[]'::jsonb)),
    'opportunityCount', jsonb_array_length(coalesce(p_opportunities, '[]'::jsonb))
  );
end
$$;

revoke all on function public.cofoundry_replace_member_workspace(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.cofoundry_replace_member_workspace(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean)
to service_role;
