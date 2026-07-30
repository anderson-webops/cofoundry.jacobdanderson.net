-- CoFoundry keeps all application data access behind the Nuxt server.
-- Supabase Auth remains client-accessible, but direct public-schema PostgREST
-- access is intentionally fail-closed for anon and authenticated roles.

drop table if exists public.demo_auth_accounts;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets
    set
      public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'text/plain'
      ]::text[]
    where id = 'cofoundry-private-files';
  end if;
end
$$;

do $$
declare
  table_row record;
  policy_row record;
begin
  for table_row in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_row.tablename);
    execute format('alter table public.%I force row level security', table_row.tablename);

    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_row.tablename
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_row.tablename);
    end loop;
  end loop;
end
$$;

revoke all on schema public from public, anon, authenticated;
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

create or replace function public.cofoundry_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = public.cofoundry_current_user_id()
      and role = 'admin'
      and verified_email
      and suspended_at is null
  )
$$;

revoke all on function public.cofoundry_is_admin() from public, anon, authenticated;
grant execute on function public.cofoundry_is_admin() to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_role_allowed'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_allowed
      check (role in ('founder', 'collaborator', 'admin', 'investor_admin'))
      not valid;
    alter table public.users validate constraint users_role_allowed;
  end if;
end
$$;

create or replace function public.cofoundry_apply_admin_security_action(
  p_action_id text,
  p_actor_user_id text,
  p_created_at timestamptz,
  p_new_role text,
  p_notes text,
  p_operation text,
  p_status_action text,
  p_target_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_row public.users%rowtype;
  target_row public.users%rowtype;
  active_full_admin_count integer;
  action_type text;
  action_metadata jsonb;
begin
  if p_action_id is null or length(trim(p_action_id)) = 0
    or p_notes is null or length(trim(p_notes)) < 8 then
    raise exception 'A valid action id and audit note are required.';
  end if;

  select * into actor_row
  from public.users
  where id = p_actor_user_id
  for update;

  if not found or actor_row.suspended_at is not null
    or not actor_row.verified_email
    or actor_row.role <> 'admin' then
    raise exception 'An active full admin account is required for this action.';
  end if;

  select * into target_row
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Target user was not found.';
  end if;

  if actor_row.id = target_row.id then
    raise exception 'Administrators cannot change their own role, status, or verification state.';
  end if;

  perform 1
  from public.users
  where role = 'admin' and suspended_at is null and verified_email
  for update;

  select count(*) into active_full_admin_count
  from public.users
  where role = 'admin' and suspended_at is null and verified_email;

  if p_operation = 'change_role' then
    if p_new_role not in ('founder', 'collaborator', 'admin', 'investor_admin') then
      raise exception 'The requested role is invalid.';
    end if;
    if p_new_role = target_row.role then
      raise exception 'Choose a different role before recording a role change.';
    end if;
    if target_row.suspended_at is not null and p_new_role in ('admin', 'investor_admin') then
      raise exception 'Reinstate the account before granting a privileged role.';
    end if;
    if not target_row.verified_email and p_new_role in ('admin', 'investor_admin') then
      raise exception 'Verify the account email before granting a privileged role.';
    end if;
    if target_row.role = 'admin' and p_new_role <> 'admin'
      and target_row.suspended_at is null and target_row.verified_email
      and active_full_admin_count <= 1 then
      raise exception 'The last active full admin cannot be demoted.';
    end if;

    update public.users set role = p_new_role where id = target_row.id;
    action_type := 'change_user_role';
    action_metadata := jsonb_build_object(
      'previousRole', target_row.role,
      'nextRole', p_new_role
    );
  elsif p_operation = 'change_status' then
    if p_status_action = 'suspend' then
      if target_row.suspended_at is not null then
        raise exception 'This account is already suspended.';
      end if;
      if target_row.role = 'admin' and target_row.verified_email
        and active_full_admin_count <= 1 then
        raise exception 'The last active full admin cannot be suspended.';
      end if;

      update public.users set suspended_at = p_created_at where id = target_row.id;
      action_type := 'suspend_user';
      action_metadata := jsonb_build_object(
        'previousSuspendedAt', target_row.suspended_at,
        'nextSuspendedAt', p_created_at
      );
    elsif p_status_action = 'reinstate' then
      if target_row.suspended_at is null then
        raise exception 'This account is not suspended.';
      end if;
      if not target_row.verified_email and target_row.role in ('admin', 'investor_admin') then
        raise exception 'Verify the account email before reinstating a privileged role.';
      end if;

      update public.users set suspended_at = null where id = target_row.id;
      action_type := 'reinstate_user';
      action_metadata := jsonb_build_object(
        'previousSuspendedAt', target_row.suspended_at,
        'nextSuspendedAt', null
      );
    else
      raise exception 'The requested status action is invalid.';
    end if;
  elsif p_operation = 'verify_email' then
    if target_row.verified_email then
      raise exception 'This email address is already verified.';
    end if;

    update public.users set verified_email = true where id = target_row.id;
    action_type := 'verify_email';
    action_metadata := jsonb_build_object(
      'previousVerifiedEmail', target_row.verified_email,
      'nextVerifiedEmail', true
    );
  else
    raise exception 'The requested admin security operation is invalid.';
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
    actor_row.id,
    action_type,
    target_row.id,
    'user',
    trim(p_notes),
    action_metadata,
    p_created_at
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'targetUserId', target_row.id,
    'operation', p_operation
  );
end
$$;

revoke all on function public.cofoundry_apply_admin_security_action(text, text, timestamptz, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.cofoundry_apply_admin_security_action(text, text, timestamptz, text, text, text, text, text) to service_role;

create or replace function public.cofoundry_bootstrap_first_admin(
  p_action_id text,
  p_created_at timestamptz,
  p_notes text,
  p_target_user_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.users%rowtype;
begin
  if p_action_id is null
    or p_action_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_created_at is null
    or p_notes is null
    or pg_catalog.length(pg_catalog.btrim(p_notes)) < 8
    or pg_catalog.length(pg_catalog.btrim(p_notes)) > 1000
    or p_target_user_id is null
    or pg_catalog.length(pg_catalog.btrim(p_target_user_id)) < 1
    or pg_catalog.length(pg_catalog.btrim(p_target_user_id)) > 160 then
    raise exception 'A valid bootstrap action id, timestamp, target, and audit note are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cofoundry:first-admin-bootstrap', 0)
  );

  perform 1
  from public.users
  where role = 'admin' and suspended_at is null and verified_email
  for update;

  if exists (
    select 1
    from public.users
    where role = 'admin' and suspended_at is null and verified_email
  ) then
    raise exception 'A full admin already exists; use the authenticated admin role workflow.';
  end if;

  select * into target_row
  from public.users
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Target user was not found.';
  end if;

  if not target_row.verified_email then
    raise exception 'The first full admin account must have a verified email address.';
  end if;

  update public.users
  set role = 'admin', suspended_at = null
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
    target_row.id,
    'change_user_role',
    target_row.id,
    'user',
    trim(p_notes),
    jsonb_build_object(
      'bootstrap', true,
      'previousRole', target_row.role,
      'nextRole', 'admin',
      'previousSuspendedAt', target_row.suspended_at,
      'nextSuspendedAt', null
    ),
    p_created_at
  );

  return jsonb_build_object(
    'actionId', p_action_id,
    'targetUserId', target_row.id,
    'role', 'admin'
  );
end
$$;

revoke all on function public.cofoundry_bootstrap_first_admin(text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.cofoundry_bootstrap_first_admin(text, timestamptz, text, text) to service_role;
