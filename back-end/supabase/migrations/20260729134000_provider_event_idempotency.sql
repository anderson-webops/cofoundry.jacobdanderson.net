-- Provider callbacks are retried by design. Preserve one immutable audit row
-- per provider event while still allowing manual events with no source id.

with ranked as (
  select
    id,
    row_number() over (
      partition by provider, source_event_id
      order by suppressed_at desc, created_at desc, id desc
    ) as row_number
  from public.email_suppressions
  where source_event_id is not null
)
delete from public.email_suppressions
where id in (select id from ranked where row_number > 1);

with ranked as (
  select
    id,
    row_number() over (
      partition by provider, source_event_id
      order by occurred_at desc, created_at desc, id desc
    ) as row_number
  from public.contract_provider_events
  where source_event_id is not null
)
delete from public.contract_provider_events
where id in (select id from ranked where row_number > 1);

with ranked as (
  select
    id,
    row_number() over (
      partition by provider, source_event_id
      order by occurred_at desc, created_at desc, id desc
    ) as row_number
  from public.trust_verification_events
  where source_event_id is not null
)
delete from public.trust_verification_events
where id in (select id from ranked where row_number > 1);

create unique index if not exists email_suppressions_provider_source_event_uidx
  on public.email_suppressions (provider, source_event_id);

create unique index if not exists contract_provider_events_provider_source_event_uidx
  on public.contract_provider_events (provider, source_event_id);

create unique index if not exists trust_verification_events_provider_source_event_uidx
  on public.trust_verification_events (provider, source_event_id);
