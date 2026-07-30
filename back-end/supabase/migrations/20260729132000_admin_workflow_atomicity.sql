-- Keep moderation, privacy, access, and manual file-scan decisions coupled to
-- their audit evidence. Each function locks the reviewed row and rejects a
-- stale browser revision before applying any state change.

create or replace function public.cofoundry_assert_full_admin(
  p_actor_user_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.users
  where id = p_actor_user_id
    and role = 'admin'
    and verified_email
    and suspended_at is null
  for update;

  if not found then
    raise exception 'An active full admin account is required for this action.';
  end if;
end
$$;

revoke all on function public.cofoundry_assert_full_admin(text)
  from public, anon, authenticated;

create or replace function public.cofoundry_apply_admin_report_action(
  p_action_id text,
  p_actor_user_id text,
  p_expected_status text,
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
  target_row public.reports%rowtype;
  action_type text;
begin
  perform public.cofoundry_assert_full_admin(p_actor_user_id);

  if length(trim(coalesce(p_action_id, ''))) = 0
    or length(trim(coalesce(p_notes, ''))) < 8 then
    raise exception 'A valid action id and audit note are required.';
  end if;

  select * into target_row
  from public.reports
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Target report was not found.';
  end if;

  if target_row.status is distinct from p_expected_status then
    raise exception 'The report changed after this review began. Refresh and review the current state.';
  end if;

  if p_status = 'reviewed' and target_row.status = 'open' then
    update public.reports
    set
      status = 'reviewed',
      review_notes = trim(p_notes),
      reviewed_at = p_timestamp,
      reviewed_by_user_id = p_actor_user_id
    where id = target_row.id;
    action_type := 'review_report';
  elsif p_status = 'resolved' and target_row.status in ('open', 'reviewed') then
    update public.reports
    set
      status = 'resolved',
      review_notes = coalesce(review_notes, trim(p_notes)),
      reviewed_at = coalesce(reviewed_at, p_timestamp),
      reviewed_by_user_id = coalesce(reviewed_by_user_id, p_actor_user_id),
      resolution_notes = trim(p_notes),
      resolved_at = p_timestamp,
      resolved_by_user_id = p_actor_user_id
    where id = target_row.id;
    action_type := 'resolve_report';
  else
    raise exception 'The requested report transition is invalid.';
  end if;

  insert into public.admin_actions (
    id, admin_user_id, type, target_id, target_type, notes, metadata, created_at
  )
  values (
    p_action_id,
    p_actor_user_id,
    action_type,
    target_row.id,
    'report',
    trim(p_notes),
    jsonb_build_object(
      'previousStatus', target_row.status,
      'nextStatus', p_status
    ),
    p_timestamp
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'reporterUserId', target_row.reporter_user_id,
    'status', p_status,
    'targetId', target_row.id
  );
end
$$;

revoke all on function public.cofoundry_apply_admin_report_action(
  text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.cofoundry_apply_admin_report_action(
  text, text, text, text, text, text, timestamptz
) to service_role;

create or replace function public.cofoundry_apply_admin_privacy_action(
  p_action_id text,
  p_actor_user_id text,
  p_completion_confirmed boolean,
  p_expected_status text,
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
  target_row public.privacy_requests%rowtype;
  action_type text;
begin
  perform public.cofoundry_assert_full_admin(p_actor_user_id);

  if length(trim(coalesce(p_action_id, ''))) = 0
    or length(trim(coalesce(p_notes, ''))) < 8 then
    raise exception 'A valid action id and audit note are required.';
  end if;

  if p_status = 'resolved' and p_completion_confirmed is not true then
    raise exception 'Confirm that the requested privacy action was actually completed before resolving it.';
  end if;

  select * into target_row
  from public.privacy_requests
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Privacy request was not found.';
  end if;

  if target_row.status is distinct from p_expected_status then
    raise exception 'The privacy request changed after this review began. Refresh and review the current state.';
  end if;

  if p_status = 'reviewed' and target_row.status = 'open' then
    update public.privacy_requests
    set
      status = 'reviewed',
      review_notes = trim(p_notes),
      reviewed_at = p_timestamp,
      reviewed_by_user_id = p_actor_user_id
    where id = target_row.id;
    action_type := 'review_privacy_request';
  elsif p_status = 'resolved' and target_row.status in ('open', 'reviewed') then
    update public.privacy_requests
    set
      status = 'resolved',
      review_notes = coalesce(review_notes, trim(p_notes)),
      reviewed_at = coalesce(reviewed_at, p_timestamp),
      reviewed_by_user_id = coalesce(reviewed_by_user_id, p_actor_user_id),
      resolution_notes = trim(p_notes),
      resolved_at = p_timestamp,
      resolved_by_user_id = p_actor_user_id
    where id = target_row.id;
    action_type := 'resolve_privacy_request';
  else
    raise exception 'The requested privacy-request transition is invalid.';
  end if;

  insert into public.admin_actions (
    id, admin_user_id, type, target_id, target_type, notes, metadata, created_at
  )
  values (
    p_action_id,
    p_actor_user_id,
    action_type,
    target_row.id,
    'privacy_request',
    trim(p_notes),
    jsonb_build_object(
      'completionConfirmed', p_status = 'resolved' and p_completion_confirmed,
      'previousStatus', target_row.status,
      'nextStatus', p_status
    ),
    p_timestamp
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'status', p_status,
    'targetId', target_row.id,
    'userId', target_row.user_id
  );
end
$$;

revoke all on function public.cofoundry_apply_admin_privacy_action(
  text, text, boolean, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.cofoundry_apply_admin_privacy_action(
  text, text, boolean, text, text, text, text, timestamptz
) to service_role;

create or replace function public.cofoundry_apply_admin_access_status(
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
  target_row public.access_requests%rowtype;
begin
  perform public.cofoundry_assert_full_admin(p_actor_user_id);

  if p_status not in ('open', 'approved', 'denied')
    or length(trim(coalesce(p_action_id, ''))) = 0
    or length(trim(coalesce(p_notes, ''))) < 8 then
    raise exception 'A valid access decision and audit note are required.';
  end if;

  select * into target_row
  from public.access_requests
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Access request was not found.';
  end if;

  if target_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'The access request changed after this review began. Refresh and review the current state.';
  end if;

  if target_row.invite_accepted_at is not null then
    raise exception 'An accepted access invite cannot be reopened or denied.';
  end if;

  update public.access_requests
  set
    admin_notes = trim(p_notes),
    invite_expires_at = null,
    invite_token_hash = null,
    invite_token_issued_at = null,
    reviewed_at = p_timestamp,
    reviewed_by_user_id = p_actor_user_id,
    status = p_status,
    updated_at = p_timestamp
  where id = target_row.id;

  insert into public.admin_actions (
    id, admin_user_id, type, target_id, target_type, notes, metadata, created_at
  )
  values (
    p_action_id,
    p_actor_user_id,
    'update_access_request',
    target_row.id,
    'access_request',
    trim(p_notes),
    jsonb_build_object(
      'previousStatus', target_row.status,
      'nextStatus', p_status
    ),
    p_timestamp
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'status', p_status,
    'targetId', target_row.id,
    'updatedAt', p_timestamp
  );
end
$$;

revoke all on function public.cofoundry_apply_admin_access_status(
  text, text, timestamptz, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.cofoundry_apply_admin_access_status(
  text, text, timestamptz, text, text, text, timestamptz
) to service_role;

create or replace function public.cofoundry_issue_admin_access_invite(
  p_action_id text,
  p_actor_user_id text,
  p_expected_updated_at timestamptz,
  p_expires_at timestamptz,
  p_invite_token_hash text,
  p_notes text,
  p_target_id text,
  p_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.access_requests%rowtype;
begin
  perform public.cofoundry_assert_full_admin(p_actor_user_id);

  if length(trim(coalesce(p_action_id, ''))) = 0
    or length(trim(coalesce(p_notes, ''))) < 8
    or length(coalesce(p_invite_token_hash, '')) < 40
    or p_expires_at <= p_timestamp
    or p_expires_at > p_timestamp + interval '31 days' then
    raise exception 'Valid invite evidence, expiry, and audit notes are required.';
  end if;

  select * into target_row
  from public.access_requests
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Access request was not found.';
  end if;

  if target_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'The access request changed after this review began. Refresh and review the current state.';
  end if;

  if target_row.invite_accepted_at is not null then
    raise exception 'An accepted access invite cannot be reissued.';
  end if;

  if target_row.status not in ('approved', 'invited') then
    raise exception 'Approve the access request before issuing an invite.';
  end if;

  update public.access_requests
  set
    admin_notes = trim(p_notes),
    invite_accepted_at = null,
    invite_expires_at = p_expires_at,
    invite_token_hash = p_invite_token_hash,
    invite_token_issued_at = p_timestamp,
    reviewed_at = p_timestamp,
    reviewed_by_user_id = p_actor_user_id,
    status = 'invited',
    updated_at = p_timestamp
  where id = target_row.id;

  insert into public.admin_actions (
    id, admin_user_id, type, target_id, target_type, notes, metadata, created_at
  )
  values (
    p_action_id,
    p_actor_user_id,
    'issue_access_invite',
    target_row.id,
    'access_request',
    trim(p_notes),
    jsonb_build_object(
      'previousStatus', target_row.status,
      'nextStatus', 'invited',
      'inviteExpiresAt', p_expires_at
    ),
    p_timestamp
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'status', 'invited',
    'targetId', target_row.id,
    'updatedAt', p_timestamp
  );
end
$$;

revoke all on function public.cofoundry_issue_admin_access_invite(
  text, text, timestamptz, timestamptz, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.cofoundry_issue_admin_access_invite(
  text, text, timestamptz, timestamptz, text, text, text, timestamptz
) to service_role;

create or replace function public.cofoundry_apply_admin_file_scan(
  p_action_id text,
  p_actor_user_id text,
  p_expected_updated_at timestamptz,
  p_notes text,
  p_scan_status text,
  p_target_id text,
  p_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.file_uploads%rowtype;
begin
  perform public.cofoundry_assert_full_admin(p_actor_user_id);

  if p_scan_status not in ('clean', 'flagged')
    or length(trim(coalesce(p_action_id, ''))) = 0
    or length(trim(coalesce(p_notes, ''))) < 8 then
    raise exception 'A valid manual scan verdict and audit note are required.';
  end if;

  select * into target_row
  from public.file_uploads
  where id = p_target_id
  for update;

  if not found then
    raise exception 'File upload was not found.';
  end if;

  if target_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'The file changed after this review began. Refresh and review the current state.';
  end if;

  if target_row.deleted_at is not null
    or target_row.status = 'deleted'
    or target_row.scan_status not in ('pending', 'failed', 'skipped') then
    raise exception 'This file is not eligible for a manual scan verdict.';
  end if;

  update public.file_uploads
  set
    scan_notes = trim(p_notes),
    scan_status = p_scan_status,
    status = case when p_scan_status = 'clean' then 'uploaded' else 'blocked' end,
    updated_at = p_timestamp
  where id = target_row.id;

  insert into public.admin_actions (
    id, admin_user_id, type, target_id, target_type, notes, metadata, created_at
  )
  values (
    p_action_id,
    p_actor_user_id,
    'record_file_scan',
    target_row.id,
    'file_upload',
    trim(p_notes),
    jsonb_build_object(
      'previousStatus', target_row.scan_status,
      'nextStatus', p_scan_status,
      'scanStatus', p_scan_status
    ),
    p_timestamp
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'scanStatus', p_scan_status,
    'targetId', target_row.id,
    'updatedAt', p_timestamp
  );
end
$$;

revoke all on function public.cofoundry_apply_admin_file_scan(
  text, text, timestamptz, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.cofoundry_apply_admin_file_scan(
  text, text, timestamptz, text, text, text, timestamptz
) to service_role;

create or replace function public.cofoundry_record_admin_queue_action(
  p_action_id text,
  p_actor_user_id text,
  p_action_type text,
  p_target_id text,
  p_target_type text,
  p_notes text,
  p_metadata jsonb,
  p_timestamp timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.cofoundry_assert_full_admin(p_actor_user_id);

  if p_action_id is null or pg_catalog.btrim(p_action_id) = ''
    or p_target_id is null or pg_catalog.btrim(p_target_id) = ''
    or p_notes is null or pg_catalog.length(pg_catalog.btrim(p_notes)) < 8 then
    raise exception 'A valid action id, target, and audit note are required.';
  end if;

  if p_action_type not in ('assign_case', 'escalate_case', 'review_evidence') then
    raise exception 'The requested queue action is invalid.';
  end if;

  if p_target_type not in (
    'access_request',
    'readiness_check',
    'file_upload',
    'user',
    'report',
    'privacy_request',
    'profile',
    'message',
    'opportunity'
  ) then
    raise exception 'The requested queue target type is invalid.';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Queue action metadata must be a JSON object.';
  end if;

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
    p_actor_user_id,
    p_action_type,
    p_target_id,
    p_target_type,
    pg_catalog.btrim(p_notes),
    coalesce(p_metadata, '{}'::jsonb),
    p_timestamp
  );

  return jsonb_build_object('actionId', p_action_id);
end
$$;

revoke all on function public.cofoundry_record_admin_queue_action(
  text, text, text, text, text, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.cofoundry_record_admin_queue_action(
  text, text, text, text, text, text, jsonb, timestamptz
) to service_role;
