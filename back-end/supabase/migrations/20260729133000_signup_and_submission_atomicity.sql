-- Signup invites and investment submissions cross authorization boundaries.
-- Keep the authoritative checks and writes in one service-role-only transaction
-- so a concurrent revocation, opportunity closure, or duplicate request cannot
-- race a stale application-server read.

create or replace function public.cofoundry_accept_access_invite_and_replace_member_workspace(
  p_invite_token_hash text,
  p_invite_email text,
  p_accepted_at timestamptz,
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
  invite_row public.access_requests%rowtype;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_invite_email));
  workspace_result jsonb;
begin
  if p_invite_token_hash is null or pg_catalog.length(p_invite_token_hash) <> 43 then
    raise exception 'The access invite is invalid or no longer available.';
  end if;

  if normalized_email = '' or pg_catalog.lower(pg_catalog.btrim(p_user ->> 'email')) is distinct from normalized_email then
    raise exception 'The access invite is invalid or no longer available.';
  end if;

  select *
  into invite_row
  from public.access_requests
  where invite_token_hash = p_invite_token_hash
  for update;

  if not found
    or invite_row.status <> 'invited'
    or invite_row.invite_accepted_at is not null
    or invite_row.invite_expires_at is null
    or invite_row.invite_expires_at < p_accepted_at
    or pg_catalog.lower(pg_catalog.btrim(invite_row.email)) <> normalized_email then
    raise exception 'The access invite is invalid or no longer available.';
  end if;

  workspace_result := public.cofoundry_replace_member_workspace(
    p_bookmarks => p_bookmarks,
    p_opportunities => p_opportunities,
    p_profile_state => p_profile_state,
    p_saved_searches => p_saved_searches,
    p_subscription => p_subscription,
    p_user => p_user,
    p_replace_subscription => p_replace_subscription
  );

  update public.access_requests
  set
    invite_accepted_at = p_accepted_at,
    invite_expires_at = null,
    invite_token_hash = null,
    updated_at = p_accepted_at
  where id = invite_row.id;

  return jsonb_build_object(
    'accessRequestId', invite_row.id,
    'workspace', workspace_result
  );
end
$$;

revoke all on function public.cofoundry_accept_access_invite_and_replace_member_workspace(
  text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean
)
from public, anon, authenticated;
grant execute on function public.cofoundry_accept_access_invite_and_replace_member_workspace(
  text, text, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, boolean
)
to service_role;

create unique index if not exists investment_applications_one_active_per_opportunity_idx
  on public.investment_applications (applicant_user_id, opportunity_id)
  where status <> 'declined';

create or replace function public.cofoundry_submit_investment_application(
  p_id text,
  p_opportunity_id text,
  p_applicant_user_id text,
  p_raise_amount text,
  p_traction text,
  p_deck_link text,
  p_team_summary text,
  p_reason text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  opportunity_row public.startup_opportunities%rowtype;
  application_row public.investment_applications%rowtype;
begin
  select *
  into opportunity_row
  from public.startup_opportunities
  where id = p_opportunity_id
  for update;

  if not found
    or opportunity_row.owner_user_id <> p_applicant_user_id then
    raise exception 'Choose one of your own startup opportunities.';
  end if;

  if not opportunity_row.is_open then
    raise exception 'Investment applications require an open opportunity.';
  end if;

  if exists (
    select 1
    from public.investment_applications
    where applicant_user_id = p_applicant_user_id
      and opportunity_id = p_opportunity_id
      and status <> 'declined'
  ) then
    raise exception 'An active investment application already exists for this opportunity.';
  end if;

  insert into public.investment_applications (
    id,
    opportunity_id,
    applicant_user_id,
    status,
    raise_amount,
    traction,
    deck_link,
    team_summary,
    reason,
    created_at
  )
  values (
    p_id,
    p_opportunity_id,
    p_applicant_user_id,
    'submitted',
    p_raise_amount,
    p_traction,
    p_deck_link,
    p_team_summary,
    p_reason,
    p_created_at
  )
  returning * into application_row;

  return pg_catalog.to_jsonb(application_row);
end
$$;

revoke all on function public.cofoundry_submit_investment_application(
  text, text, text, text, text, text, text, text, timestamptz
)
from public, anon, authenticated;
grant execute on function public.cofoundry_submit_investment_application(
  text, text, text, text, text, text, text, text, timestamptz
)
to service_role;
