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

Status: started in this pass.

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
  - `buildInboxSnapshot()`
  - `getUnreadConversationsForUser()`
  - `getProposalsNeedingResponse()`
  - `getContractsNeedingSignature()`
  - `getPendingIncomingConnectRequestsForUser()`
  - `getPendingOutgoingConnectRequestsForUser()`

### 2. Real persisted workspace state

Next after inbox.

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

- user role claims
- admin role enforcement
- audit log persistence
- suspend / reinstate
- report review / resolve
- bootstrap admin creation path

### 4. Production billing path

Keep Stripe guarded until ready, but finish the real path cleanly:

- checkout session creation
- webhook handling
- subscription sync
- entitlement enforcement on the server

## Next

### 5. Relationship workspace

The current product still spreads one live relationship across matches, messages, proposals, and contracts.

The next user-facing consolidation should be:

- `/app/relationships/[id]`

That route should unify:

- counterpart summary
- trust and alignment state
- latest messages
- current trial
- active proposal
- active contract
- next required action

### 6. Production-grade onboarding

Replace seed-first assumptions with a stricter activation path:

- minimum profile
- trust-critical profile completion
- first recommended intro
- inbox-first follow-through

### 7. Operational notifications

Move notifications from passive badges into server-owned operational events:

- `match.created`
- `message.unread`
- `proposal.updated`
- `contract.signature_required`
- `report.reviewed`
- `subscription.changed`

## Later

### 8. Realtime

After persistence is stable:

- live message updates
- typing state
- proposal status updates
- inbox refresh without reload

### 9. Email and outbound system events

- intro received
- intro accepted
- proposal received
- signature required
- billing state change

### 10. Relationship analytics

- intro response rate
- time to first reply
- time from match to proposal
- time from proposal to signed agreement
- paid conversion tied to actual workflow use

## Backend Contract To Build Next

The backend should expose a real inbox resource with the same conceptual model the front-end now uses.

Recommended endpoints:

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
Implement the real backend support for CoFoundry's inbox and action queue.

Context:
- The front-end already has a shared inbox contract in `front-end/shared/utils/inbox.ts`.
- The app route `/app/inbox` is now the primary action surface for intros, unread messages, proposal responses, contract signatures, and unread operational notifications.
- The current front-end still derives this from local workspace state. Replace that with real persisted server-backed data.

Build the backend as if it is the source of truth for these entities:
- users
- profiles
- connect_requests
- matches
- conversations
- messages
- proposals
- proposal_versions
- contracts
- contract_versions
- signatures
- notifications

Required backend work:
1. Add inbox-focused read models and endpoints:
   - GET /api/inbox
   - GET /api/inbox/requests
   - GET /api/inbox/conversations
   - GET /api/inbox/proposals
   - GET /api/inbox/contracts
   - GET /api/inbox/notifications
   - POST /api/inbox/notifications/:id/read
2. Enforce auth server-side and return only the signed-in member's data.
3. Compute:
   - pending inbound intros
   - pending outbound intros
   - unread conversation summaries
   - proposals where the latest version/status now requires the member's response
   - contracts where the current version still needs the member's signature
   - unread notifications
4. Return an `InboxSnapshot` shape matching the front-end contract.
5. Add tests for:
   - unread message queue behavior
   - proposal response detection
   - contract signature detection
   - notification deduping / ordering
   - auth enforcement
6. Document any schema or migration work required.

Important constraints:
- Keep the current product behavior unchanged for mock mode unless the new backend path is explicitly enabled.
- Server-side roles and ownership checks must be enforced.
- Prefer composable query helpers over one large endpoint file.
- Make the ordering deterministic and newest-first inside each priority band.
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
- backup / restore plan
- bootstrap admin user creation path
- deployment secret store / Vault wiring

### Required decisions

- canonical production auth mode
- whether self-serve sign-up is open at launch
- admin bootstrap method
- support ownership and SLA
- Stripe go-live timing
