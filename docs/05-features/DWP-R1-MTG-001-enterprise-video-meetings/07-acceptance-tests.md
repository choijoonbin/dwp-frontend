# Acceptance Tests

## Access and isolation

- A user without `APP.MEETINGS:VIEW` cannot enter a meeting page or read its API.
- Every read and mutation is constrained by the authenticated tenant.
- An uninvited user cannot resolve an `INVITED_ONLY` meeting into sensitive detail.
- A waiting user receives no LiveKit token until admitted.
- A meeting administrator cannot read recording or transcript content by role alone.
- Internal scope alone never grants meeting detail or recap access.
- Denied participants cannot recover meeting detail by guessing an identifier.
- Non-host participant projections omit other users' email, organization, job title,
  and exact admission or attendance timestamps.

## Lifecycle

- Instant creation returns one active meeting for a repeated idempotency key.
- Scheduling validates title, time order, capacity, access scope, and participant IDs.
- The organizer can start and end a meeting. Delegated co-host authority remains a
  production enablement gate until revocation and provider enforcement are complete.
- An attendee can leave but cannot end the meeting for everyone.
- Ending twice is safe and records one final lifecycle transition.
- Provider failure does not leave a meeting falsely marked live.
- Token issuance alone does not mark attendance as connected.
- When recording, transcription, or AI is requested, token issuance and connected
  acknowledgement both require the current notice revision to be acknowledged.
- Signed provider events and reconciliation converge missing disconnects before
  production attendance is treated as authoritative.
- Recording start and stop commit an idempotent receipt before provider I/O. An
  expired command can be reclaimed exactly once, a stale worker cannot complete it,
  and a provider failure cannot create a second recording session for the same key.
- Transcript registration and finalization require a replay-safe signed workload
  assertion and matching tenant, meeting, recording, consent, region, retention, and
  object digest. Neither endpoint accepts or stores transcript text.
- Recording finalization is accepted only through the trusted service boundary after
  a durable successful stop and immutable session provenance. Tenant, meeting,
  recording session, artifact, method, path, body digest, validity window, and replay
  identifier are all signed; a browser credential cannot finalize an artifact.
- Playback re-evaluates admitted membership, content ACL, artifact type/state/version,
  meeting end state, retention, and legal hold before issuing a short-lived HTTPS
  ticket. The public response, DOM, state, logs, and audit never expose a provider
  object key or durable storage URL.
- Expired recording and transcript source objects are claimed by durable leased
  deletion commands. Provider I/O occurs outside database transactions; crash reclaim,
  stale-worker fencing, legal hold, immutable object identity, broker failure, and
  deletion/crypto-shred receipt validation are covered before custody metadata is
  cleared.

## User experience

- Start, schedule, and code join are keyboard reachable from the first viewport.
- Pre-join starts with microphone and camera off and exposes device selectors.
- Screen share, chat, reactions, hand raise, and leave have accessible names.
- Scheduling resolves participants from the workforce directory instead of
  requiring internal numeric identifiers.
- The participant panel exposes current media and connection state without
  revealing provider identifiers as user-facing names.
- The destructive end-for-everyone action is visually and spatially separated.
- Desktop keeps a central stage and one secondary panel; mobile uses a full-height
  overlay without horizontal overflow.
- Loading, empty, forbidden, waiting, disconnected, and retry states are explicit.
- The live room continues to synchronize authoritative lifecycle state after media
  credentials are issued and disables collaboration when the meeting ends remotely.
- Ended meetings route directly to their recap; cancelled meetings never present a
  misleading prepare or join action.
- Reduced motion and forced colors preserve meaning and focus visibility.
- The home has one structurally dominant command surface; schedule and code join do
  not render as equal-width hero cards beside it.
- Zero or unavailable flow measurements are not presented as four KPI cells. Only
  meaningful signals are shown, otherwise an explicit quiet/empty state is rendered.
- Full-page visual regressions cover empty, next, live, provider-blocked, join,
  published-intelligence recap, and blocked/ready administration at representative
  desktop, tablet, 390 px, 320 px, dark, forced-colors, reduced-motion, Korean, English,
  and 200% zoom-equivalent states.
- Primary mobile actions expose at least a 44 by 44 CSS px pointer target, keyboard
  focus remains visibly at least 2 px, and neither `main` nor the document overflows.

## Administration

- Policy saves are version-aware and reject stale updates.
- External join, recording, and AI-note controls are fail-closed when infrastructure is absent.
- External guest and join-before-host controls are not offered while their verified
  identity and invitation contracts are unavailable.
- Co-host delegation and participant moderation are not represented as complete
  until role revocation and provider-side removal/mute/lobby actions are enforced.
- Retention limits are validated and policy changes create audit evidence.
- Operations report provider readiness without exposing credentials or meeting content.
- The management plane separates operations, policy, and AI/data governance. Missing
  Egress, storage, KMS, audit, STT, LLM, region, legal-hold, or deletion-evidence
  contracts are displayed as blocked or connection-required rather than ready.

## Meeting intelligence

- A run is idempotently bound to tenant, meeting, source transcript hash, current notice,
  consent snapshot, processing region, model, prompt version, and schema version.
- A missing or expired transcript, stale notice or consent snapshot, E2EE conflict,
  unavailable KMS/transcript source/Agent provider, region mismatch, provider training,
  or provider retention causes a fail-closed response and creates no report.
- Provider output is always `DRAFT`; only a human review of the current version can
  approve it, and only a separate action can publish it to meeting participants.
- The host can see eligible admitted participants, assign one independent reviewer,
  and revoke review authority. A nonparticipant, the current manager, or the user who
  requested the draft is rejected; a stale report version never changes authority.
- Every summary, topic, decision, action, question, risk, and non-insufficient climate
  signal contains an in-range citation to a supplied transcript segment.
- A provider citation outside the transcript, unknown field, individual emotion field,
  or unstructured response is rejected without persisting the response body.
- Raw transcript and report payloads never enter audit events, API history, error text,
  or application logs. Stored report content is envelope-encrypted with tenant/report
  context and becomes unreadable after governed deletion.
- The published overview exposes approved topics, open questions, risks, and
  meeting-level conversation climate as well as summary, decisions, and actions.
  Individual sentiment, personality, health, productivity, or biometric inference is
  never derived or displayed.
- Raw transcript text is normalized only for the bounded Agent request and is not
  stored in command, audit, or intelligence result rows. Source-object deletion uses
  the trusted transcript broker; deployed object-store/KMS deletion evidence remains
  a production gate rather than an inferred success.

## Release gates

- Backend module tests, migration validation, and OpenAPI export pass.
- Frontend typecheck, lint, i18n, unit, bundle, and source-size checks pass.
- Playwright covers desktop and mobile scheduling, code join, waiting, and pre-join.
- Playwright also covers short-lived recording playback, provider failure/retry,
  expired retention, popup isolation, no durable URL leakage, and serious/critical
  accessibility findings.
- A real browser verifies camera/microphone permission handling without auto-joining.
- Production promotion additionally requires TURN-only, node-drain, webhook replay,
  Egress failure, recovery, load, mobile, and WCAG 2.2 AA evidence.

## Revalidated local evidence (2026-09-02)

- `:dwp-meeting-server:check` passed 357 tests with zero failures, errors, or skips;
  global backend source-size and service-boundary checks also passed. PostgreSQL tests
  cover recording prepare/provider-I/O/terminal separation, same-key provider-failure
  recovery, expired lease reclaim, stale-worker fencing, atomic terminal audit,
  transcript registration/finalization replay, reviewer separation of duties, stale
  reviewer version rejection, intelligence execution, retention fencing, authoritative
  webhook replay/order, lifecycle recovery, legacy-room migration, governed transcript
  deletion, V25 legacy custody quarantine, and production-constructor wiring. The
  retention/deletion security subset passed 42 PostgreSQL and invariant checks,
  including crash-after-provider-success receipt recovery after lease reclaim.
- A fresh Meeting service applied V25, started successfully, returned health `UP`, and
  exposed 44 public service OpenAPI paths with zero internal paths. Trusted recording
  and transcript finalization routes remain callable only on their service boundary and
  are excluded from the browser schema, while the reviewer-assignment projection is
  public. Backend export and the generated frontend
  contract match 722 public Gateway paths with zero internal paths. All 14 Meeting
  request-body `expected*Version` properties are required and reject
  omission rather than falling back to primitive zero.
- The Agent suite passed 262 tests with 26 environment-dependent PostgreSQL tests
  skipped; the two Meeting intelligence targets passed 30/30. Tests cover workload
  assertion replay, provider-policy attestation, strict cited output, unsupported
  climate rejection, and raw-content non-persistence. Agent compile and public OpenAPI
  checks passed.
- The frontend suite passed 313 files and 1,763 tests; Meeting plus its public API
  boundary passed 21 files and 114 tests. Node 24.19/Yarn 4 clean non-incremental
  typecheck, Meeting-scoped ESLint and Prettier, i18n, display dictionary, source-size,
  generated OpenAPI checks, source-size gate, and the canonical Node 24 production build
  passed on the shared release snapshot.
- A fresh Node 24 canonical Yarn server on an isolated port, without server reuse, ran
  48 Playwright checks across Chromium desktop and mobile: 24 core journeys, four
  governed intelligence/reviewer journeys, 16 exact visual regressions, and four
  recording-playback custody journeys. They cover home, scheduling, content planning,
  waiting/admission, stale join responses, pre-join, live-room accessibility, recap
  evidence, reviewer assignment/revocation, AI authorization fencing, recording-policy
  states, short-lived playback, provider failure/retry, retention expiry, popup opener
  isolation, and storage-location non-disclosure. The visual pass covers 320 px and
  390 px layouts, 200% zoom-equivalent flow, dark mode, forced colors, reduced motion,
  44 px action targets, overflow, and serious/critical axe violations (`0`).
- An unauthenticated real browser request to `/meetings/home` redirected to the sign-in
  boundary with the return URL intact. Authenticated media behavior was exercised with
  deterministic route contracts; real-device camera/microphone, TURN-only, packet-loss,
  100+ participant load, node-drain, regional failover, and WCAG certification remain
  production promotion gates and are not claimed by this local evidence.

The final mobile polish pass makes all three recap tabs fully visible at the tested
mobile widths while retaining the scrollable, keyboard-accessible tab contract. The
desktop and mobile recap E2E now reads a published AI report through the dedicated
projection and verifies its summary and cited decision before opening artifact custody.
