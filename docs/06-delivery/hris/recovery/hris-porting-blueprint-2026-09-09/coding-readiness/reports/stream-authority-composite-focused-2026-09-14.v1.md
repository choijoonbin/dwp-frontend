# Stream authority composite scaffold — final focused evidence

Status: FOCUSED_PASS_UNWIRED_DISABLED_SCAFFOLD / G3_CLOSED / COMMON_P0_OPEN.

현재 소스의 집중 검증은 **114개 테스트, 실패·오류·스킵 0개**입니다. 이 결과는 외부 Control 검사 전용 미배선 공통 scaffold의 검증이며, 앱 runtime-only startup·실제 13-stream Control bootstrap·모듈별 전체 코딩 준비 승인과는 다릅니다.

| Suite | Tests | Failures / errors / skips |
| --- | ---: | --- |
| CompositeRuntimeBindingGuardPostgresTest | 37 | 0 / 0 / 0 |
| CompositeRuntimeBindingGuardTest | 6 | 0 / 0 / 0 |
| InsightsPurposeBindingGuardPostgresTest | 12 | 0 / 0 / 0 |
| StreamAuthorityJsonTest | 59 | 0 / 0 / 0 |

- Command: `./gradlew :dwp-core:test --tests com.dwp.core.database.authority.* --no-daemon --max-workers=1 --continue`.
- Run: 2026-09-14 02:07:01.898–02:10:46.611 UTC; 224.713 seconds; exit 0; 4 executed / 7 up-to-date tasks.
- Host verification semaphore: hris-verification, acquired immediately, released normally.
- Baseline: `70c996fdafc011392056a1909a2e5222b240ded3`, tree `ad226258485214e52a552e08594668c3593c320b`.
- Commit: `76130dde620084124a9c16ff8edc731487e0a4c3`, tree `b7007b8c27cd4cfb9aadf50a034e316e7864869e`; exact 12 new files / 1,929 added lines / no existing file edits.
- Current Control source reference: `dwp-migration-control-v2:a18c30c83e7ec75d0ea42312dc9683c526c73007c0d2a5a9626f1d403d55dc0e`.
- Post-commit backend clean; pre/post source SHA-256 identical; all 12 file modification times precede final run start. Six existing static checks PASS, with no policy exceptions added.

JSON includes all 114 exact case IDs, four XML SHA-256 values, 26 compiled class IDs/hashes, 12 source file hashes/line counts, commit/tree/source-reference, timeout/semaphore and static-check evidence: [machine-readable manifest](stream-authority-composite-focused-2026-09-14.v1.json).

## Proof boundaries

Real isolated PostgreSQL probes cover migration/current/session/original JDBC login identity, private object ownership/inventory/ACL/history, purpose-specific query/writer pools, actual query DML denial and writer access denial to protected data. Synthetic authority fixture reference metadata is contract-test-only; no genuine current-source 13-stream external Control receipt was produced. Current source reference above was independently computed, not used to replace that missing proof.

The public API is `inspectExternallyControlledService`, and result boundary is `EXTERNAL_CONTROL_AUTHORITY_INSPECTION`. It requires externally held migration pools to inspect native seals and must **not** be wired into production application startup. Disabled stream suppliers were verified to receive zero calls. Analytics/AI without listening is healthy; Insights has distinct readonly query and bounded CRUD writer LOGIN purposes.

Runtime-only startup seal/signature/freshness/epoch/deployment fence, trusted producer/transport/key/outage/DDL race policy, private stream resources/bootstrap and actual all-stream role separation are still common P0. Existing scalar v2, SQL, guards, service bootstrap and registries were untouched; user main databases/servers were untouched. Historical full 70c996f backend diagnostic remains historical. A complete current backend run is required after integration.

See [implementation/boundary note](../semantic-remediation/stream-authority-composite-scaffold.v1.md) and [runtime-only startup authority boundary proposal](../semantic-remediation/runtime-only-startup-authority-boundary.proposal.v1.md).
