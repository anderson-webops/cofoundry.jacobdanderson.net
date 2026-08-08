create table if not exists public.investment_workspace_documents (
  id text primary key,
  application_id text not null unique,
  applicant_user_id text not null references public.users(id) on delete cascade,
  opportunity_id text not null references public.startup_opportunities(id) on delete restrict,
  organization_id text references public.organization_workspace_documents(id) on delete set null,
  application_status text not null,
  all_file_upload_ids text[] not null default '{}',
  shared_file_upload_ids text[] not null default '{}',
  document jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_workspace_documents_status_check check (
    application_status in (
      'draft',
      'submitted',
      'under_review',
      'information_requested',
      'diligence',
      'committee_review',
      'accepted',
      'declined',
      'withdrawn',
      'closed'
    )
  ),
  constraint investment_workspace_documents_version_positive check (version > 0),
  constraint investment_workspace_documents_document_object check (jsonb_typeof(document) = 'object'),
  constraint investment_workspace_documents_shared_files_subset check (shared_file_upload_ids <@ all_file_upload_ids)
);

create unique index if not exists investment_workspace_documents_active_opportunity_idx
  on public.investment_workspace_documents (applicant_user_id, opportunity_id)
  where application_status not in ('declined', 'withdrawn', 'closed');

create index if not exists investment_workspace_documents_applicant_idx
  on public.investment_workspace_documents (applicant_user_id, updated_at desc);

create index if not exists investment_workspace_documents_review_idx
  on public.investment_workspace_documents (application_status, updated_at desc);

create index if not exists investment_workspace_documents_organization_idx
  on public.investment_workspace_documents (organization_id, updated_at desc);

create index if not exists investment_workspace_documents_all_files_idx
  on public.investment_workspace_documents using gin (all_file_upload_ids);

create index if not exists investment_workspace_documents_shared_files_idx
  on public.investment_workspace_documents using gin (shared_file_upload_ids);

alter table public.investment_workspace_documents enable row level security;

revoke all on table public.investment_workspace_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.investment_workspace_documents to service_role;

alter table public.file_uploads
  drop constraint if exists file_uploads_purpose_check;

alter table public.file_uploads
  add constraint file_uploads_purpose_check check (
    purpose in ('message_attachment', 'proposal_attachment', 'contract_attachment', 'trust_evidence', 'investment_document')
  );

alter table public.file_uploads
  drop constraint if exists file_uploads_related_type_check;

alter table public.file_uploads
  add constraint file_uploads_related_type_check check (
    related_type in ('message', 'proposal', 'contract', 'profile', 'opportunity', 'investment_workspace')
  );

comment on table public.investment_workspace_documents is
  'Server-owned, CAS-versioned investment workspaces with strict applicant and staff projections. Browser access is available only through authenticated Nuxt routes.';

comment on column public.investment_workspace_documents.shared_file_upload_ids is
  'File identifiers the applicant explicitly shared with program reviewers; private pipeline and unshared data-room records remain excluded.';
