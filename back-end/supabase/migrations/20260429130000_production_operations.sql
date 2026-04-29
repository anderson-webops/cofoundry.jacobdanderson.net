alter table if exists public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists stripe_status text;

create index if not exists subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id);
create index if not exists subscriptions_stripe_subscription_idx on public.subscriptions (stripe_subscription_id);

create table if not exists public.notification_deliveries (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  channel text not null default 'email',
  status text not null check (status in ('sent', 'skipped', 'failed')),
  subject text not null,
  recipient text not null,
  notification_count integer not null default 0,
  error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_user_idx on public.notification_deliveries (user_id, created_at desc);
create index if not exists notification_deliveries_status_idx on public.notification_deliveries (status, created_at desc);

create table if not exists public.file_uploads (
  id text primary key,
  owner_user_id text not null references public.users(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  purpose text not null check (purpose in ('message_attachment', 'proposal_attachment', 'contract_attachment', 'trust_evidence')),
  related_type text check (related_type in ('message', 'proposal', 'contract', 'profile', 'opportunity')),
  related_id text,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'blocked', 'deleted')),
  scan_status text not null default 'pending' check (scan_status in ('pending', 'clean', 'flagged', 'failed', 'skipped')),
  scan_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, object_path)
);

create index if not exists file_uploads_owner_idx on public.file_uploads (owner_user_id, created_at desc);
create index if not exists file_uploads_scan_idx on public.file_uploads (scan_status, created_at desc);
create index if not exists file_uploads_related_idx on public.file_uploads (related_type, related_id);

create table if not exists public.contract_signature_events (
  id text primary key,
  contract_id text not null references public.contracts(id) on delete cascade,
  contract_version_id text not null references public.contract_versions(id) on delete cascade,
  signature_id text references public.signatures(id) on delete set null,
  user_id text not null references public.users(id) on delete cascade,
  typed_name text not null,
  event_type text not null default 'typed_signature' check (event_type in ('typed_signature', 'signature_voided')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists contract_signature_events_contract_idx on public.contract_signature_events (contract_id, created_at desc);
create index if not exists contract_signature_events_user_idx on public.contract_signature_events (user_id, created_at desc);

create table if not exists public.operational_events (
  id text primary key,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'error')),
  source text not null,
  actor_user_id text references public.users(id) on delete set null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_events_type_idx on public.operational_events (event_type, created_at desc);
create index if not exists operational_events_severity_idx on public.operational_events (severity, created_at desc);

create table if not exists public.backup_runs (
  id text primary key,
  provider text not null default 'external',
  status text not null check (status in ('scheduled', 'running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  artifact_uri text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists backup_runs_status_idx on public.backup_runs (status, started_at desc);

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('cofoundry-private-files', 'cofoundry-private-files', false)
    on conflict (id) do update set public = false;
  end if;
end $$;

create or replace function public.cofoundry_current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select (select auth.uid())::text
$$;

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
      and role in ('admin', 'investor_admin')
      and suspended_at is null
  )
$$;

create or replace function public.cofoundry_is_conversation_participant(target_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations
    where id = target_conversation_id
      and public.cofoundry_current_user_id() = any(participant_ids)
  )
$$;

create or replace function public.cofoundry_is_match_participant(target_match_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches
    where id = target_match_id
      and public.cofoundry_current_user_id() = any(participant_ids)
  )
$$;

create or replace function public.cofoundry_is_proposal_participant(target_proposal_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.proposals
    where id = target_proposal_id
      and public.cofoundry_current_user_id() in (created_by_user_id, recipient_user_id)
  )
$$;

create or replace function public.cofoundry_is_contract_participant(target_contract_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contracts c
    join public.proposals p on p.id = c.proposal_id
    where c.id = target_contract_id
      and public.cofoundry_current_user_id() in (p.created_by_user_id, p.recipient_user_id)
  )
$$;

alter table if exists public.users enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.member_profile_state enable row level security;
alter table if exists public.startup_opportunities enable row level security;
alter table if exists public.bookmarks enable row level security;
alter table if exists public.saved_searches enable row level security;
alter table if exists public.subscriptions enable row level security;
alter table if exists public.connect_requests enable row level security;
alter table if exists public.conversations enable row level security;
alter table if exists public.matches enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.proposals enable row level security;
alter table if exists public.proposal_versions enable row level security;
alter table if exists public.proposal_comments enable row level security;
alter table if exists public.contracts enable row level security;
alter table if exists public.contract_versions enable row level security;
alter table if exists public.signatures enable row level security;
alter table if exists public.trial_collaborations enable row level security;
alter table if exists public.reports enable row level security;
alter table if exists public.admin_actions enable row level security;
alter table if exists public.investment_applications enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.privacy_requests enable row level security;
alter table if exists public.notification_deliveries enable row level security;
alter table if exists public.file_uploads enable row level security;
alter table if exists public.contract_signature_events enable row level security;
alter table if exists public.operational_events enable row level security;
alter table if exists public.backup_runs enable row level security;

drop policy if exists users_self_or_admin_select on public.users;
create policy users_self_or_admin_select on public.users
  for select to authenticated
  using (id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists users_self_or_admin_update on public.users;
create policy users_self_or_admin_update on public.users
  for update to authenticated
  using (id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists profiles_member_read on public.profiles;
create policy profiles_member_read on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_owner_or_admin_write on public.profiles;
create policy profiles_owner_or_admin_write on public.profiles
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists member_profile_state_owner_or_admin on public.member_profile_state;
create policy member_profile_state_owner_or_admin on public.member_profile_state
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists subscriptions_owner_or_admin on public.subscriptions;
create policy subscriptions_owner_or_admin on public.subscriptions
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists bookmarks_owner_or_admin on public.bookmarks;
create policy bookmarks_owner_or_admin on public.bookmarks
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists saved_searches_owner_or_admin on public.saved_searches;
create policy saved_searches_owner_or_admin on public.saved_searches
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists startup_opportunities_member_read on public.startup_opportunities;
create policy startup_opportunities_member_read on public.startup_opportunities
  for select to authenticated
  using (is_open or owner_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists startup_opportunities_owner_or_admin_write on public.startup_opportunities;
create policy startup_opportunities_owner_or_admin_write on public.startup_opportunities
  for all to authenticated
  using (owner_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (owner_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists connect_requests_participant_or_admin on public.connect_requests;
create policy connect_requests_participant_or_admin on public.connect_requests
  for all to authenticated
  using (public.cofoundry_current_user_id() in (from_user_id, to_user_id) or public.cofoundry_is_admin())
  with check (public.cofoundry_current_user_id() in (from_user_id, to_user_id) or public.cofoundry_is_admin());

drop policy if exists conversations_participant_or_admin on public.conversations;
create policy conversations_participant_or_admin on public.conversations
  for all to authenticated
  using (public.cofoundry_current_user_id() = any(participant_ids) or public.cofoundry_is_admin())
  with check (public.cofoundry_current_user_id() = any(participant_ids) or public.cofoundry_is_admin());

drop policy if exists matches_participant_or_admin on public.matches;
create policy matches_participant_or_admin on public.matches
  for all to authenticated
  using (public.cofoundry_current_user_id() = any(participant_ids) or public.cofoundry_is_admin())
  with check (public.cofoundry_current_user_id() = any(participant_ids) or public.cofoundry_is_admin());

drop policy if exists messages_participant_or_admin on public.messages;
create policy messages_participant_or_admin on public.messages
  for all to authenticated
  using (public.cofoundry_is_conversation_participant(conversation_id) or public.cofoundry_is_admin())
  with check ((sender_user_id = public.cofoundry_current_user_id() and public.cofoundry_is_conversation_participant(conversation_id)) or public.cofoundry_is_admin());

drop policy if exists proposals_participant_or_admin on public.proposals;
create policy proposals_participant_or_admin on public.proposals
  for all to authenticated
  using (public.cofoundry_current_user_id() in (created_by_user_id, recipient_user_id) or public.cofoundry_is_admin())
  with check (public.cofoundry_current_user_id() in (created_by_user_id, recipient_user_id) or public.cofoundry_is_admin());

drop policy if exists proposal_versions_participant_or_admin on public.proposal_versions;
create policy proposal_versions_participant_or_admin on public.proposal_versions
  for all to authenticated
  using (public.cofoundry_is_proposal_participant(proposal_id) or public.cofoundry_is_admin())
  with check ((created_by_user_id = public.cofoundry_current_user_id() and public.cofoundry_is_proposal_participant(proposal_id)) or public.cofoundry_is_admin());

drop policy if exists proposal_comments_participant_or_admin on public.proposal_comments;
create policy proposal_comments_participant_or_admin on public.proposal_comments
  for all to authenticated
  using (public.cofoundry_is_proposal_participant(proposal_id) or public.cofoundry_is_admin())
  with check ((author_user_id = public.cofoundry_current_user_id() and public.cofoundry_is_proposal_participant(proposal_id)) or public.cofoundry_is_admin());

drop policy if exists contracts_participant_or_admin on public.contracts;
create policy contracts_participant_or_admin on public.contracts
  for all to authenticated
  using (public.cofoundry_is_contract_participant(id) or public.cofoundry_is_admin())
  with check (public.cofoundry_is_contract_participant(id) or public.cofoundry_is_admin());

drop policy if exists contract_versions_participant_or_admin on public.contract_versions;
create policy contract_versions_participant_or_admin on public.contract_versions
  for all to authenticated
  using (public.cofoundry_is_contract_participant(contract_id) or public.cofoundry_is_admin())
  with check (public.cofoundry_is_contract_participant(contract_id) or public.cofoundry_is_admin());

drop policy if exists signatures_participant_or_admin on public.signatures;
create policy signatures_participant_or_admin on public.signatures
  for all to authenticated
  using (public.cofoundry_is_contract_participant(contract_id) or public.cofoundry_is_admin())
  with check ((user_id = public.cofoundry_current_user_id() and public.cofoundry_is_contract_participant(contract_id)) or public.cofoundry_is_admin());

drop policy if exists trial_collaborations_participant_or_admin on public.trial_collaborations;
create policy trial_collaborations_participant_or_admin on public.trial_collaborations
  for all to authenticated
  using (public.cofoundry_is_match_participant(match_id) or public.cofoundry_is_admin())
  with check (public.cofoundry_is_match_participant(match_id) or public.cofoundry_is_admin());

drop policy if exists reports_reporter_or_admin on public.reports;
create policy reports_reporter_or_admin on public.reports
  for all to authenticated
  using (reporter_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (reporter_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists admin_actions_admin_only on public.admin_actions;
create policy admin_actions_admin_only on public.admin_actions
  for all to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());

drop policy if exists investment_applications_owner_or_admin on public.investment_applications;
create policy investment_applications_owner_or_admin on public.investment_applications
  for all to authenticated
  using (applicant_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (applicant_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists notifications_owner_or_admin on public.notifications;
create policy notifications_owner_or_admin on public.notifications
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists privacy_requests_owner_or_admin on public.privacy_requests;
create policy privacy_requests_owner_or_admin on public.privacy_requests
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists notification_deliveries_owner_or_admin on public.notification_deliveries;
create policy notification_deliveries_owner_or_admin on public.notification_deliveries
  for all to authenticated
  using (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists file_uploads_owner_or_admin on public.file_uploads;
create policy file_uploads_owner_or_admin on public.file_uploads
  for all to authenticated
  using (owner_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin())
  with check (owner_user_id = public.cofoundry_current_user_id() or public.cofoundry_is_admin());

drop policy if exists contract_signature_events_participant_or_admin on public.contract_signature_events;
create policy contract_signature_events_participant_or_admin on public.contract_signature_events
  for all to authenticated
  using (public.cofoundry_is_contract_participant(contract_id) or public.cofoundry_is_admin())
  with check ((user_id = public.cofoundry_current_user_id() and public.cofoundry_is_contract_participant(contract_id)) or public.cofoundry_is_admin());

drop policy if exists operational_events_admin_only on public.operational_events;
create policy operational_events_admin_only on public.operational_events
  for all to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());

drop policy if exists backup_runs_admin_only on public.backup_runs;
create policy backup_runs_admin_only on public.backup_runs
  for all to authenticated
  using (public.cofoundry_is_admin())
  with check (public.cofoundry_is_admin());
