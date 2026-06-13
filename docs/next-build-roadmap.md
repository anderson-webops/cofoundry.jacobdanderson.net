# CoFoundry Next-Build Roadmap

## Product Decision

The next milestone should not add more broad product surface area. It should make the existing product loop real and operational:

1. discover
2. send structured intro
3. accept or decline
4. message
5. run trial
6. negotiate proposal
7. sign agreement

The work should now optimize for production realism, continuity, and operational clarity.

## Now

### 1. Unified inbox and action queue

Status: implemented for the aggregate route and granular read endpoints.

Front-end scope:

- Add `/app/inbox` as the single attention surface for:
  - inbound intros
  - unread conversations
  - proposal responses
  - contract signatures
  - unread system updates
- Make the workspace shell acknowledge the inbox:
  - sidebar navigation
  - route context
  - topbar entry point
  - dashboard primary action
- Define a stable inbox contract in shared code so the backend can own the same shape later.

Current front-end contract:

- `front-end/shared/utils/inbox.ts`
  - `buildInboxQueues()`
  - `buildInboxSnapshot()`
  - `getUnreadConversationsForUser()`
  - `getProposalsNeedingResponse()`
  - `getContractsNeedingSignature()`
  - `getPendingIncomingConnectRequestsForUser()`
  - `getPendingOutgoingConnectRequestsForUser()`

### 2. Real persisted workspace state

Status: foundational slice implemented.

Current persisted slice:

- Supabase-backed credential sign-in and sign-up on the Nuxt server
- signed CoFoundry app sessions revalidated against persisted member state
- persisted member-owned records for:
  - user identity and role
  - profile state
  - subscription state
  - owned opportunities
  - bookmarks
  - saved searches
- frontend workspace hydration from `/api/workspace`
- safe member-owned writes through `/api/workspace/member`

Still local/mock or partially server-backed for now:

- collaboration writes are server-routed and Supabase-persisted when Supabase mode is active, but the relationship workspace still needs more granular read endpoints and realtime refresh
- notifications persist with collaboration state, on-demand and scheduled digest delivery are wired, and event-specific lifecycle emails have launch-facing templates plus member workflow-email preference gating
- moderation enforcement now persists user/report/privacy/admin-action updates in Supabase mode, and privacy-request review/resolution now notifies the requesting user

Backend-owned entities:

- users
- profiles
- startup opportunities
- connect requests
- matches
- conversations
- messages
- trials
- proposals
- proposal versions
- proposal comments
- contracts
- contract versions
- signatures
- relationship decisions
- notifications
- reports
- admin actions
- subscriptions

Required result:

- Pinia becomes a client cache, not the source of truth.
- Refreshing the browser does not lose state.
- Two different devices can see the same conversation, proposal, and contract status.

### 3. Server-enforced roles and admin operations

Backend requirements:

- user role claims: started
- admin role enforcement: started
- audit log persistence: started for admin user/report/privacy actions in Supabase mode
- suspend / reinstate: started with Supabase persistence
- report review / resolve: started with Supabase persistence
- first-admin bootstrap script wired to the Supabase service-role path

Additional production controls now started:

- server-side rate limits on auth, contact, billing, collaboration, member writes, inbox reads, admin actions, exports, and privacy requests
- JSON account data export from settings
- privacy and trust-review request submission from settings, with `/admin/privacy` reading Supabase or the local mock-mode queue
- `/admin/readiness` launch-readiness scoring from server-side environment, queue, worker, and operations evidence

### 4. Production billing path

Keep Stripe guarded until ready, but finish the real path cleanly:

- checkout session creation
- webhook handling
- subscription sync
- admin billing visibility through a read-only billing console
- entitlement enforcement on the server for intros, saved searches, proposals, agreement drafts, and signatures

## Next

### 5. Relationship workspace

The current product still spreads one live relationship across matches, messages, proposals, and contracts.

Status: implemented as a consolidated route with server-owned reads, cross-links from the related conversation/proposal/contract detail surfaces, a filtered relationship timeline, file/artifact visibility, a decision log derived from relationship notes plus proposal/trial/agreement records, and writable relationship-level decision notes.

The user-facing consolidation is:

- `/app/relationships/[id]`

That route should unify:

- counterpart summary
- trust and alignment state
- latest messages
- current trial
- active proposal
- active contract
- next required action

Remaining depth:

- realtime refresh
- richer in-context file upload actions and scanner status recovery

### 6. Production-grade onboarding

Status: implemented as a shared activation read model, dashboard module, and `/app/activation` route.

The activation path now separates:

- minimum profile
- trust-critical profile completion
- first recommended intro
- inbox-first follow-through

The dashboard now shows the member's current activation gate, and the full activation route lists profile and trust blockers before members increase intro volume.

### 7. Operational notifications

Status: source-level lifecycle notification layer, launch-facing event templates, member workflow-email preference gating, primary app trigger wiring, optional worker-side alert webhook support, and alert-smoke readiness checks are implemented; live provider/host wiring remains.

The source now has shared lifecycle notification templates, worker-authenticated event delivery, durable delivery telemetry in mock/access-request mode, Supabase migration support for lifecycle metadata, admin operations visibility for event/target rows, non-blocking lifecycle emits from collaboration, report-review, and mock billing mutations, plus optional JSON alert webhooks for warning/error worker events with `/admin/readiness` evidence checks. The launch-facing names are explicit so provider templates can be mapped without guessing which generic workflow event fired.

Covered lifecycle events:

- `intro.received`
- `intro.accepted`
- `match.created`
- `message.unread`
- `proposal.received`
- `proposal.updated`
- `contract.signature_required`
- `report.reviewed`
- `billing.state_changed`
- `subscription.changed`

Remaining work:

- Verify SMTP/sendmail provider behavior in Supabase mode before enabling real sends.
- Install worker/timer or queue processing on the production host.
- Choose and configure the host alert webhook destination if external alerting is wanted, then run the checked-in alert-smoke event from the server.
- Wire any future provider-only events, such as Stripe webhook-only subscription reconciliation, after live providers are configured.

### 8. Agreement artifacts

Status: first-party agreement artifact layer implemented; external e-signature/PDF vendors remain optional provider work.

The contract detail flow now supports:

- print-ready HTML agreement downloads
- plain-text agreement export through `?format=text`
- field-level redlines between contract versions
- agreement execution certificate downloads with document SHA-256, version metadata, typed-signature evidence, and pending/complete status
- server-side auth, participant ownership checks, paid-plan entitlement checks, and rate limits for downloadable artifacts

Remaining work:

- Decide whether production needs a dedicated e-signature provider or whether typed signatures plus certificate packets are sufficient for the launch use case.
- If a provider is selected, map provider envelope IDs and completed PDF evidence back into contract versions and signature certificates.

### 9. Relationship analytics

Status: implemented as a shared read model and admin dashboard section.

The admin analytics page now reports:

- intro acceptance rate
- trial activation rate
- proposal coverage rate
- agreement draft generation rate
- signature completion rate
- average time to first reply
- average time from match to proposal
- average time from proposal to agreement draft
- average time from proposal to fully signed agreement when completed samples exist
- actionable relationship bottlenecks for pending intros, missing proposals, missing agreement drafts, and incomplete signatures

## Later

### 10. Realtime

After persistence is stable:

Status: production-safe refresh bridge implemented; provider-backed realtime remains later.

The app shell now:

- refreshes the authoritative workspace when a signed-in member returns to a visible tab
- refreshes when the browser comes back online
- polls conservatively while visible so inbox, message, proposal, contract, notification, and billing state do not require a full reload
- exposes a manual topbar refresh control with last-sync status
- avoids write amplification by distinguishing authoritative server snapshots from member-authored edits

Remaining work:

- live message updates
- typing state
- proposal status updates
- push-style inbox refresh without polling

### 11. Email and outbound system events

Status: worker-authenticated mail smoke telemetry and `/admin/readiness` evidence checks are implemented; live provider setup remains.

Mail transport can now be proven with `npm run operations:mail-smoke -- --to-email <monitored-inbox>`, which records `mail.smoke` delivery rows for `/admin/operations` and `/admin/readiness`.

Provider-backed template names now exist in source for intro received, intro accepted, proposal received, signature required, and billing state change. Optional relationship workflow emails are now gated by a member preference in `/app/settings` and include a signed preference-management footer plus `List-Unsubscribe` header when sent; scheduled digests keep their separate opt-in, signed footer, and header. Remaining work is SMTP/provider verification, provider-level suppression handling, and host-side scheduling or queue processing.

## Backend Contract Status

The backend now exposes the inbox read model from the persisted member foundation. Future server work should keep extending this path instead of creating another inbox contract.

Implemented endpoints:

- `GET /api/inbox`
  - returns counts plus ordered action items for the signed-in user
- `GET /api/inbox/requests`
  - returns pending inbound and outbound connect requests
- `GET /api/inbox/conversations`
  - returns unread conversation summaries
- `GET /api/inbox/proposals`
  - returns proposal items that need the user’s response
- `GET /api/inbox/contracts`
  - returns contract items needing signature or revision
- `GET /api/inbox/notifications`
  - returns unread operational notifications
- `POST /api/inbox/notifications/:id/read`
  - marks an operational notification as read

Recommended response shape for `GET /api/inbox`:

```ts
interface InboxActionItem {
  id: string
  kind: "intro" | "message" | "proposal" | "contract" | "notification"
  priority: "high" | "medium" | "low"
  title: string
  summary: string
  href: string
  createdAt: string
  badgeLabel: string
  badgeTone: "accent" | "warning" | "neutral" | "success" | "danger"
}

interface InboxSnapshot {
  counts: {
    pendingIntros: number
    waitingOnReplies: number
    unreadConversations: number
    proposalsNeedingResponse: number
    contractsNeedingSignature: number
    unreadNotifications: number
  }
  actions: InboxActionItem[]
}
```

## Prompt For Server AI

Use this prompt for the server-side implementation agent:

```text
Continue CoFoundry's backend productionization from the new persisted member foundation.

Context:
- The frontend now has a real persisted member foundation:
  - Supabase-backed credential auth on the Nuxt server
  - persisted member state for user/profile/subscription/bookmarks/saved searches/opportunities
  - `/api/workspace` and `/api/workspace/member`
- The collaborative workflow now persists through server routes in Supabase mode and durable local mock/access-request mode.
- The app route `/app/inbox` is now the primary action surface for intros, unread messages, proposal responses, contract signatures, and unread operational notifications.
- Inbox read endpoints already exist:
  - GET /api/inbox
  - GET /api/inbox/requests
  - GET /api/inbox/conversations
  - GET /api/inbox/proposals
  - GET /api/inbox/contracts
  - GET /api/inbox/notifications
  - POST /api/inbox/notifications/:id/read

Make the backend the source of truth for these remaining entities:
- users
- connect_requests
- matches
- conversations
- messages
- proposals
- proposal_versions
- proposal_comments
- contracts
- contract_versions
- signatures
- relationship_decisions
- notifications
- reports
- admin_actions

Required backend work:
1. Persist the collaborative workflow entities above in Supabase-backed tables and server routes.
2. Keep inbox-focused read models aligned with `front-end/shared/utils/inbox.ts`.
3. Enforce auth server-side and return only the signed-in member's data.
4. Continue computing:
   - pending inbound intros
   - pending outbound intros
   - unread conversation summaries
   - proposals where the latest version/status now requires the member's response
   - contracts where the current version still needs the member's signature
   - unread notifications
5. Return an `InboxSnapshot` shape matching `front-end/shared/utils/inbox.ts`.
6. Add mutation endpoints for:
   - send / accept / decline connect requests
   - create conversations / messages
   - mark conversations read
   - create / update proposals and proposal comments
   - create / update contracts and signatures
7. Add tests for:
   - unread message queue behavior
   - connect request accept / decline transitions
   - proposal response detection
   - contract signature detection
   - notification ordering and read-state transitions
   - auth enforcement
8. Document any schema or migration work required.

Important constraints:
- Keep the new persisted member foundation in place; extend it instead of replacing it.
- Keep the current product behavior unchanged for mock mode unless the new backend path is explicitly enabled.
- Server-side roles and ownership checks must be enforced.
- Prefer composable query helpers over one large endpoint file.
- Make the ordering deterministic and newest-first inside each priority band.
- Preserve the current guarded billing path.

Frontend files already prepared for this next step:
- `front-end/shared/utils/inbox.ts`
- `front-end/src/pages/app/inbox.vue`
- `front-end/src/stores/workspace.ts`
- `front-end/server/api/inbox.get.ts`
- `front-end/server/api/workspace.get.ts`
- `front-end/server/api/workspace/member.post.ts`
```

## Manual Setup Still Needed

These items still need to be provisioned outside the repo:

### Required for real accounts and persistence

- Supabase project
- Supabase URL
- Supabase anon key
- Supabase service role key
- applied schema and RLS policies
- a production `SESSION_SIGNING_SECRET`

### Required for real billing later

- Stripe account
- Stripe product and price IDs
- Stripe secret key
- Stripe webhook secret
- webhook endpoint registration

### Required for real email and support

- transactional email provider
- support inbox or helpdesk destination
- domain and sender verification

### Required for production operations

- error monitoring
- structured logging destination
- alert webhook destination if worker-reported warning/error events should page or notify operators
- backup / restore plan
- documented first-admin bootstrap script
- deployment secret store / Vault wiring

### Required decisions

- canonical production auth mode
- whether self-serve sign-up is open at launch
- whether the first production admin is bootstrapped by email or by user id
- support ownership and SLA
- Stripe go-live timing
