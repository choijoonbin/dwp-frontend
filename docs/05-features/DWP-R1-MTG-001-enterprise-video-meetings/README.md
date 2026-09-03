# DWP Enterprise Video Meetings

## Product intent

DWP Video Meetings is the formal meeting product for scheduled, governed, and
reviewable collaboration. Messenger keeps a lightweight `QUICK_HUDDLE` entry;
this app owns `FORMAL_MEETING` lifecycle, invitations, waiting-room decisions,
host authority, tenant policy, and post-meeting records.

The product is not a visual clone of Zoom or WEHAGO Meet. It combines:

- Zoom-grade host and waiting-room controls.
- Google Meet's low-friction pre-join and stable control placement.
- WEHAGO's organization, messenger, calendar, and meeting-record continuity.
- Butter's agenda-to-recap flow for outcome-oriented sessions.
- DWP's tenant isolation, delegated administration, audit, and follow-up actions.

## User surfaces

| Surface      | Purpose                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| Meeting home | Start now, schedule, join by code, and see the next useful action.                   |
| My meetings  | Review upcoming, live, hosted, and completed meetings.                               |
| Records      | Find attendance, notes, decisions, and governed artifacts.                           |
| Join         | Resolve a meeting code, request admission, and run device checks.                    |
| Meeting room | Publish media, share a screen, chat, react, raise a hand, and leave safely.          |
| Operations   | Monitor provider readiness and meeting lifecycle without reading content.            |
| Policy       | Govern external access, waiting rooms, recording, AI notes, retention, and capacity. |

## Architecture boundary

```text
DWP web /meetings
        |
        v
Gateway public /api/meetings/v1/**
        |
        v
dwp-meeting-server ---- PostgreSQL dwp_meetings
        |                     |
        |                     +-- meeting, membership, policy, audit, artifact metadata
        |                     +-- durable media commands, webhook inbox, intelligence lifecycle
        v
LiveKit provider port ---- LiveKit SFU / TURN ---- signed webhook
        |
        +-- trusted recording finalize ---- short-lived playback ticket
        |
        +-- governed transcript source ---- internal Agent ---- attested managed model
        |
        +-- fenced deletion broker ---- object delete / crypto-shred evidence
        |
        +-- Egress / STT -> KMS-encrypted object storage (production enablement gate)
```

Media bytes do not belong in PostgreSQL. The database stores control-plane
state and artifact metadata only. LiveKit tokens are generated server-side,
short-lived, tenant-scoped, and withheld while a participant is waiting for
admission.

The browser-facing contract is the versioned public `/api/meetings/v1/**`
surface. Provider callbacks and trusted artifact-ingest/finalize paths are
separate service-to-service boundaries; provider credentials, object keys, and
raw transcript bodies never cross the public API. Recording playback is granted
only through a short-lived, artifact/version-bound ticket after the caller's
current membership and content ACL, retention, legal-hold, and artifact state
are re-evaluated.

Meeting users and meeting administrators have separate content boundaries:
users see only content authorized by the meeting membership and artifact ACL;
`MEETING_ADMIN` can operate policy, readiness, capacity, and deletion evidence
without acquiring recording, transcript, chat, or recap content access. Any
future compliance/content-custody access is a separately scoped, case-bound
role with explicit evidence.

## Delivery scope

### Implemented foundation

- Independent meeting service, database, app entitlement, and administrator role.
- DB-backed SKAX meeting schedule, participants, policy, history, and audit data.
- Instant, scheduled, and code-based entry flows.
- Organizer, co-host, presenter, and attendee role model for authenticated workforce members.
- Waiting-room request and host admission boundary.
- LiveKit pre-join, immersive room entry, localized media controls, screen sharing,
  ephemeral in-room chat, reactions, and hand raise.
- Explicit, short-lived LiveKit room grants for publish, subscribe, data, and allowed
  media sources. The API returns effective permissions after tenant policy is applied.
- Directory-backed participant search, live participant/media-state panel, connected
  acknowledgement, and graceful leave/rejoin states.
- Durable room start/end commands with lease reclaim, fenced completion, bounded retry,
  and rolling migration from legacy room names to incarnation-bound rooms.
- Durable recording start/stop commands with a governed provider port, idempotent
  receipts, crash reclaim, lease fencing, immutable actor/reason provenance for
  `START`/`STOP`, and provider I/O outside database locks.
- Trusted recording finalization verifies a signed service assertion and the
  tenant/meeting/session binding, object digest, byte length, content type,
  encryption, region, retention, and ACL before an artifact becomes available.
  Finalization is not a browser-authorized mutation and never stores raw media
  or provider response bodies in audit history.
- Playback uses a short-lived HTTPS access ticket bound to the current artifact
  version and retention boundary; expired, stale, held, deleted, or unauthorized
  artifacts do not receive a URL.
- Bounded, signature-verified LiveKit webhook ingestion with replay protection,
  tenant/meeting/participant/incarnation binding, and provider-authoritative attendance.
- Signed transcript artifact registration and finalization bound to tenant, meeting,
  recording, consent, region, retention, object hash, and replay-safe workload identity.
  Transcript text and provider response bodies are never stored in command or audit rows.
- Governed transcript-to-intelligence runs with workload assertions, provider-policy
  attestations, cited summaries, topics, decisions, action candidates, open questions,
  risks, and meeting-level conversation climate. Raw transcript and provider payloads
  are not persisted or logged.
- Human review and explicit publication. A host can assign or revoke an eligible,
  admitted participant as an independent reviewer; the draft requester cannot review
  or manage that draft. Generation, review, and publication remain distinct audited
  actions, and recap reads only the latest authorized published report.
- An administrator-only AI and data-governance readiness surface. It reports policy,
  provider liveness, processing region, KMS, audit, Egress, storage, STT, recent model
  execution, retention, and deletion evidence without granting meeting-content access.
- Recording and transcript source objects use durable, leased, compare-and-set
  deletion commands. Provider I/O runs outside the database transaction; current
  fence, unexpired lease, immutable object identity, and deletion/crypto-shred
  receipt are revalidated before metadata can be cleared or completion evidence
  can be committed. Legal hold, stale workers, failed or stale broker health, and
  overdue retention backlog keep recording start, transcript registration and
  finalization, and intelligence analysis fail-closed.
- Tenant policy and operations surfaces.
- Responsive and keyboard-accessible Korean and English UI, including 320 px layouts,
  mobile overlay focus containment, 200% zoom-equivalent layouts, dark mode, forced
  colors, and reduced motion.

External guest and join-before-host controls are deliberately unavailable. Their
schema defaults are fail-closed until verified guest identity, one-time invitation,
abuse protection, and complete audit evidence exist end to end.

### Production enablement gates

The following are not represented as complete until their infrastructure and
governance gates pass:

- TLS/WSS, TURN/TLS, Redis HA, multi-node routing, and regional capacity tests.
- Private service networking plus rotatable workload identity or short-lived signed
  request context; the local static service token is not the production trust model.
- Deployment registration and monitoring of the signed LiveKit webhook endpoint,
  provider-event lag and replay alarms, operational reconciliation, and proof that all
  `vm_meeting_media_upgrades` rows reached `SUCCEEDED`. Client `connected`/`leave`
  acknowledgement remains UX telemetry and never replaces provider evidence.
- Live Egress workers, KMS-encrypted object storage, governed STT callbacks, consent,
  retention, legal hold, and deletion evidence in the target tenant and region. The
  code adapter alone does not satisfy this gate.
- Trusted recording-finalize delivery, playback-ticket enforcement, and immutable
  `START`/`STOP` provenance in the deployed audit sink.
- WCAG-conformant live captions, streaming STT, editable transcript, and
  human-reviewed AI summary.
- Real broker execution against each approved object store and KMS, including
  provider-side object-not-found/idempotency behavior, envelope-key destruction,
  legal-hold preservation, backup/replica expiry, and independently retrievable
  deletion evidence. The code-level recording and transcript deletion workflows do
  not by themselves prove storage-level deletion or crypto-shred; that evidence is
  an explicit production NO-GO.
- A live broker heartbeat must attest customer-managed storage, provider retention
  disabled, bounded orphan cleanup, delete and crypto-shred capabilities, and the
  configured maximum orphan TTL. Missing configuration, stale heartbeat, or a failed
  deletion receipt keeps artifact registration/finalization and downstream analysis
  unavailable; a local adapter or mock capability never opens this gate.
- Executable retention and deletion coverage for attendance, audit, search/index,
  cache, backup, and any future derived artifact that is outside the recording and
  transcript source-object workflows.
- Verified external guest identity/invitation and governed join-before-host entry.
- Governed co-host delegation and revocation, participant removal, request-to-mute,
  return-to-lobby, and bulk admission controls with provider-side enforcement.
- Breakout rooms, polling, whiteboard, SIP/PSTN, webinar, and live streaming.
- 100+ participant load, degraded-network, browser, mobile, and accessibility certification.

Code-level readiness is intentionally not the same as production readiness. With the
default disabled providers, recording, transcription, and AI remain blocked. The
management surface must continue to show `CONNECTION_REQUIRED` or `NOT_VERIFIED` until
the deployment supplies current operational evidence.

## Evidence

- [WEHAGO meeting creation and lookup](https://wehagohelp.zendesk.com/hc/ko/articles/900002551563--%ED%99%94%EC%83%81%ED%9A%8C%EC%9D%98-%EC%84%9C%EB%B9%84%EC%8A%A4-%EA%B8%B0%EB%B3%B8%EA%B8%B0%EB%8A%A5%EC%95%88%EB%82%B4-%EC%83%9D%EC%84%B1-%EB%B0%8F-%EC%A1%B0%ED%9A%8C)
- [WEHAGO in-meeting capabilities](https://wehagohelp.zendesk.com/hc/ko/articles/900005775346-%ED%99%94%EC%83%81%ED%9A%8C%EC%9D%98-%EC%83%81%EC%84%B8-%EA%B8%B0%EB%8A%A5)
- [Zoom participant and host controls](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065566)
- [Google Meet control layout](https://support.google.com/meet/answer/10550593)
- [LiveKit distributed deployment](https://docs.livekit.io/transport/self-hosting/distributed/)
- [LiveKit webhooks and media lifecycle](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
- [LiveKit composite recording](https://docs.livekit.io/transport/media/ingress-egress/egress/composite-recording/)
