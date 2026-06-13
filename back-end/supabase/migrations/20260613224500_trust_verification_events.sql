create table if not exists public.trust_verification_events (
  id text primary key,
  target_type text not null check (target_type in ('profile', 'user', 'opportunity')),
  target_id text not null,
  verification_type text not null check (verification_type in (
    'identity',
    'work_history',
    'phone',
    'linkedin',
    'github',
    'work_domain',
    'website',
    'government_id',
    'email',
    'opportunity_domain',
    'opportunity_owner'
  )),
  status text not null check (status in ('verified', 'failed', 'manual_review', 'expired')),
  provider text not null default 'external',
  provider_subject_id text,
  source_event_id text,
  confidence numeric(5, 4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_file_upload_id text references public.file_uploads(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trust_verification_events_target_idx
  on public.trust_verification_events (target_type, target_id, occurred_at desc);

create index if not exists trust_verification_events_provider_idx
  on public.trust_verification_events (provider, source_event_id, occurred_at desc);

create index if not exists trust_verification_events_status_idx
  on public.trust_verification_events (status, created_at desc);

alter table if exists public.trust_verification_events enable row level security;

drop policy if exists trust_verification_events_admin_only on public.trust_verification_events;
create policy trust_verification_events_admin_only on public.trust_verification_events
  for all to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());
