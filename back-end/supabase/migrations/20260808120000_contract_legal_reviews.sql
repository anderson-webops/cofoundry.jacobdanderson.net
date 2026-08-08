create table if not exists public.contract_legal_reviews (
  id text primary key,
  contract_id text not null references public.contracts(id) on delete cascade,
  contract_version_id text not null references public.contract_versions(id) on delete cascade,
  requested_by_user_id text not null references public.users(id) on delete cascade,
  reviewer_type text not null check (reviewer_type in ('in_house_counsel', 'outside_counsel')),
  reviewer_name text not null,
  reviewer_email text not null check (reviewer_email = lower(btrim(reviewer_email))),
  reviewer_organization text not null,
  review_scope text[] not null check (
    cardinality(review_scope) between 1 and 6
    and review_scope <@ array['full_agreement', 'equity_vesting', 'ip_confidentiality', 'governance', 'employment_tax', 'formation']::text[]
  ),
  message text not null,
  status text not null check (status in ('requested', 'opened', 'changes_requested', 'approved', 'canceled', 'superseded', 'expired')),
  reviewer_response text,
  responded_by_name text,
  opened_at timestamptz,
  responded_at timestamptz,
  canceled_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_legal_reviews_contract_idx
  on public.contract_legal_reviews (contract_id, created_at desc);

create index if not exists contract_legal_reviews_version_idx
  on public.contract_legal_reviews (contract_version_id, created_at desc);

create unique index if not exists contract_legal_reviews_active_reviewer_idx
  on public.contract_legal_reviews (contract_version_id, lower(reviewer_email))
  where status in ('requested', 'opened', 'changes_requested');

alter table public.contract_legal_reviews enable row level security;

revoke all on table public.contract_legal_reviews from public, anon, authenticated;
grant all on table public.contract_legal_reviews to service_role;
