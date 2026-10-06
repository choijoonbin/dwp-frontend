# SYS 상태·Guard·복구 결정표

## Access package assignment

| From | Command | To | Guard | Recovery |
|---|---|---|---|---|
| DRAFT | submit | PENDING_APPROVAL | exact package/scope/field refs, no static SoD | reject to DRAFT with reasons |
| PENDING_APPROVAL | approve | APPROVED | approver differs from author; package revision current | reject to DRAFT |
| APPROVED | activate | PENDING_PROJECTION | effective date and app entitlement projection plan | retry same receipt |
| PENDING_PROJECTION | projection receipts complete | ACTIVE | all expected revisions exactly applied | DEGRADED and deny leaf access |
| ACTIVE | suspend | SUSPENDED | authorized reason | reversible activation with new revision |
| ACTIVE/SUSPENDED | revoke/expire | REVOKED/EXPIRED | audit reason or clock | revoke projections and caches |

## Configuration version

| From | Command | To | Guard | Recovery |
|---|---|---|---|---|
| DRAFT | validate | VALIDATED | schema/reference/temporal checks | DRAFT + validation report |
| VALIDATED | simulate | SIMULATED | approved synthetic/tenant sample scope | keep immutable simulation receipt |
| SIMULATED | submit | PENDING_APPROVAL | impact report fresh | return to DRAFT |
| PENDING_APPROVAL | approve | APPROVED | four-eyes; SoD; step-up for critical | reject with reasons |
| APPROVED | schedule/publish | SCHEDULED/PUBLISHED | expected current version; no overlap | 409 and re-simulate |
| SCHEDULED | effective clock | PUBLISHED | dependency refs still valid | FAILED_ACTIVATION; prior version remains |
| PUBLISHED | rollback | PUBLISHED(new version) | approved prior version compatible | forward corrective publish |

## Automation run

### Automation definition version

| From | Command | To | Guard | Recovery |
|---|---|---|---|---|
| - | create version | DRAFT | immutable definition/execution-policy digests; signed handler; closed input and receipt schemas | reject before persistence |
| DRAFT | validate | VALIDATED | signature key trusted; handler allowlisted; compatibility baseline current | DRAFT + immutable validation evidence |
| VALIDATED | submit | PENDING_APPROVAL | approval workflow and subject revision pinned | return to DRAFT with reasons |
| PENDING_APPROVAL | approve | APPROVED | approver differs from author; current evidence digest | reject without changing version |
| APPROVED | activate | ACTIVE | approval receipt and CAS revision match | prior active version remains |
| ACTIVE | suspend/retire | SUSPENDED/RETIRED | no new leases; in-flight policy explicit | cancel or drain using run policy |

### Automation schedule

| From | Command | To | Guard | Recovery |
|---|---|---|---|---|
| - | create | DRAFT | pinned approved automation version; timezone; schedule expression; input-template ref/digest; concurrency-key template | reject malformed schedule |
| DRAFT | submit | PENDING_APPROVAL | immutable schedule snapshot | return to DRAFT |
| PENDING_APPROVAL | approve | APPROVED | four-eyes and current subject revision | reject with reasons |
| APPROVED | activate | ACTIVE | approved version remains executable; CAS revision | no fire; remain APPROVED |
| ACTIVE | suspend | SUSPENDED | authorized reason | due fires are suppressed |

| From | Signal | To | Guard | Recovery |
|---|---|---|---|---|
| QUEUED | lease | LEASED | concurrency key free, authority revision valid | lease expiry returns QUEUED |
| LEASED | start | RUNNING | signed handler/version and input digest | FAILED if handler unavailable |
| RUNNING | item/result | RUNNING/PARTIAL | per-item idempotency | failed items only retry |
| RUNNING | complete | SUCCEEDED/PARTIAL/FAILED | totals and output digest reconciled | immutable receipt |
| FAILED/PARTIAL | retry | QUEUED(new attempt) | retry budget/approval | DEAD_LETTER |
| QUEUED/LEASED | cancel | CANCELLED | cancellation policy and no irreversible side effect | compensation workflow otherwise |

Each run freezes `ALL_ITEMS` or `FAILED_ITEMS_ONLY`, the selected item identity digest, handler/version, authorization revision and concurrency key. A retry always creates a new run attempt and item attempts; it never resets successful rows. Checkpoints are monotonic per run, bound to the active attempt and lease-fence token, and record processed-item and output digests. A worker that loses its lease can resume only after the last committed checkpoint. Cancellation after a committed external effect cannot report success until the declared compensation path has its own idempotent receipt.

## Connector definition and mapping

| From | Command | To | Guard | Recovery |
|---|---|---|---|---|
| DRAFT | validate | VALIDATED | allowlisted endpoint policy; opaque secret ref; exact definition digest | DRAFT + validation evidence |
| VALIDATED | test/dry-run | TESTED/VALIDATED | pinned schemas and mapping digest; no business dispatch | immutable test receipt |
| TESTED/VALIDATED | submit | PENDING_APPROVAL | approval workflow and subject revision pinned | return with reasons |
| PENDING_APPROVAL | approve | APPROVED | approver differs from author; evidence current | reject without activation |
| APPROVED | activate | ACTIVE | CAS revision; definition and mapping versions compatible | prior active version remains |
| ACTIVE | suspend/retire | SUSPENDED/RETIRED | no new execution accepted | drain/reconcile in-flight executions |

## Connector execution

| From | Signal | To | Guard | Recovery |
|---|---|---|---|---|
| ACCEPTED | transform | TRANSFORMING | mapping version/schema/source digest | reject item with validation evidence |
| TRANSFORMING | dispatch | DISPATCHED | endpoint policy, secret ref, egress allowlist | retry without remapping drift |
| DISPATCHED | provider response | ACKNOWLEDGED/FAILED | provider receipt and idempotency key | poll/retry with same provider key |
| ACKNOWLEDGED | reconcile | RECONCILED/PARTIAL | source/target count/totals/digest | exception queue |
| FAILED/PARTIAL | retry | ACCEPTED(new attempt) | mapping/definition version pinned | DEAD_LETTER |

`RESULT_UNKNOWN` is a durable state, never an implicit failure. Reconciliation uses the original provider idempotency key plus provider receipt ref/digest and exact source/accepted/rejected counts. `FAILED_ITEMS_ONLY` freezes only retryable rejected item identities into new attempts. Cancellation is permitted before dispatch; after dispatch it requires the connector's explicit compensation contract, otherwise the execution stays reconcilable and an operational exception is raised.

## Extension pack and tenant installation

| From | Command | To | Guard | Recovery |
|---|---|---|---|---|
| DISCOVERED | verify | VERIFIED | closed manifest; manifest/signature/compatibility/hook/schema/license/permission digests all pass | remain DISCOVERED with immutable failure evidence |
| VERIFIED | approve | APPROVED | approver differs from discoverer and verifier; verification evidence current | reject with reasons |
| APPROVED pack | request installation | REQUESTED | tenant entitlement; pinned pack version; configuration digest | idempotent original receipt |
| REQUESTED | submit/approve | PENDING_APPROVAL/APPROVED | requester differs from approver; CAS revision | reject without install |
| APPROVED | install | INSTALLED_DISABLED | pack still approved; installer separation; compatibility rechecked | FAILED and no executable code |
| INSTALLED_DISABLED | enable | ENABLED | explicit enable actor; permissions granted within approved manifest | remain disabled |
| ENABLED | suspend | SUSPENDED | authorized reason | invalidate capabilities and explorer projection |
| APPROVED pack or installation | revoke | REVOKED | audit reason and CAS revision | disable every affected tenant installation |

Unknown manifest properties, untrusted signatures, incompatible runtime ranges, undeclared hooks, invalid schemas, unaccepted licenses and permissions outside the approved manifest fail closed. Pack revocation is monotonic and cascades executable-state invalidation; replay cannot re-enable a revoked version.

## Home contribution

`CURRENT`, `STALE`, `DEGRADED`, `UNAVAILABLE`, `NOT_ENTITLED`, `EMPTY`를 구분한다. stale data로 high-impact command를 실행하지 않으며 deep link에서 owner service가 다시 권한·version을 검사한다.

## Controlled file transfer

| From | Signal | To | Guard | Recovery |
|---|---|---|---|---|
| - | request | REQUESTED | canonical `transferKind`; tenant, purpose, classification, allowlisted owner; trusted object-store version/ETag/digest/byte-size/media snapshot; signed CLEAN scan bound to the same digest/size; expiry; idempotency | same key+full metadata snapshot digest returns original receipt; mismatch is 409 |
| REQUESTED | scanner lease | SCANNING | object reference is opaque; worker identity and lease valid | expired lease is safely retried |
| SCANNING | clean/not-required | READY | object version+ETag+digest+size+media exactly match the atomic metadata snapshot; policy permits transfer kind/classification; EXPORT/DELIVERY/EXCHANGE require recipient policy and egress revision | any TOCTOU mismatch is quarantined; metadata is never silently refreshed |
| SCANNING | infected/scan failure | QUARANTINED/FAILED | malware result signed and bound to digest | security review or new transfer only |
| READY | delivery starts | IN_PROGRESS | recipient/egress policy, purpose and expiry revalidated | result-unknown reconciliation by receipt reference |
| IN_PROGRESS | durable receipt | COMPLETED | receipt digest and object digest reconcile | mismatch remains FAILED/QUARANTINED |
| REQUESTED/SCANNING/READY/IN_PROGRESS | expiry/cancel | EXPIRED/CANCELLED | no unsafe irreversible side effect | owning workflow compensates if dispatch began |

Object bytes, credentials and arbitrary filesystem paths are never stored here. Completed transfer evidence is immutable; a retry creates a new attempt/receipt through the shared command-receipt facility.

`transferKind` is the only command/domain/storage enum: `INGEST`, `EXPORT`, `DELIVERY`, `EXCHANGE`. Direction is derived deterministically (`INGEST` = inbound, the other three = outbound); no free-form `direction` or IMPORT/EXPORT alias is accepted. Only `INGEST` may omit recipient/egress policy. The object-storage adapter must perform one version-pinned metadata read and bind object version, ETag, digest, byte size and media type into `metadata_snapshot_digest`; the scanner evidence must reference that same digest and size before the request transaction is accepted.

## Command receipt authorization lifecycle

`ACCEPTED → RUNNING → SUCCEEDED | REJECTED | FAILED | RESULT_UNKNOWN` 상태는 owner service가 관리하며 terminal 결과를 덮어쓰지 않는다. 생성 transaction에서 originating action, subject, population-scope digest, field-policy revision, purpose, authorization revision을 봉인한다. 조회는 tenant context와 현재 app entitlement를 먼저 확인하고 봉인된 원 authorization context를 다시 평가한다. 현재 또는 원 정책 중 어느 하나라도 거부하면 opaque `404`/field-policy denial로 끝나며 scope·purpose override나 권한 회수 이전 결과 재노출은 허용하지 않는다.

## Operational exception projection

The platform owns a read-only projection with `OPEN → ACKNOWLEDGED → RECOVERING → RESOLVED` and optional policy-driven `SUPPRESSED`. Only authenticated owner events with a monotonic `sourceRevision` may change it. Duplicate/out-of-order events are ignored by inbox identity/revision guards. The operations center can list, filter and open the allowlisted `owner_route_key`; it cannot execute a generic “resolve” command. Every recovery command, guard, authorization and receipt remains in HRM/PER/TIM/PAY or the relevant DWP platform owner, and its later owner event updates this projection.
