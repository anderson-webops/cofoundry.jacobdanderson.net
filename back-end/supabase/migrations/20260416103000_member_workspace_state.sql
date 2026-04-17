create table if not exists public.member_profile_state (
  user_id text primary key references public.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table if exists public.member_profile_state enable row level security;

alter table if exists public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

alter table if exists public.startup_opportunities
  add column if not exists official_website text not null default '',
  add column if not exists verification_method text not null default 'none',
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists risk_flags jsonb not null default '[]'::jsonb;
