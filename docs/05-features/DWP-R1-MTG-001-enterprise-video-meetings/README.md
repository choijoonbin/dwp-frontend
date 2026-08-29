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
Gateway /api/meetings/**
        |
        v
dwp-meeting-server ---- PostgreSQL dwp_meetings
        |                     |
        |                     +-- meeting, membership, policy, audit, artifact metadata
        |                     +-- durable media commands, webhook inbox, intelligence lifecycle
        v
LiveKit provider port ---- LiveKit SFU / TURN ---- signed webhook
        |
        +-- governed transcript source ---- internal Agent ---- attested managed model
        |
        +-- Egress -> KMS-encrypted object storage (production enablement gate)
```

Media bytes do not belong in PostgreSQL. The database stores control-plane
state and artifact metadata only. LiveKit tokens are generated server-side,
short-lived, tenant-scoped, and withheld while a participant is waiting for
admission.

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
- Bounded, signature-verified LiveKit webhook ingestion with replay protection,
  tenant/meeting/participant/incarnation binding, and provider-authoritative attendance.
- Governed transcript-to-intelligence runs with workload assertions, provider-policy
  attestations, cited summaries, topics, decisions, action candidates, open questions,
  risks, and meeting-level conversation climate. Raw transcript and provider payloads
  are not persisted or logged.
- Human review and explicit publication. A delegated reviewer may review a draft, while
  generation and publication remain host-only; recap reads only the latest authorized
  published report.
- An administrator-only AI and data-governance readiness surface. It reports policy,
  provider liveness, processing region, KMS, audit, Egress, storage, STT, recent model
  execution, retention, and deletion evidence without granting meeting-content access.
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
- Egress workers, encrypted object storage, consent, retention, legal hold, and deletion evidence.
- WCAG-conformant live captions, streaming STT, editable transcript, and
  human-reviewed AI summary.
- Executable retention, legal-hold, deletion, and deletion-evidence workers for
  meeting, attendance, audit, and future artifact data.
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
