alter table if exists public.notification_deliveries
  add column if not exists event_type text not null default 'digest.unread',
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists body_preview text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notification_deliveries_event_type_idx
  on public.notification_deliveries (event_type, created_at desc);

create index if not exists notification_deliveries_target_idx
  on public.notification_deliveries (target_type, target_id, created_at desc);
