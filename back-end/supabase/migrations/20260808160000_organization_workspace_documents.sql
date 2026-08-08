create table if not exists public.organization_workspace_documents (
  id text primary key,
  slug text not null unique,
  owner_user_id text not null references public.users(id) on delete restrict,
  active_member_user_ids text[] not null default '{}',
  pending_invite_emails text[] not null default '{}',
  linked_resource_keys text[] not null default '{}',
  document jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_workspace_documents_version_positive check (version > 0),
  constraint organization_workspace_documents_document_object check (jsonb_typeof(document) = 'object'),
  constraint organization_workspace_documents_has_owner check (owner_user_id = any(active_member_user_ids))
);

create index if not exists organization_workspace_documents_members_idx
  on public.organization_workspace_documents using gin (active_member_user_ids);

create index if not exists organization_workspace_documents_invites_idx
  on public.organization_workspace_documents using gin (pending_invite_emails);

create index if not exists organization_workspace_documents_resources_idx
  on public.organization_workspace_documents using gin (linked_resource_keys);

create index if not exists organization_workspace_documents_updated_idx
  on public.organization_workspace_documents (updated_at desc);

alter table public.organization_workspace_documents enable row level security;

revoke all on table public.organization_workspace_documents from public, anon, authenticated;
grant select, insert, update, delete on table public.organization_workspace_documents to service_role;

comment on table public.organization_workspace_documents is
  'Server-owned, CAS-versioned Team and Studio aggregates. Browser access is projected through authenticated Nuxt routes.';
