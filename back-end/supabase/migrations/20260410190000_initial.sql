create table if not exists public.users (
  id text primary key,
  email text not null unique,
  role text not null,
  created_at timestamptz not null default now(),
  linked_providers text[] not null default array[]::text[],
  verified_email boolean not null default false,
  onboarding_completed boolean not null default false,
  suspended_at timestamptz
);

create table if not exists public.demo_auth_accounts (
  email text primary key,
  password text not null,
  providers text[] not null default array[]::text[],
  user_id text not null references public.users(id) on delete cascade
);

create table if not exists public.profiles (
  id text primary key,
  user_id text not null unique references public.users(id) on delete cascade,
  display_name text not null,
  headline text not null,
  bio text not null,
  location text not null,
  remote_preference text not null,
  roles text[] not null default array[]::text[],
  years_experience integer not null default 0,
  industries text[] not null default array[]::text[],
  startup_stage_preferences text[] not null default array[]::text[],
  compensation_preferences text[] not null default array[]::text[],
  equity_expectation_range text not null,
  time_commitment text not null,
  links jsonb not null default '{}'::jsonb,
  has_idea boolean not null default false,
  wants_to_join_idea boolean not null default false,
  values text[] not null default array[]::text[],
  work_style_preferences text[] not null default array[]::text[],
  privacy jsonb not null default '{}'::jsonb,
  verification_badges jsonb not null default '{}'::jsonb,
  availability text not null,
  portfolio jsonb not null default '[]'::jsonb,
  ventures jsonb not null default '[]'::jsonb,
  summary_highlights text[] not null default array[]::text[]
);

create table if not exists public.skills (
  id text primary key,
  label text not null unique,
  category text not null
);

create table if not exists public.profile_skills (
  id text primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  skill_id text not null references public.skills(id) on delete cascade,
  level text not null,
  years integer not null default 0
);

create table if not exists public.startup_opportunities (
  id text primary key,
  owner_user_id text not null references public.users(id) on delete cascade,
  startup_name text not null,
  slug text not null unique,
  one_line_pitch text not null,
  problem text not null,
  target_users text not null,
  stage text not null,
  traction text not null,
  roles_needed text[] not null default array[]::text[],
  expected_commitment text not null,
  compensation_structure text not null,
  equity_range text not null,
  industries text[] not null default array[]::text[],
  location text not null,
  remote_preference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_open boolean not null default true
);

create table if not exists public.opportunity_roles (
  id text primary key,
  opportunity_id text not null references public.startup_opportunities(id) on delete cascade,
  title text not null,
  summary text not null,
  skills text[] not null default array[]::text[],
  commitment text not null,
  compensation_type text not null,
  equity_range text not null,
  priority text not null
);

create table if not exists public.bookmarks (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.connect_requests (
  id text primary key,
  from_user_id text not null references public.users(id) on delete cascade,
  to_user_id text not null references public.users(id) on delete cascade,
  note text not null,
  status text not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.conversations (
  id text primary key,
  participant_ids text[] not null default array[]::text[],
  last_message_at timestamptz not null default now(),
  unread_count_by_user jsonb not null default '{}'::jsonb,
  typing_by_user_ids text[] not null default array[]::text[]
);

create table if not exists public.matches (
  id text primary key,
  participant_ids text[] not null default array[]::text[],
  source text not null,
  conversation_id text not null references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  sender_user_id text references public.users(id) on delete set null,
  type text not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  opportunity_id text references public.startup_opportunities(id) on delete set null,
  created_by_user_id text not null references public.users(id) on delete cascade,
  recipient_user_id text not null references public.users(id) on delete cascade,
  title text not null,
  current_version_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_versions (
  id text primary key,
  proposal_id text not null references public.proposals(id) on delete cascade,
  version_number integer not null,
  role_title text not null,
  responsibilities text[] not null default array[]::text[],
  weekly_time_commitment integer not null,
  start_date date not null,
  cash_compensation text not null,
  equity text not null,
  vesting_schedule text not null,
  cliff text not null,
  decision_rights text not null,
  ip_assignment_required boolean not null default true,
  confidentiality text not null,
  exit_terms text not null,
  notes text not null,
  summary text not null,
  created_by_user_id text not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.proposal_comments (
  id text primary key,
  proposal_id text not null references public.proposals(id) on delete cascade,
  proposal_version_id text not null references public.proposal_versions(id) on delete cascade,
  author_user_id text not null references public.users(id) on delete cascade,
  section text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id text primary key,
  proposal_id text not null references public.proposals(id) on delete cascade,
  title text not null,
  status text not null,
  current_version_id text not null,
  disclaimer_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contract_versions (
  id text primary key,
  contract_id text not null references public.contracts(id) on delete cascade,
  version_number integer not null,
  parties text[] not null default array[]::text[],
  role_title text not null,
  scope text not null,
  time_commitment text not null,
  compensation text not null,
  equity text not null,
  vesting text not null,
  ip_assignment text not null,
  confidentiality text not null,
  decision_making text not null,
  termination text not null,
  dispute_resolution text not null,
  notes text not null,
  generated_from_proposal_version_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.signatures (
  id text primary key,
  contract_id text not null references public.contracts(id) on delete cascade,
  contract_version_id text not null references public.contract_versions(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  typed_name text not null,
  signed_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id text primary key,
  user_id text not null unique references public.users(id) on delete cascade,
  plan text not null,
  status text not null,
  billing_cycle text not null,
  renews_at timestamptz,
  visibility_boost boolean not null default false,
  unlimited_messaging boolean not null default false,
  proposal_workflow boolean not null default false,
  contract_builder boolean not null default false
);

create table if not exists public.reports (
  id text primary key,
  reporter_user_id text not null references public.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  details text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id text primary key,
  admin_user_id text not null references public.users(id) on delete cascade,
  type text not null,
  target_id text not null,
  notes text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.investment_applications (
  id text primary key,
  opportunity_id text not null references public.startup_opportunities(id) on delete cascade,
  applicant_user_id text not null references public.users(id) on delete cascade,
  status text not null,
  raise_amount text not null,
  traction text not null,
  deck_link text not null,
  team_summary text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  label text not null,
  scope text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users(role);
create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists profiles_location_idx on public.profiles(location);
create index if not exists startup_opportunities_owner_idx on public.startup_opportunities(owner_user_id);
create index if not exists startup_opportunities_stage_idx on public.startup_opportunities(stage);
create index if not exists connect_requests_status_idx on public.connect_requests(status);
create index if not exists matches_conversation_idx on public.matches(conversation_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists proposals_status_idx on public.proposals(status);
create index if not exists contracts_status_idx on public.contracts(status);
create index if not exists reports_status_idx on public.reports(status);
create index if not exists notifications_user_idx on public.notifications(user_id, read_at);
