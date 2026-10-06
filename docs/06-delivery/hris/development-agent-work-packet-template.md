# HRIS 개발 Agent 작업 패킷 Template

> 상태: Required template
>
> 적용 시점: 통합 G7 이후 Module 개발, 또는 G1~G6의 명시적 중앙 통합 작업
>
> 원칙: 빈 필수 필드, 미확인 Slice ID, 미발급 Migration Lease가 있으면 작업을 시작하지 않는다.

이 Template은 Agent를 늘리기 위한 문서가 아니라 변경 소유권, 의존성, 검증 범위와 종료 조건을
작업 전에 고정하기 위한 계약이다. 정확한 다음 Slice ID는 복구된 Slice Register에서 확인하며
임의로 만들지 않는다.

## 1. 패킷 식별

| 필수 필드 | 값 |
| --- | --- |
| Packet ID | `<approved-packet-id>` |
| Slice ID | `<existing-id-from-recovered-slice-register>` |
| Module/Lane | `<SYS-COMMON | HRM | PER | PAY | TIM | AGENT>` |
| 상태 | `<DRAFT | APPROVED | IN_PROGRESS | BLOCKED | DONE>` |
| 목표 사용자와 완료할 업무 | `<user / question / action / outcome>` |
| Owner Agent | `<single-writer-agent>` |
| Reviewer | `<contract-or-module-reviewer>` |
| 기준 문서 Revision | `<feature-package-and-roadmap-commit>` |
| 발급·만료 시각 | `<ISO-8601 / expiry-condition>` |

## 2. Pin과 의존성

| 필수 필드 | 값 |
| --- | --- |
| Frontend Base Commit | `<sha-or-N/A>` |
| Backend Base Commit | `<sha-or-N/A>` |
| Agent Base Commit | `<sha-or-N/A>` |
| Authorization Version·Checksum | `<version / sha256>` |
| OpenAPI/Canonical Contract Pin | `<artifact / sha256-or-commit>` |
| SKKF Source HEAD·`stateSha256` | `<all-used-source-pins>` |
| 선행 Packet·Slice | `<approved-ids-and-result-commits>` |
| Dependency IDs | `<exact DEP-/XCON identifiers from the approved overlay>` |
| Producer Contract Pins | `<producer result commit / schema or event checksum per dependency>` |
| 외부 Gate ID | `<backend-customer-register-ids-or-none>` |

Pin이 실제 Worktree와 다르면 작업을 멈추고 패킷 Revision을 요청한다. 최신 Source를 자동으로
재분석하거나 과거 분석 결과를 조용히 덮어쓰지 않는다.

## 3. 범위와 Touch Manifest

### 포함 범위

- `<explicit business capability>`
- `<explicit user journeys and states>`

### 제외 범위

- `<explicitly deferred capability>`
- `<customer/external dependency not authorized>`

### 허용 경로

- `<repo>:<exact-directory-or-file-glob>`

### 금지 경로

- `<shared contract, migration, generated or unrelated paths>`

### 공통 Contract 변경

- 필요 여부: `<yes | no>`
- Change Request ID: `<SYS/Common request ID; direct edit prohibited when yes>`
- 예상 호환성: `<additive | successor-required | breaking-not-approved>`

Agent는 허용 경로 밖의 발견 사항을 직접 고치지 않고 후속 Packet 후보로 보고한다.

## 4. Migration Lease

DB 변경이 없으면 `NOT_REQUIRED`와 근거를 적는다. DB 변경이 있으면 아래 항목이 모두 필요하다.

| 필수 필드 | 값 |
| --- | --- |
| Lease ID | `<issued-lease-id>` |
| Stream/DB/Schema | `<owner-stream-and-database>` |
| 정확한 Version 범위 | `<start..end>` |
| 기준 Commit | `<sha>` |
| 허용 Migration 경로 | `<exact-path>` |
| Schema Effect | `<tables/columns/indexes/data-seed>` |
| Upgrade 경로 | `<supported-existing-version-to-target>` |
| Rollback/Forward-fix | `<approved-strategy>` |
| Lease 만료·미사용 번호 처리 | `<condition>` |

Lease가 `PENDING`, 범위가 `Vn+`처럼 열려 있거나 다른 Packet과 겹치면 Migration을 작성하지 않는다.

## 5. Runtime·보안·Rollout 계약

- Owner Service/API: `<service and endpoints>`
- System of Record: `<authoritative owner; Agent is never HRIS SoR>`
- Tenant/Population Boundary: `<enforcement and negative cases>`
- Permission/SoD/Step-up: `<capabilities and decision points>`
- Idempotency·Version·Audit: `<keys, optimistic lock, receipt/outbox>`
- Data Origin·Masking·Retention: `<SOURCE/REFERENCE and policy>`
- Feature Flag: `<flag, default OFF, tenant cohort>`
- Activation/Rollback: `<maker/checker/activator and rollback target>`
- Partial Failure·Empty·Denied State: `<required user-visible behavior>`

## 6. 수용 기준과 검증 계획

각 기준은 Given/When/Then 또는 동등한 검증 가능한 문장으로 작성한다.

| ID | 수용 기준 | 자동 검증 | 증거 |
| --- | --- | --- | --- |
| `<AC-01>` | `<observable outcome>` | `<targeted test command or check>` | `<expected artifact>` |

검증은 다음 순서로 고정한다.

1. 변경 Cluster의 Unit/Contract Test
2. Module Batch Integration Test
3. 공유 Contract 변경 시 생성·동기화 Gate
4. 접근성·반응형·Visual 영향 Journey
5. 동결된 통합 조합에서만 W1 또는 Full Promotion Gate

각 수정마다 전체 Suite를 실행하지 않는다. 한 Gate의 실패를 모두 수집해 함께 수정하고 영향받은
Gate부터 재실행한다. Full Run이 필요한 이유와 무효화된 기존 증거를 패킷에 기록한다.

## 7. 산출물과 완료 보고

- 변경 파일: `<repo-relative paths>`
- 생성 Contract/Checksum: `<artifacts>`
- Migration/Lease 사용 결과: `<used/unused/released>`
- Test 결과: `<command, status, evidence locator>`
- 미실행 Test와 이유: `<explicit gaps>`
- Feature Flag/배포 상태: `<must remain OFF unless separately approved>`
- 후속 작업 후보: `<observations only; not silently added to scope>`
- 최종 Commit: `<sha>`
- Reviewer 판정: `<approved/rejected and evidence>`

`DONE`은 코드 작성 완료가 아니라 허용 범위, 수용 기준, Targeted Test, Contract Sync,
Migration Lease 정리와 증거 연결까지 완료한 상태다.

## 8. 중단 조건

다음 상황에서는 추정으로 진행하지 않는다.

- Slice Register에 ID가 없거나 상태·의존성이 모순됨
- Base/Source Pin 또는 Dirty Digest 불일치
- 허용 경로 밖 공통 Contract 변경 필요
- Migration Lease 미발급·충돌·만료
- 고객 정책 또는 외부 Connector 결정 필요
- SoR, Tenant Boundary, Population, SoD, Rollback 계약이 불명확함

중단 시 Blocker, 확인한 근거, 안전하게 완료한 범위와 필요한 결정만 보고한다.
