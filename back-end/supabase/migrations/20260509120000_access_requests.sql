create table if not exists public.access_requests (
  id text primary key,
  name text not null,
  email text not null,
  company text not null default '',
  role text not null check (role in ('founder', 'collaborator', 'studio', 'investor', 'other')),
  company_stage text not null check (company_stage in ('idea', 'prototype', 'mvp', 'revenue', 'growth', 'not_sure')),
  timeline text not null check (timeline in ('now', '30_days', '90_days', 'exploring')),
  use_case text not null,
  source text not null default 'site',
  status text not null default 'open' check (status in ('open', 'approved', 'denied', 'invited')),
  admin_notes text,
  reviewed_at timestamptz,
  reviewed_by_user_id text references public.users(id) on delete set null,
  invite_token_hash text unique,
  invite_token_issued_at timestamptz,
  invite_expires_at timestamptz,
  invite_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists access_requests_status_created_idx on public.access_requests (status, created_at desc);
create index if not exists access_requests_email_status_idx on public.access_requests (email, status);
create index if not exists access_requests_invite_hash_idx on public.access_requests (invite_token_hash);

alter table if exists public.access_requests enable row level security;

drop policy if exists access_requests_admin_select on public.access_requests;
create policy access_requests_admin_select on public.access_requests
  for select to authenticated
  using (public.cofoundry_is_admin());

drop policy if exists access_requests_admin_insert on public.access_requests;
create policy access_requests_admin_insert on public.access_requests
  for insert to authenticated
  with check (public.cofoundry_is_admin());

drop policy if exists access_requests_admin_update on public.access_requests;
create policy access_requests_admin_update on public.access_requests
  for update to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());
