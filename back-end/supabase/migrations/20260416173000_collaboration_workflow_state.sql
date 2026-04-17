alter table if exists public.connect_requests
  add column if not exists structured_intro jsonb not null default '{}'::jsonb,
  add column if not exists decline_reason text;

alter table if exists public.proposal_versions
  add column if not exists relationship_type text not null default 'cofounder',
  add column if not exists full_time_trigger text not null default '',
  add column if not exists ceo_decision text not null default '',
  add column if not exists trial_scope text not null default '',
  add column if not exists trial_ip_handling text not null default '';

create table if not exists public.trial_collaborations (
  id text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  created_by_user_id text not null references public.users(id) on delete cascade,
  title text not null,
  objective text not null,
  scope text not null,
  weekly_hours integer not null,
  duration_weeks integer not null,
  check_in_cadence text not null,
  deliverables text[] not null default array[]::text[],
  success_signals text[] not null default array[]::text[],
  status text not null,
  acknowledged_by_user_ids text[] not null default array[]::text[],
  next_check_in_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.reports
  add column if not exists priority text not null default 'standard',
  add column if not exists review_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id text references public.users(id) on delete set null,
  add column if not exists resolution_notes text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id text references public.users(id) on delete set null;

alter table if exists public.admin_actions
  add column if not exists target_type text not null default 'user';

create index if not exists connect_requests_from_user_idx on public.connect_requests (from_user_id, created_at desc);
create index if not exists connect_requests_to_user_idx on public.connect_requests (to_user_id, created_at desc);
create index if not exists connect_requests_status_idx on public.connect_requests (status);
create index if not exists matches_participant_ids_gin_idx on public.matches using gin (participant_ids);
create index if not exists conversations_participant_ids_gin_idx on public.conversations using gin (participant_ids);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists proposals_created_by_idx on public.proposals (created_by_user_id, updated_at desc);
create index if not exists proposals_recipient_idx on public.proposals (recipient_user_id, updated_at desc);
create index if not exists proposal_versions_proposal_idx on public.proposal_versions (proposal_id, version_number desc);
create index if not exists proposal_comments_proposal_idx on public.proposal_comments (proposal_id, created_at desc);
create index if not exists contracts_proposal_idx on public.contracts (proposal_id, updated_at desc);
create index if not exists contract_versions_contract_idx on public.contract_versions (contract_id, version_number desc);
create index if not exists signatures_contract_idx on public.signatures (contract_id, signed_at desc);
create index if not exists trial_collaborations_match_idx on public.trial_collaborations (match_id, updated_at desc);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
