create table if not exists public.relationship_decisions (
  id text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  author_user_id text not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists relationship_decisions_match_idx on public.relationship_decisions (match_id, created_at desc);
create index if not exists relationship_decisions_author_idx on public.relationship_decisions (author_user_id, created_at desc);

alter table if exists public.relationship_decisions enable row level security;

drop policy if exists relationship_decisions_participant_or_admin on public.relationship_decisions;
create policy relationship_decisions_participant_or_admin on public.relationship_decisions
  for all to authenticated
  using (public.cofoundry_is_match_participant(match_id) or public.cofoundry_is_admin())
  with check ((author_user_id = public.cofoundry_current_user_id() and public.cofoundry_is_match_participant(match_id)) or public.cofoundry_is_admin());
