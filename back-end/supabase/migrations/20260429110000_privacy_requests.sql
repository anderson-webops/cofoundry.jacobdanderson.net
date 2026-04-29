create table if not exists public.privacy_requests (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  type text not null check (type in ('account_deletion', 'data_export', 'correction', 'visibility', 'safety_privacy')),
  details text not null,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by_user_id text references public.users(id) on delete set null,
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by_user_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists privacy_requests_user_idx on public.privacy_requests (user_id, created_at desc);
create index if not exists privacy_requests_status_idx on public.privacy_requests (status, created_at desc);
