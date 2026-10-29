# Enterprise Mail production-readiness architecture

## Outcome

This document is both the implementation contract and the completion record for moving
DWP Mail from a governed sandbox experience to an operational enterprise-mail product.
A feature is complete only when its user journey, provider boundary, authorization
evidence, recovery path, telemetry, and automated verification are complete together.

DWP Sandbox remains a first-class deterministic adapter. Microsoft Graph and Gmail can
be enabled only when the customer's OAuth application, consent, callback, secret owner,
and domain policy are present. Missing external credentials are a deployment prerequisite,
never a reason to simulate a successful provider connection.

## Product contract

- Primary user: a member processing personal and authorized shared mail.
- Operational question: what needs action now, is the mailbox current, and can the next
  action be completed safely?
- Primary action: review a thread and apply a single or bulk lifecycle action.
- Page archetypes: command center for Home, list-detail for Inbox and shared mail,
  workflow for connection recovery and governed action proposals.
- Administrator: a Mail administrator configuring a provider, proving readiness,
  observing synchronization, and recovering failed work without seeing message content.

## Non-negotiable invariants

1. Every Mail request is bound to the selected product scope. Governed mutations also
   carry the authorization decision revision that the user reviewed.
2. Missing or stale authorization evidence fails closed. The client may re-evaluate and
   explicitly retry; it may not silently downgrade the request.
3. Provider credentials and tokens are represented only by approved secret references
   or encrypted subject credentials. They are never returned by Mail APIs or audit payloads.
4. A provider connection becomes `ACTIVE` only after a fresh readiness receipt proves
   adapter availability, required scopes, consent, credential access, and a successful check.
5. Synchronization is durable work. Network I/O does not run inside an administrator's
   database transaction, and a process crash cannot erase the accepted sync request.
6. Provider cursors advance only in the same transaction that materializes their
   messages. Reset, retry, and duplicate delivery are safe.
7. Each newly materialized inbound message creates one idempotent incoming-rule run.
   A rule can be retried without applying an action twice.
8. Attachments remain unavailable until malware/CDR and DLP decisions succeed. Missing
   scanners or policy owners fail closed.
9. A purge is not complete until local and provider deletion outcomes are recorded
   separately. Legal hold always takes precedence.
10. AI proposals are evidence-backed suggestions. A producer records model and policy
    revisions, source evidence hashes, expiry, and provenance. Execution still requires
    current user authorization and an owning destination adapter.
11. Home never describes “no account”, paused synchronization, or stale synchronization
    as healthy.
12. Search labels and behavior agree: “message content” means authorized body content is
    indexed and searched while preserving tenant, account, BCC, retention, and hold boundaries.

## Runtime topology

```text
Browser
  -> Gateway / product authorization snapshot
  -> Mail API
       -> command/outbox repositories
       -> provider connection and OAuth boundary
       -> durable sync jobs -> provider adapter -> message materializer
                                      |                 |
                                      |                 +-> incoming rule jobs
                                      |                 +-> search projection
                                      |                 +-> proposal producer input
                                      +-> subscription/webhook receipts
       -> Mail event stream -> browser query invalidation
       -> scanner/DLP owners -> attachment release receipt
       -> purge worker -> local receipt + provider receipt
```

### Provider boundary

`MailConnectorPort` remains provider-neutral. A production adapter declares exact
capabilities and implements readiness, delta synchronization, idempotent delivery, and
subscription renewal. OAuth state is single-use, short-lived, bound to tenant, actor,
connection, redirect target, and PKCE verifier. Webhook callbacks validate provider
signatures or challenges before they enqueue synchronization; they never directly mutate
Mail messages.

Adapters classify failures into authentication required, rate limited (with a typed
`Retry-After` instant), cursor reset required, temporarily unavailable, conclusively
rejected, or result unknown. Provider submission has three distinct outcomes:
`DELIVERED` is deterministic end-to-end delivery and is currently reserved for the DWP
Sandbox, `PROVIDER_ACCEPTED` means the provider accepted the request but recipient
delivery is unconfirmed, and `RESULT_UNKNOWN` requires reconciliation and is never
automatically replayed. A provider idempotency key is not rotated to disguise an
ambiguous result.

### Durable synchronization

```text
QUEUED ------> LEASED ------> SUCCEEDED
   ^              |
   |              +---------> DEAD_LETTER
   +--- RETRY_WAIT <----------+
```

Jobs are unique by connection/account and requested cursor generation. Leasing uses
database time, a bounded lease, worker identity, attempt count, and `next_attempt_at`.
Backoff respects provider `Retry-After`. Cursor reset creates an explicit new generation
and preserves the prior receipt for audit.

### Incoming rules

Materialization records the immutable message identity and enqueues a rule run in the
same transaction. The run snapshots rule order and versions. All actions in one run are
applied in a single database transaction, including the completion receipt; a failed
action rolls the run back and the durable worker retries the same snapshot. Disabled or
edited rules affect only future snapshots. Current rule actions are intentionally local
database mutations, so there is no partially committed external side effect to resume.

### Search

The searchable projection contains normalized subject, preview, authorized participant
text, and message body text. It is tenant/account scoped before text matching, uses a GIN
full-text index, and keeps the existing authorization predicate. Results use a stable
`latest_message_at, thread_id` cursor; bounded exact totals are optional and must not
force an unbounded duplicate count query.

### Governed proposals

Proposal production is an internal, authenticated owner contract. It accepts source
message identity, evidence hashes, model and prompt/policy revisions, proposed action,
risk, confidence, and expiry. It does not accept pre-authorized execution. Acceptance
re-evaluates source access and destination authorization, then writes a destination
handoff receipt. Unsupported destination owners remain visibly unavailable rather than
returning a synthetic success.

## User experience acceptance contract

### Home

- Distinguish `NO_ACCOUNT`, `ACTION_REQUIRED`, `PAUSED`, `STALE`, and `HEALTHY`.
- Show last successful synchronization and the freshness threshold.
- Offer the next valid action: connect, reconnect, resume, retry, or contact an administrator.
- Collapse empty proposal and focus areas so the first viewport exposes useful work.

### Inbox and shared mail

- Preserve lane, account, search, selected thread, and inspector state in the URL when
  return navigation benefits.
- Support selection across the loaded result set, clear it when scope changes, and show
  per-item success or failure for bulk operations.
- Bulk mutations use one user intent identifier plus one idempotency key per item. A
  partial failure never hides successful items and can retry only failed items. The
  original expected version is persisted with the item key so a lost-response replay
  has the exact same request fingerprint even after a background refetch.
- Provider or authorization result-unknown states are not presented as failure or success.

### Search

- Text fields use an editable draft and explicit Apply, or bounded debounce with URL
  replacement. Typing must not add one browser-history entry per character.
- Invalid date ranges are explained before a request is sent.
- Snippets identify the authorized matching field without exposing inaccessible BCC or body data.

### Accounts and preferences

- Account rows prioritize status, user impact, freshness, and the next action. Raw
  consent, scope, and error evidence is collapsed under diagnostic details.
- User-owned accounts offer reconnect; administrator-owned accounts offer an admin handoff.
- Preference edits track original and draft values. Refresh never silently overwrites a
  dirty draft, Save is enabled only for valid changes, and Discard is explicit.
- Tabs and other return-navigation state are URL-backed.

### Compose

- Pasted HTML is sanitized before insertion into the live editing DOM; remote resources
  cannot load during the interval before blur.
- Formatting controls expose pressed state and work with keyboard and screen readers.
- The editor uses an explicit document model or Selection/Range implementation rather
  than deprecated browser commands.

### Navigation and layout

- Primary Mail work stays visible; low-frequency folders and configuration may collapse
  without removing deep links.
- The first viewport at 1440 and 1280 px contains real work. Empty states do not reserve
  the same height as populated two-row layouts.
- 390 px, 320 px, 200% zoom, dark mode, forced colors, reduced motion, long Korean and
  English labels, and partial API failure are release gates.

## Observability and operations

Minimum Mail signals:

- synchronization queue age, provider lag, lease expiry, retry/dead-letter count, cursor
  reset count, and subscription expiry;
- delivery queue age, attempt/result-unknown/failure rates, and provider latency;
- incoming-rule queue age, retry count, action failure code, and completion latency;
- scanner and DLP latency/failure/timeout, and quarantined attachment count;
- local/provider purge backlog and reconciliation mismatch;
- event-stream clients, reconnects, missed-event catch-up, and polling fallback;
- search latency and result count by bounded bucket, never raw query text.

Metrics use low-cardinality provider, state, and outcome tags. Tenant, user, account,
message, query, and error detail belong in access-controlled evidence, not metric tags.
Readiness fails when a required production owner is missing; liveness does not depend on
an external provider.

## Verification matrix

| Layer                  | Required evidence                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit                   | state transitions, sanitization, accessible names, request evidence, retry classification                                |
| PostgreSQL             | isolation, cursor atomicity, rule idempotency, body match, lease recovery, purge receipts                                |
| Contract               | public operations mapped to generated types; scope and decision revision present when required                           |
| Browser fixture        | loading, empty, partial, error, keyboard, responsive, theme, and recovery journeys                                       |
| Vertical sandbox       | browser -> Gateway -> Platform -> PostgreSQL -> worker for send, receive, search, rules, shared access, and denial       |
| Provider certification | Graph/Gmail consent, delta/reset, throttling, webhook renewal, replay, attachment, and revoke in a non-production tenant |
| Performance            | initial JS, transition time, CLS, 100k-thread search plan, queue throughput, and worker recovery                         |

Mocked browser tests remain useful for deterministic failure paths but do not replace the
vertical sandbox gate. Provider certification is separate because it requires
customer-owned applications and credentials.

### Repository verification evidence (2026-10-28)

- Platform Mail: 67 suites / 315 tests passed in an isolated worktree; the Platform security
  filter added 32 passing tests.
- Provider delivery, purge, synchronization materialization, and HTTP boundaries: 6 suites /
  40 tests passed.
- Browser Mail unit/integration: 53 files / 219 tests passed; shared Mail API/contract tests:
  9 files / 52 tests passed.
- Gateway contract: 118 Mail operations, including SSE and catch-up, generated and checked by
  the approved exporter; its 47 tests and the 12-service / 1,769-path consistency check passed.
- Browser journeys: the final full run produced 88 passes and 3 intentional skips. Its sole
  failure exposed a dirty-preference-draft/live-refetch race; after the fix, the same scenario
  passed on desktop and mobile (2/2). Visual baselines passed for desktop and mobile, including
  200% reflow, 320 px, dark mode, and forced colors.
- Mail-scoped TypeScript, ESLint, API-boundary, production-reachability, i18n parity, CI workflow,
  and `git diff --check` gates passed. Whole-repository type checking still reports unrelated
  concurrent Calendar, Activity, Notification, HRIS, Messaging, Rooms, and Workplace errors.

## Rollout and recovery

1. Ship correctness fixes and authorization evidence while Sandbox is the only enabled provider.
2. Enable durable sync and incoming rules for Sandbox; prove replay, lease recovery, and vertical flows.
3. Deploy scanner/DLP and provider adapters in shadow diagnostics. Connections stay
   non-active until fresh readiness receipts pass.
4. Enable Graph, then Gmail, by tenant allowlist. Monitor lag, rejection, result-unknown,
   and cursor reset thresholds.
5. Enable event streaming with polling fallback, then bulk operations and body search.
6. Enable proposal production in observe-only mode before any destination handoff.

Rollback suspends new leases and subscriptions but never rewinds materialized data or
deletes evidence. Existing leased jobs either finish within their lease or become
recoverable. Provider disablement changes the visible state immediately and offers the
correct recovery path.

## Implemented production-readiness increments

- Platform `V341` makes incoming-rule work durable and adds tenant-scoped body full-text
  search without indexing BCC.
- Platform `V370` adds sync jobs and fenced cursor generations, subscription receipts,
  verified webhook ingress, governed event streaming, scanner readiness, and recovery
  evidence.
- Platform `V371` separates provider acceptance, deterministic delivery, and ambiguous
  results, and records provider purge commands and receipts independently from local
  deletion.
- Platform `V372` binds proposal provenance to accessible source messages and persists
  exact per-item bulk-mutation fingerprints and successful outcome receipts.
- Notification `V38` registers the content-minimized `MAIL.ACTION_ESCALATED` owner
  contract and bilingual in-app templates.
- The browser implements governed Mail transport, authority-bounded live invalidation,
  route-local recovery, URL-backed search/preferences, exact bulk replay, account-health
  recovery, accessible selection and formatting, and responsive navigation.

The repository implementation is provider-ready, but two deployment gates remain external
to this change. Live Graph/Gmail certification requires customer-owned OAuth applications,
consent, callback and webhook registration, secret-broker ownership, and a non-production
tenant. Governed SSE also remains fail-closed until the central product-authorization bundle
publishes `route.mail.work.events.data` and
`route.mail.work.events-catch-up.data`. Those prerequisites are deliberately not replaced by
mock credentials, a synthetic successful connection, or a route authorization bypass.
