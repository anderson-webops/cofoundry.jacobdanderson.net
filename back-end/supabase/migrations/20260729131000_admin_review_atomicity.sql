-- Opportunity trust decisions must be tied to the exact listing revision that
-- an administrator reviewed, and the decision plus audit row must commit as one
-- transaction.

create or replace function public.cofoundry_review_opportunity(
  p_action_id text,
  p_actor_user_id text,
  p_expected_updated_at timestamptz,
  p_notes text,
  p_status text,
  p_target_id text,
  p_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_row public.users%rowtype;
  target_row public.startup_opportunities%rowtype;
begin
  if p_action_id is null or length(trim(p_action_id)) = 0
    or p_notes is null or length(trim(p_notes)) < 8
    or p_expected_updated_at is null
    or p_timestamp is null then
    raise exception 'A valid action id, review revision, timestamp, and audit note are required.';
  end if;

  if p_status not in ('unverified', 'owner_verified', 'domain_verified') then
    raise exception 'The requested opportunity verification status is invalid.';
  end if;

  select * into actor_row
  from public.users
  where id = p_actor_user_id
  for update;

  if not found or actor_row.suspended_at is not null
    or not actor_row.verified_email
    or actor_row.role not in ('admin', 'investor_admin') then
    raise exception 'An active admin account is required for this action.';
  end if;

  select * into target_row
  from public.startup_opportunities
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Target opportunity was not found.';
  end if;

  if target_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'The opportunity changed after this review began. Refresh and review the current revision.';
  end if;

  if target_row.verification_status = p_status then
    raise exception 'Choose a different verification status before recording a review.';
  end if;

  update public.startup_opportunities
  set
    updated_at = p_timestamp,
    verification_status = p_status
  where id = target_row.id;

  insert into public.admin_actions (
    id,
    admin_user_id,
    type,
    target_id,
    target_type,
    notes,
    metadata,
    created_at
  )
  values (
    p_action_id,
    actor_row.id,
    'review_evidence',
    target_row.id,
    'opportunity',
    trim(p_notes),
    jsonb_build_object(
      'previousVerificationStatus', target_row.verification_status,
      'verificationStatus', p_status,
      'reviewedRevision', p_expected_updated_at
    ),
    p_timestamp
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'ownerUserId', target_row.owner_user_id,
    'targetId', target_row.id,
    'verificationStatus', p_status
  );
end
$$;

revoke all on function public.cofoundry_review_opportunity(text, text, timestamptz, text, text, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.cofoundry_review_opportunity(text, text, timestamptz, text, text, text, timestamptz)
to service_role;
