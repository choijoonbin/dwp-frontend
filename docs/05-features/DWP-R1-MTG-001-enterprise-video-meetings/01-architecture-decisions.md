# Architecture Decisions

## ADR-001: A separate meeting service owns formal meetings

**Decision:** Create `dwp-meeting-server` and `dwp_meetings` rather than extend
conversation-owned `msg_meeting_sessions`.

**Reason:** A formal meeting can exist before a conversation, recur, invite
external guests, wait for admission, produce governed artifacts, and survive a
messenger channel archive. It has a different workload and retention profile.

**Integration:** Calendar, Messenger, Space, and notification services exchange
opaque `meetingId` references and domain events. They do not query meeting tables.

## ADR-002: LiveKit is the media plane, not the product database

**Decision:** Keep the open-source LiveKit SFU and React client SDK. Wrap its room,
token, and termination APIs behind a provider port.

**Reason:** Reimplementing WebRTC routing, congestion control, TURN, simulcast,
screen sharing, and reconnect behavior is both unsafe and unnecessary. The DWP
service remains provider-abstracted for future managed or regional deployments.

## ADR-003: Admission precedes token issuance

**Decision:** A waiting participant receives no main-room token. The organizer or
co-host admits the membership first; only then may the service issue a short-lived
join credential.

**Reason:** A visual waiting screen without a token boundary is not a security
control. This design also permits denial, expiry, and audit before media access.

## ADR-004: Administrative authority does not imply content access

**Decision:** `MEETING_ADMIN` manages policy and operational health. Meeting
organizers and delegated co-hosts manage participants. Future compliance access
to recordings and transcripts requires a separate scoped role and evidence.

**Reason:** Tenant administration, host authority, and content custody are
different duties. Combining them creates unnecessary insider access.

## ADR-005: Recording and AI remain explicit controlled capabilities

**Decision:** Recording, transcription, and AI notes are capability states, not
decorative UI. When Egress, storage, consent, or STT is unavailable, the product
shows that limitation instead of generating pretend artifacts.

**Reason:** Recording changes privacy, retention, regional storage, eDiscovery,
and legal-hold obligations. AI notes are editable drafts with source timestamps,
never an authoritative record by themselves.

## ADR-006: Media authorization is an explicit, least-privilege grant

**Decision:** The meeting service issues short-lived LiveKit tokens with explicit
room join, publish, subscribe, data, and source grants. It derives those grants
from both the participant role and the current tenant policy, and returns the
effective permission contract to the client.

**Reason:** A product-level role name is not a media-plane authorization boundary.
Explicit grants keep disabled capabilities unavailable even when a client is
modified or stale.

## ADR-007: Provider events are the attendance authority

**Decision:** Token issuance and client acknowledgements do not author attendance.
The service accepts bounded, signature-verified LiveKit events into a replay-safe
inbox and applies them only when tenant, meeting, participant, provider room, and
room incarnation match. Client connected and leave calls acknowledge UX state only.

**Reason:** A browser can crash, lose connectivity, or omit a leave request.
Provider-originated events plus reconciliation are required for reliable attendance,
capacity, billing, and audit evidence.

## ADR-008: Unverified guest paths fail closed

**Decision:** External guest entry and join-before-host remain unavailable until
verified identity, scoped one-time invitations, expiry, rate limiting, revocation,
and audit evidence are delivered as one controlled flow.

**Reason:** A public code or display name alone is not sufficient identity for an
enterprise meeting. Hiding an unsafe path is preferable to presenting a control
that the backend cannot enforce.

## ADR-009: Provider lifecycle needs a durable operation boundary

**Decision:** Room create and end operations use a durable command receipt, lease
reclaim, provider I/O outside the database transaction, and fenced completion. V22
also migrates legacy live rooms through `MIGRATING`, token drain, target revalidation,
legacy cleanup, and `ACTIVE`; stale workers cannot finalize a reclaimed operation.

**Reason:** A LiveKit API call and a PostgreSQL transaction cannot commit atomically.
Durable receipts make partial failure recoverable and observable without holding a
database lock across provider I/O. Deployment reconciliation and migration completion
evidence remain operational release gates.

## ADR-010: Meeting intelligence is a governed draft lifecycle

**Decision:** A transcript-backed intelligence run produces an encrypted `DRAFT` report.
The provider cannot publish it. A host or explicitly granted reviewer verifies the
citations, approves a specific report version, and performs a separate publish action
before admitted participants can read it.

**Reason:** Model output can be incomplete or wrong. Source hash, notice revision,
consent snapshot, model, prompt, schema, region, payload hash, review, and publication
evidence must remain attached to the same immutable execution chain.

## ADR-011: The Agent receives normalized transcript evidence, not media custody

**Decision:** The meeting service keeps recording and transcript custody. It sends only
bounded, normalized transcript segments to the internal Agent endpoint over a dedicated
service identity. The request contains no object key or user identifier and requests
provider-side storage to be disabled. Both the Agent and meeting service validate the
strict output schema and every cited segment/time range.

**Reason:** This minimizes data movement, prevents the model provider from becoming the
system of record, and treats transcript text as untrusted data rather than instructions.
Missing credentials, approved region, no-training attestation, zero-retention attestation,
KMS, transcript source, or consent evidence makes the run unavailable.

The Meeting-to-Agent request uses a short-lived signed workload assertion bound to
method, path, body digest, tenant, meeting, run, issue/expiry time, and replay-unique
identifier. The Agent additionally requires a short-lived Ed25519 provider-policy
attestation containing provider, model, region, no-training, zero-retention, policy
digest, key identifier, and validity window. Neither a static token nor provider
self-report is sufficient for readiness.

## ADR-012: “Meeting atmosphere” excludes individual emotion inference

**Decision:** The report may describe only meeting-level alignment (`ALIGNED`, `MIXED`,
`CONTESTED`, or `INSUFFICIENT_EVIDENCE`) and cited constructive or unresolved
disagreement. It cannot claim balanced participation or a dominant monologue without
speaker/turn evidence. The contract has no person-level emotion, sentiment, personality,
health, biometric, or productivity-scoring field.

**Reason:** A transcript can support a reviewable description of discussion dynamics but
cannot justify surveillance claims about people. This boundary also avoids workplace
emotion-recognition patterns that create significant legal, privacy, and employee-trust
risk.

## ADR-013: Recording commands cross the provider boundary durably

**Decision:** Recording start and stop first commit an idempotent command receipt and
bounded lease. Provider HTTP runs after that transaction commits. A matching,
unexpired fence is required to commit the terminal session and audit projection;
expired work can be reclaimed, while its former worker cannot complete late.

**Reason:** Egress cannot participate in the PostgreSQL transaction. Holding a meeting
row lock across network I/O creates availability failures, while retrying an
unrecorded request can create duplicate captures. Durable receipts make both crash
recovery and operator evidence explicit without persisting provider payload bodies.

## ADR-014: Draft generation, review, and publication are separate duties

**Decision:** Reviewer assignment is projected from admitted meeting participants and
stored as report-scoped authority. The current report manager and the user who
requested generation are ineligible for review or management authority. Assignment,
revocation, review, and publication are separately authorized and audited.

**Reason:** A human-review label has no value when the same actor can generate,
self-approve, and publish unobserved. Report-scoped separation of duties turns review
into an enforceable product boundary while avoiding tenant-admin access to content.

## ADR-015: The browser contract is a versioned public surface

**Decision:** Expose meeting user and administrator operations only through the
public Gateway namespace `/api/meetings/v1/**`. Provider callbacks, recording
finalization, and other artifact-ingest operations use separate authenticated
service-to-service boundaries and are never treated as browser mutations.

**Reason:** A stable public contract can evolve independently from provider
protocols while keeping credentials, object keys, raw transcript bodies, and
trusted workload assertions out of the user-facing API. Every public read and
mutation re-evaluates tenant, membership/role, artifact ACL, retention, and
legal-hold state.

## ADR-016: Recording finalization is trusted, and playback is ticketed

**Decision:** A recording becomes `AVAILABLE` only after a signed trusted
finalization assertion proves the meeting/session binding and verifies object
digest, length, content type, encryption, region, retention, and ACL. Playback
returns only a short-lived HTTPS ticket bound to the artifact version and its
retention boundary; the ticket is denied for stale, held, deleted, expired, or
unauthorized artifacts.

**Reason:** A provider callback or stored URL alone does not prove that the
object belongs to this tenant or remains eligible for access. Version-bound
tickets limit replay and ensure each playback decision uses current content
custody policy without exposing provider credentials or durable URLs.

## ADR-017: START/STOP provenance is immutable

**Decision:** Recording `START` and `STOP` commands first create idempotent,
lease-fenced receipts, then append immutable provenance containing the actor or
service identity, reason, notice/consent and policy versions, command key,
aggregate/session version, timestamps, and outcome. Retries may add correlated
attempt evidence but cannot rewrite the original provenance or manufacture a
second terminal session.

**Reason:** Recording changes privacy and evidentiary state. An immutable chain
separates user intent, provider execution, and finalization while making stale
workers and late callbacks unable to alter the historical decision.

## ADR-018: Deletion uses leased CAS orchestration and crypto-shred readiness

**Decision:** Retention expiry or an approved deletion request transitions each
artifact lineage through a leased, compare-and-set (CAS) deletion workflow.
Workers claim bounded targets, re-check legal hold and current ACL/state, delete
source objects and derivatives in dependency order, and record per-target
evidence. Crypto-shred is a readiness control: destroying the envelope key is
allowed only after the governed target set is accounted for and the key
destruction receipt is durable; partial success remains incomplete.

**Reason:** Deletion spans object storage, transcript/index/embedding derivatives,
caches, and backups that do not share one transaction. Lease fencing prevents
duplicate or stale workers from closing a deletion, while CAS preserves legal
holds and concurrent state changes. Storage-level evidence for raw transcript
object deletion is not yet verified and therefore remains a production NO-GO.

## ADR-019: User content custody is distinct from administration

**Decision:** Meeting membership and artifact ACL govern user playback, transcript,
chat, and recap reads. `MEETING_ADMIN` is limited to policy, provider readiness,
capacity, retention/legal-hold state, and deletion evidence; it does not imply
content access. Compliance/content-custody access, if introduced, must be a
separate scoped, case-bound role with independent approval and audit evidence.

**Reason:** Operational authority and content custody are different duties.
Keeping them separate limits insider access and prevents aggregate operational
views from becoming an indirect content disclosure path.

## Runtime target

```text
public edge -> regional L4 load balancer -> LiveKit nodes
                              |               |
                              |               +-- UDP/ICE and WebRTC/TCP
                              +-- TURN/TLS 443

public `/api/meetings/v1/**` -> Meeting API -> PostgreSQL
            -> Kafka outbox/inbox
            -> LiveKit Server API
            -> signed webhook receiver
            -> internal Agent meeting-intelligence API

Egress pool -> trusted finalize -> KMS-encrypted S3-compatible storage
STT workers -> transcript object + searchable ACL metadata
Playback -> current ACL/retention check -> short-lived artifact ticket
Deletion workers -> leased CAS -> dependency deletes -> crypto-shred evidence
Agent runtime -> approved zero-retention model route -> strict cited JSON
```

Redis is mandatory for redundant LiveKit deployments. Nodes drain active rooms
before shutdown. Egress and STT run in separate worker pools so recording load
cannot destabilize interactive media.

### Local Docker media path

Docker Desktop development explicitly advertises `127.0.0.1` as the LiveKit
node IP and publishes UDP `7882` plus WebRTC/TCP `7881`. This prevents the browser
from receiving an unreachable container-network ICE candidate. It is a local-only
setting: production nodes must advertise a routable address and provide TLS/WSS,
TURN/TLS, load balancer, firewall, and regional failover evidence.

## Operational telemetry

- Join success and rejection reason.
- Pre-join to active-media latency.
- ICE path and TURN fallback ratio.
- RTT, jitter, packet loss, connection quality, and reconnects.
- Waiting-room age and admission latency.
- Webhook delivery and reconciliation lag.
- Recording and transcript readiness latency.
- Tenant, region, browser, and device dimensions without content bodies.
