# Acceptance Tests

## Access and isolation

- A user without `APP.MEETINGS:VIEW` cannot enter a meeting page or read its API.
- Every read and mutation is constrained by the authenticated tenant.
- An uninvited user cannot resolve an `INVITED_ONLY` meeting into sensitive detail.
- A waiting user receives no LiveKit token until admitted.
- A meeting administrator cannot read recording or transcript content by role alone.

## Lifecycle

- Instant creation returns one active meeting for a repeated idempotency key.
- Scheduling validates title, time order, capacity, access scope, and participant IDs.
- The organizer can start and end a meeting. Delegated co-host authority remains a
  production enablement gate until revocation and provider enforcement are complete.
- An attendee can leave but cannot end the meeting for everyone.
- Ending twice is safe and records one final lifecycle transition.
- Provider failure does not leave a meeting falsely marked live.
- Token issuance alone does not mark attendance as connected.
- Signed provider events and reconciliation converge missing disconnects before
  production attendance is treated as authoritative.

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
- Reduced motion and forced colors preserve meaning and focus visibility.

## Administration

- Policy saves are version-aware and reject stale updates.
- External join, recording, and AI-note controls are fail-closed when infrastructure is absent.
- External guest and join-before-host controls are not offered while their verified
  identity and invitation contracts are unavailable.
- Co-host delegation and participant moderation are not represented as complete
  until role revocation and provider-side removal/mute/lobby actions are enforced.
- Retention limits are validated and policy changes create audit evidence.
- Operations report provider readiness without exposing credentials or meeting content.

## Release gates

- Backend module tests, migration validation, and OpenAPI export pass.
- Frontend typecheck, lint, i18n, unit, bundle, and source-size checks pass.
- Playwright covers desktop and mobile scheduling, code join, waiting, and pre-join.
- A real browser verifies camera/microphone permission handling without auto-joining.
- Production promotion additionally requires TURN-only, node-drain, webhook replay,
  Egress failure, recovery, load, mobile, and WCAG 2.2 AA evidence.

## Revalidated local evidence (2026-08-27)

- Meeting, core production-readiness, and Gateway production-readiness test suites
  passed. Meeting repository and service files remain below the 700-line budget
  after query and creation responsibilities were extracted.
- The shared meeting API suite passed 9 assertions; focused ESLint, typecheck,
  architecture, source-size, and i18n gates passed. The Playwright meeting suite
  passed the four home, scheduling, admission, and governed-policy scenarios on
  both Chromium desktop and mobile projects, for 8 passing checks.
- The meeting OpenAPI export and frontend generated Gateway contract match the
  current 682-path backend contract.
- The meeting service restarted cleanly against the applied V17 migration and its
  health and runtime OpenAPI endpoints are up. PostgreSQL, Redis, Kafka, and local
  LiveKit are healthy.
- The independent `dwp-meetings` production bundle passed its entry, initial graph,
  request-count, and asynchronous chunk budgets.

The Node 24/Yarn 4 shared-workspace frontend typecheck is green. A fresh browser
navigation resolves the login policy and renders the company-email login form without
the earlier policy error. Authenticated meeting-room behavior is covered by the desktop
and mobile Playwright flows; a real-device camera, microphone, network-degradation, and
accessibility certification pass remains a production promotion gate and is not claimed
by this local evidence.
