alter table if exists public.admin_actions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists admin_actions_metadata_gin_idx on public.admin_actions using gin (metadata);

create index if not exists admin_actions_assignment_owner_idx
  on public.admin_actions ((metadata->>'assignedAdminUserId'))
  where type = 'assign_case';
