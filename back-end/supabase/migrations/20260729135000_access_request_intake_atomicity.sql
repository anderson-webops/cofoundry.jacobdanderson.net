-- Serialize access-request intake by normalized email so simultaneous public
-- submissions cannot create duplicate active reviews or race stale reads.

create or replace function public.cofoundry_create_access_request(
  p_id text,
  p_email text,
  p_name text,
  p_company text,
  p_company_stage text,
  p_role text,
  p_source text,
  p_timeline text,
  p_use_case text,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  request_row public.access_requests%rowtype;
begin
  if p_id is null or p_id !~ '^access_[a-z0-9]{32}$' then
    raise exception 'The access request identifier is invalid.';
  end if;

  if normalized_email = ''
    or pg_catalog.length(normalized_email) > 254
    or pg_catalog.position('@' in normalized_email) <= 1 then
    raise exception 'The access request email is invalid.';
  end if;

  if p_created_at is null
    or pg_catalog.length(pg_catalog.btrim(p_name)) < 2
    or pg_catalog.length(pg_catalog.btrim(p_name)) > 100
    or pg_catalog.length(pg_catalog.btrim(p_company)) > 120
    or pg_catalog.length(pg_catalog.btrim(p_source)) > 100
    or pg_catalog.length(pg_catalog.btrim(p_use_case)) < 20
    or pg_catalog.length(pg_catalog.btrim(p_use_case)) > 4000 then
    raise exception 'The access request payload is invalid.';
  end if;

  if p_company_stage not in ('idea', 'prototype', 'mvp', 'revenue', 'growth', 'not_sure')
    or p_role not in ('founder', 'collaborator', 'studio', 'investor', 'other')
    or p_timeline not in ('now', '30_days', '90_days', 'exploring') then
    raise exception 'The access request classification is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cofoundry:access-request:' || normalized_email, 0)
  );

  select *
  into request_row
  from public.access_requests
  where pg_catalog.lower(pg_catalog.btrim(email)) = normalized_email
    and status <> 'denied'
    and invite_accepted_at is null
  order by created_at desc
  limit 1
  for update;

  if found then
    return pg_catalog.jsonb_build_object(
      'created', false,
      'request', pg_catalog.to_jsonb(request_row)
    );
  end if;

  insert into public.access_requests (
    id,
    email,
    name,
    company,
    company_stage,
    role,
    source,
    timeline,
    use_case,
    status,
    created_at,
    updated_at
  )
  values (
    p_id,
    normalized_email,
    pg_catalog.btrim(p_name),
    pg_catalog.btrim(p_company),
    p_company_stage,
    p_role,
    coalesce(nullif(pg_catalog.btrim(p_source), ''), 'site'),
    p_timeline,
    pg_catalog.btrim(p_use_case),
    'open',
    p_created_at,
    p_created_at
  )
  returning * into request_row;

  return pg_catalog.jsonb_build_object(
    'created', true,
    'request', pg_catalog.to_jsonb(request_row)
  );
end
$$;

revoke all on function public.cofoundry_create_access_request(
  text, text, text, text, text, text, text, text, text, timestamptz
)
from public, anon, authenticated;
grant execute on function public.cofoundry_create_access_request(
  text, text, text, text, text, text, text, text, text, timestamptz
)
to service_role;
