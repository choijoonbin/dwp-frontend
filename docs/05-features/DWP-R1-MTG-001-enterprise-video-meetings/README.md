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
        v
LiveKit provider port ---- LiveKit SFU / TURN
                              |
                              +-- Egress -> encrypted object storage (future controlled rollout)
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
- Tenant policy and operations surfaces.
- Responsive and keyboard-accessible Korean and English UI.

External guest and join-before-host controls are deliberately unavailable. Their
schema defaults are fail-closed until verified guest identity, one-time invitation,
abuse protection, and complete audit evidence exist end to end.

### Production enablement gates

The following are not represented as complete until their infrastructure and
governance gates pass:

- TLS/WSS, TURN/TLS, Redis HA, multi-node routing, and regional capacity tests.
- Private service networking plus rotatable workload identity or short-lived signed
  request context; the local static service token is not the production trust model.
- Durable provider-operation receipts and reconciliation for room create/end so
  LiveKit and PostgreSQL cannot remain divergent after a partial failure.
- Signed LiveKit webhook inbox, retry/DLQ, and periodic provider reconciliation.
  Client `connected`/`leave` acknowledgement is useful UX telemetry, but is not the
  authoritative attendance record without provider events and reconciliation.
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

## Evidence

- [WEHAGO meeting creation and lookup](https://wehagohelp.zendesk.com/hc/ko/articles/900002551563--%ED%99%94%EC%83%81%ED%9A%8C%EC%9D%98-%EC%84%9C%EB%B9%84%EC%8A%A4-%EA%B8%B0%EB%B3%B8%EA%B8%B0%EB%8A%A5%EC%95%88%EB%82%B4-%EC%83%9D%EC%84%B1-%EB%B0%8F-%EC%A1%B0%ED%9A%8C)
- [WEHAGO in-meeting capabilities](https://wehagohelp.zendesk.com/hc/ko/articles/900005775346-%ED%99%94%EC%83%81%ED%9A%8C%EC%9D%98-%EC%83%81%EC%84%B8-%EA%B8%B0%EB%8A%A5)
- [Zoom participant and host controls](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065566)
- [Google Meet control layout](https://support.google.com/meet/answer/10550593)
- [LiveKit distributed deployment](https://docs.livekit.io/transport/self-hosting/distributed/)
- [LiveKit webhooks and media lifecycle](https://docs.livekit.io/intro/basics/rooms-participants-tracks/webhooks-events/)
- [LiveKit composite recording](https://docs.livekit.io/transport/media/ingress-egress/egress/composite-recording/)
