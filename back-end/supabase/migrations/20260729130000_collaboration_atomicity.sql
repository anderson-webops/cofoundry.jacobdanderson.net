-- Persist a complete collaboration transition in one transaction. The
-- application only appends or updates workflow records, so this RPC never
-- deletes parent rows or cascades away audit/provider evidence.

create unique index if not exists signatures_contract_version_user_unique_idx
  on public.signatures (contract_version_id, user_id);

create unique index if not exists contract_signature_events_signature_unique_idx
  on public.contract_signature_events (signature_id)
  where signature_id is not null;

create unique index if not exists proposal_versions_number_unique_idx
  on public.proposal_versions (proposal_id, version_number);

create unique index if not exists contracts_proposal_unique_idx
  on public.contracts (proposal_id);

create unique index if not exists contract_versions_number_unique_idx
  on public.contract_versions (contract_id, version_number);

create unique index if not exists trial_collaborations_match_unique_idx
  on public.trial_collaborations (match_id);

create or replace function public.cofoundry_upsert_collaboration_state(
  p_connect_requests jsonb,
  p_contract_versions jsonb,
  p_contracts jsonb,
  p_conversations jsonb,
  p_matches jsonb,
  p_messages jsonb,
  p_notifications jsonb,
  p_proposal_comments jsonb,
  p_proposal_versions jsonb,
  p_proposals jsonb,
  p_relationship_decisions jsonb,
  p_signatures jsonb,
  p_signature_events jsonb,
  p_trial_collaborations jsonb,
  p_user_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  collection jsonb;
  locked_user_id text;
begin
  if coalesce(array_length(p_user_ids, 1), 0) = 0
    or exists (select 1 from unnest(p_user_ids) as user_id where trim(user_id) = '') then
    raise exception 'At least one valid collaboration participant is required.';
  end if;

  foreach collection in array array[
    p_connect_requests,
    p_contract_versions,
    p_contracts,
    p_conversations,
    p_matches,
    p_messages,
    p_notifications,
    p_proposal_comments,
    p_proposal_versions,
    p_proposals,
    p_relationship_decisions,
    p_signatures,
    p_signature_events,
    p_trial_collaborations
  ]
  loop
    if jsonb_typeof(coalesce(collection, '[]'::jsonb)) <> 'array' then
      raise exception 'Collaboration collections must be JSON arrays.';
    end if;
  end loop;

  for locked_user_id in
    select distinct trim(user_id)
    from unnest(p_user_ids) as user_id
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(locked_user_id, 0));
  end loop;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_connect_requests, '[]'::jsonb))
      as row_data(from_user_id text, to_user_id text)
    where not (row_data.from_user_id = any(p_user_ids) or row_data.to_user_id = any(p_user_ids))
  ) then
    raise exception 'Connect requests must involve an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_conversations, '[]'::jsonb))
      as row_data(participant_ids text[])
    where not row_data.participant_ids && p_user_ids
  ) then
    raise exception 'Conversations must involve an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_matches, '[]'::jsonb))
      as row_data(participant_ids text[])
    where not row_data.participant_ids && p_user_ids
  ) then
    raise exception 'Matches must involve an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_proposals, '[]'::jsonb))
      as row_data(created_by_user_id text, recipient_user_id text)
    where not (row_data.created_by_user_id = any(p_user_ids) or row_data.recipient_user_id = any(p_user_ids))
  ) then
    raise exception 'Proposals must involve an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_notifications, '[]'::jsonb))
      as row_data(user_id text)
    where not row_data.user_id = any(p_user_ids)
  ) then
    raise exception 'Notifications must belong to an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_signatures, '[]'::jsonb))
      as row_data(user_id text)
    where not row_data.user_id = any(p_user_ids)
  ) then
    raise exception 'Signatures must belong to an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_signature_events, '[]'::jsonb))
      as row_data(user_id text)
    where not row_data.user_id = any(p_user_ids)
  ) then
    raise exception 'Signature events must belong to an affected participant.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_connect_requests, '[]'::jsonb))
      as incoming(
        id text,
        expected_decline_reason text,
        expected_exists boolean,
        expected_responded_at timestamptz,
        expected_status text
      )
    left join public.connect_requests as current_row on current_row.id = incoming.id
    where incoming.expected_exists is null
      or (
        incoming.expected_exists
        and (
          current_row.id is null
          or current_row.status is distinct from incoming.expected_status
          or current_row.decline_reason is distinct from incoming.expected_decline_reason
          or current_row.responded_at is distinct from incoming.expected_responded_at
        )
      )
      or (not incoming.expected_exists and current_row.id is not null)
  ) then
    raise exception 'Collaboration state changed after this action began. Refresh and try again.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_conversations, '[]'::jsonb))
      as incoming(
        id text,
        expected_exists boolean,
        expected_last_message_at timestamptz,
        expected_typing_by_user_ids text[],
        expected_unread_count_by_user jsonb
      )
    left join public.conversations as current_row on current_row.id = incoming.id
    where incoming.expected_exists is null
      or (
        incoming.expected_exists
        and (
          current_row.id is null
          or current_row.last_message_at is distinct from incoming.expected_last_message_at
          or current_row.typing_by_user_ids is distinct from incoming.expected_typing_by_user_ids
          or current_row.unread_count_by_user is distinct from incoming.expected_unread_count_by_user
        )
      )
      or (not incoming.expected_exists and current_row.id is not null)
  ) then
    raise exception 'Collaboration state changed after this action began. Refresh and try again.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_proposals, '[]'::jsonb))
      as incoming(
        id text,
        expected_current_version_id text,
        expected_exists boolean,
        expected_status text,
        expected_updated_at timestamptz
      )
    left join public.proposals as current_row on current_row.id = incoming.id
    where incoming.expected_exists is null
      or (
        incoming.expected_exists
        and (
          current_row.id is null
          or current_row.current_version_id is distinct from incoming.expected_current_version_id
          or current_row.status is distinct from incoming.expected_status
          or current_row.updated_at is distinct from incoming.expected_updated_at
        )
      )
      or (not incoming.expected_exists and current_row.id is not null)
  ) then
    raise exception 'Collaboration state changed after this action began. Refresh and try again.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_contracts, '[]'::jsonb))
      as incoming(
        id text,
        expected_current_version_id text,
        expected_disclaimer_acknowledged boolean,
        expected_exists boolean,
        expected_status text,
        expected_updated_at timestamptz
      )
    left join public.contracts as current_row on current_row.id = incoming.id
    where incoming.expected_exists is null
      or (
        incoming.expected_exists
        and (
          current_row.id is null
          or current_row.current_version_id is distinct from incoming.expected_current_version_id
          or current_row.disclaimer_acknowledged is distinct from incoming.expected_disclaimer_acknowledged
          or current_row.status is distinct from incoming.expected_status
          or current_row.updated_at is distinct from incoming.expected_updated_at
        )
      )
      or (not incoming.expected_exists and current_row.id is not null)
  ) then
    raise exception 'Collaboration state changed after this action began. Refresh and try again.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_trial_collaborations, '[]'::jsonb))
      as incoming(
        id text,
        expected_acknowledged_by_user_ids text[],
        expected_exists boolean,
        expected_next_check_in_at timestamptz,
        expected_status text,
        expected_updated_at timestamptz
      )
    left join public.trial_collaborations as current_row on current_row.id = incoming.id
    where incoming.expected_exists is null
      or (
        incoming.expected_exists
        and (
          current_row.id is null
          or current_row.acknowledged_by_user_ids is distinct from incoming.expected_acknowledged_by_user_ids
          or current_row.next_check_in_at is distinct from incoming.expected_next_check_in_at
          or current_row.status is distinct from incoming.expected_status
          or current_row.updated_at is distinct from incoming.expected_updated_at
        )
      )
      or (not incoming.expected_exists and current_row.id is not null)
  ) then
    raise exception 'Collaboration state changed after this action began. Refresh and try again.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_notifications, '[]'::jsonb))
      as incoming(
        id text,
        expected_exists boolean,
        expected_read_at timestamptz
      )
    left join public.notifications as current_row on current_row.id = incoming.id
    where incoming.expected_exists is null
      or (
        incoming.expected_exists
        and (
          current_row.id is null
          or current_row.read_at is distinct from incoming.expected_read_at
        )
      )
      or (not incoming.expected_exists and current_row.id is not null)
  ) then
    raise exception 'Collaboration state changed after this action began. Refresh and try again.';
  end if;

  insert into public.connect_requests (
    id, from_user_id, to_user_id, note, structured_intro, status,
    decline_reason, created_at, responded_at
  )
  select
    row_data.id, row_data.from_user_id, row_data.to_user_id, row_data.note,
    row_data.structured_intro, row_data.status, row_data.decline_reason,
    row_data.created_at, row_data.responded_at
  from jsonb_to_recordset(coalesce(p_connect_requests, '[]'::jsonb)) as row_data(
    id text,
    from_user_id text,
    to_user_id text,
    note text,
    structured_intro jsonb,
    status text,
    decline_reason text,
    created_at timestamptz,
    responded_at timestamptz
  )
  on conflict (id) do update set
    status = excluded.status,
    decline_reason = excluded.decline_reason,
    responded_at = excluded.responded_at;

  insert into public.conversations (
    id, participant_ids, last_message_at, unread_count_by_user, typing_by_user_ids
  )
  select
    row_data.id, row_data.participant_ids, row_data.last_message_at,
    row_data.unread_count_by_user, row_data.typing_by_user_ids
  from jsonb_to_recordset(coalesce(p_conversations, '[]'::jsonb)) as row_data(
    id text,
    participant_ids text[],
    last_message_at timestamptz,
    unread_count_by_user jsonb,
    typing_by_user_ids text[]
  )
  on conflict (id) do update set
    last_message_at = excluded.last_message_at,
    unread_count_by_user = excluded.unread_count_by_user,
    typing_by_user_ids = excluded.typing_by_user_ids;

  insert into public.matches (
    id, participant_ids, source, conversation_id, created_at
  )
  select
    row_data.id, row_data.participant_ids, row_data.source,
    row_data.conversation_id, row_data.created_at
  from jsonb_to_recordset(coalesce(p_matches, '[]'::jsonb)) as row_data(
    id text,
    participant_ids text[],
    source text,
    conversation_id text,
    created_at timestamptz
  )
  on conflict (id) do nothing;

  insert into public.messages (
    id, conversation_id, sender_user_id, type, body, attachments, created_at
  )
  select
    row_data.id, row_data.conversation_id, row_data.sender_user_id,
    row_data.type, row_data.body, row_data.attachments, row_data.created_at
  from jsonb_to_recordset(coalesce(p_messages, '[]'::jsonb)) as row_data(
    id text,
    conversation_id text,
    sender_user_id text,
    type text,
    body text,
    attachments jsonb,
    created_at timestamptz
  )
  on conflict (id) do nothing;

  insert into public.proposals (
    id, conversation_id, opportunity_id, created_by_user_id,
    recipient_user_id, title, current_version_id, status, created_at, updated_at
  )
  select
    row_data.id, row_data.conversation_id, row_data.opportunity_id,
    row_data.created_by_user_id, row_data.recipient_user_id, row_data.title,
    row_data.current_version_id, row_data.status, row_data.created_at,
    row_data.updated_at
  from jsonb_to_recordset(coalesce(p_proposals, '[]'::jsonb)) as row_data(
    id text,
    conversation_id text,
    opportunity_id text,
    created_by_user_id text,
    recipient_user_id text,
    title text,
    current_version_id text,
    status text,
    created_at timestamptz,
    updated_at timestamptz
  )
  on conflict (id) do update set
    current_version_id = excluded.current_version_id,
    status = excluded.status,
    updated_at = excluded.updated_at;

  insert into public.proposal_versions (
    id, proposal_id, version_number, relationship_type, role_title,
    responsibilities, weekly_time_commitment, start_date, full_time_trigger,
    ceo_decision, trial_scope, trial_ip_handling, cash_compensation, equity,
    vesting_schedule, cliff, decision_rights, ip_assignment_required,
    confidentiality, exit_terms, notes, summary, created_by_user_id, created_at
  )
  select
    row_data.id, row_data.proposal_id, row_data.version_number,
    row_data.relationship_type, row_data.role_title, row_data.responsibilities,
    row_data.weekly_time_commitment, row_data.start_date,
    row_data.full_time_trigger, row_data.ceo_decision, row_data.trial_scope,
    row_data.trial_ip_handling, row_data.cash_compensation, row_data.equity,
    row_data.vesting_schedule, row_data.cliff, row_data.decision_rights,
    row_data.ip_assignment_required, row_data.confidentiality,
    row_data.exit_terms, row_data.notes, row_data.summary,
    row_data.created_by_user_id, row_data.created_at
  from jsonb_to_recordset(coalesce(p_proposal_versions, '[]'::jsonb)) as row_data(
    id text,
    proposal_id text,
    version_number integer,
    relationship_type text,
    role_title text,
    responsibilities text[],
    weekly_time_commitment integer,
    start_date date,
    full_time_trigger text,
    ceo_decision text,
    trial_scope text,
    trial_ip_handling text,
    cash_compensation text,
    equity text,
    vesting_schedule text,
    cliff text,
    decision_rights text,
    ip_assignment_required boolean,
    confidentiality text,
    exit_terms text,
    notes text,
    summary text,
    created_by_user_id text,
    created_at timestamptz
  )
  on conflict (id) do nothing;

  insert into public.proposal_comments (
    id, proposal_id, proposal_version_id, author_user_id, section, body, created_at
  )
  select
    row_data.id, row_data.proposal_id, row_data.proposal_version_id,
    row_data.author_user_id, row_data.section, row_data.body, row_data.created_at
  from jsonb_to_recordset(coalesce(p_proposal_comments, '[]'::jsonb)) as row_data(
    id text,
    proposal_id text,
    proposal_version_id text,
    author_user_id text,
    section text,
    body text,
    created_at timestamptz
  )
  on conflict (id) do nothing;

  insert into public.contracts (
    id, proposal_id, title, status, current_version_id,
    disclaimer_acknowledged, created_at, updated_at
  )
  select
    row_data.id, row_data.proposal_id, row_data.title, row_data.status,
    row_data.current_version_id, row_data.disclaimer_acknowledged,
    row_data.created_at, row_data.updated_at
  from jsonb_to_recordset(coalesce(p_contracts, '[]'::jsonb)) as row_data(
    id text,
    proposal_id text,
    title text,
    status text,
    current_version_id text,
    disclaimer_acknowledged boolean,
    created_at timestamptz,
    updated_at timestamptz
  )
  on conflict (id) do update set
    status = excluded.status,
    current_version_id = excluded.current_version_id,
    disclaimer_acknowledged = excluded.disclaimer_acknowledged,
    updated_at = excluded.updated_at;

  insert into public.contract_versions (
    id, contract_id, version_number, parties, role_title, scope,
    time_commitment, compensation, equity, vesting, ip_assignment,
    confidentiality, decision_making, termination, dispute_resolution,
    notes, generated_from_proposal_version_id, created_at
  )
  select
    row_data.id, row_data.contract_id, row_data.version_number,
    row_data.parties, row_data.role_title, row_data.scope,
    row_data.time_commitment, row_data.compensation, row_data.equity,
    row_data.vesting, row_data.ip_assignment, row_data.confidentiality,
    row_data.decision_making, row_data.termination,
    row_data.dispute_resolution, row_data.notes,
    row_data.generated_from_proposal_version_id, row_data.created_at
  from jsonb_to_recordset(coalesce(p_contract_versions, '[]'::jsonb)) as row_data(
    id text,
    contract_id text,
    version_number integer,
    parties text[],
    role_title text,
    scope text,
    time_commitment text,
    compensation text,
    equity text,
    vesting text,
    ip_assignment text,
    confidentiality text,
    decision_making text,
    termination text,
    dispute_resolution text,
    notes text,
    generated_from_proposal_version_id text,
    created_at timestamptz
  )
  on conflict (id) do nothing;

  insert into public.signatures (
    id, contract_id, contract_version_id, user_id, typed_name, signed_at
  )
  select
    row_data.id, row_data.contract_id, row_data.contract_version_id,
    row_data.user_id, row_data.typed_name, row_data.signed_at
  from jsonb_to_recordset(coalesce(p_signatures, '[]'::jsonb)) as row_data(
    id text,
    contract_id text,
    contract_version_id text,
    user_id text,
    typed_name text,
    signed_at timestamptz
  )
  on conflict do nothing;

  insert into public.contract_signature_events (
    id, contract_id, contract_version_id, signature_id, user_id, typed_name,
    event_type, ip_address, user_agent, created_at
  )
  select
    row_data.id, row_data.contract_id, row_data.contract_version_id,
    row_data.signature_id, row_data.user_id, row_data.typed_name,
    row_data.event_type, row_data.ip_address, row_data.user_agent,
    row_data.created_at
  from jsonb_to_recordset(coalesce(p_signature_events, '[]'::jsonb)) as row_data(
    id text,
    contract_id text,
    contract_version_id text,
    signature_id text,
    user_id text,
    typed_name text,
    event_type text,
    ip_address text,
    user_agent text,
    created_at timestamptz
  )
  on conflict do nothing;

  insert into public.trial_collaborations (
    id, match_id, created_by_user_id, title, objective, scope, weekly_hours,
    duration_weeks, check_in_cadence, deliverables, success_signals, status,
    acknowledged_by_user_ids, next_check_in_at, created_at, updated_at
  )
  select
    row_data.id, row_data.match_id, row_data.created_by_user_id,
    row_data.title, row_data.objective, row_data.scope, row_data.weekly_hours,
    row_data.duration_weeks, row_data.check_in_cadence, row_data.deliverables,
    row_data.success_signals, row_data.status, row_data.acknowledged_by_user_ids,
    row_data.next_check_in_at, row_data.created_at, row_data.updated_at
  from jsonb_to_recordset(coalesce(p_trial_collaborations, '[]'::jsonb)) as row_data(
    id text,
    match_id text,
    created_by_user_id text,
    title text,
    objective text,
    scope text,
    weekly_hours integer,
    duration_weeks integer,
    check_in_cadence text,
    deliverables text[],
    success_signals text[],
    status text,
    acknowledged_by_user_ids text[],
    next_check_in_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  )
  on conflict (id) do update set
    status = excluded.status,
    acknowledged_by_user_ids = excluded.acknowledged_by_user_ids,
    next_check_in_at = excluded.next_check_in_at,
    updated_at = excluded.updated_at;

  insert into public.relationship_decisions (
    id, match_id, author_user_id, title, body, status, created_at, updated_at
  )
  select
    row_data.id, row_data.match_id, row_data.author_user_id,
    row_data.title, row_data.body, row_data.status,
    row_data.created_at, row_data.updated_at
  from jsonb_to_recordset(coalesce(p_relationship_decisions, '[]'::jsonb)) as row_data(
    id text,
    match_id text,
    author_user_id text,
    title text,
    body text,
    status text,
    created_at timestamptz,
    updated_at timestamptz
  )
  on conflict (id) do nothing;

  insert into public.notifications (
    id, user_id, type, title, body, href, read_at, created_at
  )
  select
    row_data.id, row_data.user_id, row_data.type, row_data.title,
    row_data.body, row_data.href, row_data.read_at, row_data.created_at
  from jsonb_to_recordset(coalesce(p_notifications, '[]'::jsonb)) as row_data(
    id text,
    user_id text,
    type text,
    title text,
    body text,
    href text,
    read_at timestamptz,
    created_at timestamptz
  )
  on conflict (id) do update set
    read_at = excluded.read_at;

  return jsonb_build_object(
    'userIds', to_jsonb(p_user_ids),
    'connectRequestCount', jsonb_array_length(coalesce(p_connect_requests, '[]'::jsonb)),
    'conversationCount', jsonb_array_length(coalesce(p_conversations, '[]'::jsonb)),
    'messageCount', jsonb_array_length(coalesce(p_messages, '[]'::jsonb)),
    'proposalCount', jsonb_array_length(coalesce(p_proposals, '[]'::jsonb)),
    'contractCount', jsonb_array_length(coalesce(p_contracts, '[]'::jsonb))
  );
end
$$;

revoke all on function public.cofoundry_upsert_collaboration_state(
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text[]
) from public, anon, authenticated;
grant execute on function public.cofoundry_upsert_collaboration_state(
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text[]
) to service_role;
