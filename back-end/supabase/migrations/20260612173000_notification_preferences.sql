alter table if exists public.users
  add column if not exists email_digest_enabled boolean not null default false;
