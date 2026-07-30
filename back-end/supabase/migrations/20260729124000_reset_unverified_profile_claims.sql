-- Older member-workspace writes accepted browser-supplied trust booleans.
-- Clear those claims once so the application can derive them exclusively from
-- the latest server-recorded trust_verification_events rows.

update public.member_profile_state
set
  profile = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      profile,
                      '{trustSignals,identityVerified}',
                      'false'::jsonb,
                      true
                    ),
                    '{trustSignals,workHistoryVerified}',
                    'false'::jsonb,
                    true
                  ),
                  '{trustSignals,phoneVerified}',
                  'false'::jsonb,
                  true
                ),
                '{trustSignals,linkedInVerified}',
                'false'::jsonb,
                true
              ),
              '{trustSignals,githubVerified}',
              'false'::jsonb,
              true
            ),
            '{trustSignals,workDomainVerified}',
            'false'::jsonb,
            true
          ),
          '{trustSignals,websiteVerified}',
          'false'::jsonb,
          true
        ),
        '{trustSignals,governmentIdVerified}',
        'false'::jsonb,
        true
      ),
      '{verificationBadges,linkedAccounts}',
      'false'::jsonb,
      true
    ),
    '{verificationBadges,emailVerified}',
    to_jsonb((
      select users.verified_email
      from public.users
      where users.id = member_profile_state.user_id
    )),
    true
  ),
  updated_at = now();
