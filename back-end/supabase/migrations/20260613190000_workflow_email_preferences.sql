alter table if exists public.users
  add column if not exists workflow_email_enabled boolean not null default false;
