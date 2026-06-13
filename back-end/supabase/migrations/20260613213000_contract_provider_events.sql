create table if not exists public.contract_provider_events (
  id text primary key,
  contract_id text not null references public.contracts(id) on delete cascade,
  contract_version_id text not null references public.contract_versions(id) on delete cascade,
  provider text not null default 'external',
  provider_envelope_id text not null,
  status text not null check (status in ('created', 'sent', 'viewed', 'completed', 'declined', 'voided', 'failed')),
  completed_pdf_file_upload_id text references public.file_uploads(id) on delete set null,
  completed_pdf_sha256 text check (completed_pdf_sha256 is null or completed_pdf_sha256 ~* '^[a-f0-9]{64}$'),
  signed_by_user_ids text[] not null default array[]::text[],
  source_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists contract_provider_events_contract_idx
  on public.contract_provider_events (contract_id, contract_version_id, occurred_at desc);

create index if not exists contract_provider_events_envelope_idx
  on public.contract_provider_events (provider, provider_envelope_id, occurred_at desc);

alter table if exists public.contract_provider_events enable row level security;

drop policy if exists contract_provider_events_admin_only on public.contract_provider_events;
create policy contract_provider_events_admin_only on public.contract_provider_events
  for all to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());
