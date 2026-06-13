create table if not exists public.email_suppressions (
  id text primary key,
  email text not null,
  category text not null default 'all' check (category in ('all', 'digest', 'workflow')),
  reason text not null check (reason in ('bounce', 'complaint', 'manual', 'provider_suppression', 'unsubscribe')),
  provider text not null default 'external',
  source_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  suppressed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists email_suppressions_email_category_idx
  on public.email_suppressions (lower(email), category, suppressed_at desc);

create index if not exists email_suppressions_reason_idx
  on public.email_suppressions (reason, created_at desc);

alter table if exists public.email_suppressions enable row level security;

drop policy if exists email_suppressions_admin_only on public.email_suppressions;
create policy email_suppressions_admin_only on public.email_suppressions
  for all to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());
