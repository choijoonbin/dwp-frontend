# 2026-10-06 HRIS 통합 로드맵과 개발 Gate

> 상태: G0 recovery baseline complete; G1 integration execution not started
>
> 기준일: 2026-10-06
>
> Architecture 결정: [ADR-001 HRIS 통합 Lineage, v35 Successor와 Migration Lease](../../03-architecture/hris/ADR-001-lineage-v35-successor-and-migration-lease.md)
>
> Pin 정본: [Source 및 Lineage Provenance](2026-10-06-source-and-lineage-provenance.md)

## 1. 현재 판정

복구된 W1 Runtime Checkpoint는 고정된 과거 Frontend·Backend Commit에서 PASS했다. 과거 HOLD의
직접 원인이었던 Migration Control, Trusted PAY/TIM Feed와 전체 Runtime Topology도 그 실행에서
PASS했다. 이는 복구 가능성과 Runtime 경로를 입증하지만 다음을 입증하지는 않는다.

- 최신 Reconciled Tip
- 현재 `dwp-dev` Tip
- 아직 생성하지 않은 v35 통합 HEAD
- 고객 데이터·고객 정책·Production 활성화

따라서 현재 상태는 **Recovered checkpoint PASS / final integrated head NOT_EVALUATED**다. 이전
HOLD 기록은 삭제하지 않고 역사적 판정으로 보존하며, 최신 Sanitized 결과는
[W1 PASS Summary Manifest](w1-synthetic-pass-2026-10-06.sanitized.json)를 정본으로 사용한다.

## 2. 완료 조건

모듈별 병렬 개발 착수 전 다음 네 조건을 모두 충족해야 한다.

1. Source·Current·Reconciled·W1 Pin과 Dirty Digest가 Versioned 문서에 고정되어 있다.
2. v35 합성 패킷과 실제 Migration Lease가 발급되어 단일 Writer가 정해져 있다.
3. Backend와 Frontend 통합 HEAD가 Targeted·Contract·Migration Gate를 통과한다.
4. 동결된 통합 HEAD 조합에 대해 W1 Successor를 한 번 실행해 PASS한다.

이후 중앙 세션은 공통 Contract·Migration·Release Gate만 통제하고 HRM/PER/PAY/TIM Agent는
승인된 작업 패킷의 Touch Manifest 안에서 병렬로 개발한다.

## 3. 단계와 Gate

| 단계 | 상태 | 핵심 작업 | Exit Gate |
| --- | --- | --- | --- |
| G0 문서·Pin 복구 | `COMPLETE_WITH_DECLARED_GAPS` | 복구 blueprint·통제 packet을 versioning하고 Roadmap, ADR, Provenance, W1 Manifest, 작업 패킷 Template 고정 | [G0 Receipt](g0-recovery-baseline-2026-10-06.json)에 복구 manifest·49/50 binding·알려진 gap과 정적 검사 결과 고정 |
| G1 통합 Lock과 패킷 발급 | `NOT_STARTED` | 현재/Reconciled Pin 재확인, Integration Worktree 생성, 충돌 목록 고정, v35 패킷과 JIT Migration Lease 발급 | 단일 Writer, 허용 경로, 정확한 Lease 범위, Rollback 조건 승인 |
| G2 Backend 의미 통합 | `NOT_STARTED` | 현재 Backend Base에 Reconciled 기능 반입, 현행 Admin/Home/Assignment 보존, Migration 재배치 | 충돌 잔여 0, 기존 v32~v34 byte 동일, Targeted Backend Test PASS |
| G3 v35·Canonical 생성 | `NOT_STARTED` | v34와 HRIS 의미 Diff 합성, Authorization/OpenAPI/Seed/Fixture 한 번 재생성 | v35 Checksum 고정, Generator 재현, Default-OFF, v34→v35→v34 PASS |
| G4 Frontend 의미 통합 | `NOT_STARTED` | 현재 Frontend Base에 Reconciled UI 반입, Backend Projection 동기화, Route/i18n/Snapshot 해결 | Contract Sync와 변경 Journey 대상 Test·Visual PASS |
| G5 통합 안정화 | `NOT_STARTED` | Clean Install, 기존 DB Upgrade, Module Batch Test, Cross-module Contract 검사 | Migration History·중복·순서·Owner DB 경로 PASS, Head 동결 |
| G6 W1 Successor | `NOT_STARTED` | 동결된 FE/BE Head와 v35에서 Synthetic Full Runtime을 정확히 한 번 실행 | 전 Assertion, Trusted Feed, Activation/Rollback, Teardown, Secret Scan PASS |
| G7 Promotion·위임 | `NOT_STARTED` | 전체 FE/BE/Agent Release Gate 한 번 실행, 결과 Versioning, Module Packet 발급 | 통합 Base Commit과 Module별 Dependency Pin 승인 |

Gate 실패 시 같은 단계의 실패를 모두 수집해 Batch로 수정한다. 영향받은 Targeted Gate부터
재실행하며 공유 Contract, Runtime Topology 또는 동결 HEAD가 바뀐 경우에만 후속 통합 Gate를
무효화한다.

## 4. 통합 실행 순서

### 4.1 Backend 우선

1. `dwp-backend` 현재 Pin에서 새 Integration Branch를 만든다.
2. Reconciled Backend HEAD를 immutable 입력으로 펼치고 충돌을 Cluster별로 분류한다.
3. 현재의 Visible HRIS Identity와 Governed Assignment Proposal을 보존한다.
4. Auth·Platform의 중복 Flyway 번호는 반입하지 않고 Lease 번호로 의미만 이식한다.
5. People `V49`~`V52`와 현재 `V53`의 Clean Install·Upgrade 순서를 확인한다.
6. PAY/TIM의 DB·Schema·Flyway History 소유권을 확인한다.
7. v35 의미 Source를 완성한 뒤 Authorization, OpenAPI, Fixture를 한 번 재생성한다.

### 4.2 Frontend 후속

1. `dwp-frontend` 현재 Pin에서 새 Integration Branch를 만든다.
2. 현재 Home/Admin/Assignment와 Reconciled HRIS Module Workflow를 함께 보존한다.
3. Authorization·OpenAPI Projection은 G3 Backend 결과에서 생성한다.
4. Route, Model, i18n, E2E와 Binary Snapshot을 변경 Journey 단위로 검증한다.
5. 1440·1280·390·320px, 200% Zoom, Keyboard, Light/Dark/High Contrast,
   Reduced Motion, 긴 Label과 부분 실패를 영향 화면에서 확인한다.

### 4.3 Agent 경계

`dwp_agent`에는 반입할 별도 Recovery Branch가 없다. 승인된 Deterministic Owner API와 Tool
Contract가 확정된 이후 필요한 Action만 추가한다. Agent는 HRIS System of Record를 소유하거나
DB에 직접 Write하지 않는다.

## 5. 검증 전략

| 검증 층 | 실행 시점 | 범위 | 반복 규칙 |
| --- | --- | --- | --- |
| A 정적·Provenance | 통합 전 | Pin, Clean/Dirty 상태, Merge Base, 충돌 목록, Migration 중복 | 입력이 바뀔 때만 |
| B 충돌 Cluster | 각 Cluster 해결 후 | Authorization Generator, Gateway, People/Assignment, FE Model/i18n 등 영향 Test | 실패 Cluster만 재실행 |
| C 생성 Contract | 모든 의미 해결 후 | Authorization, OpenAPI, Fixture, FE Projection과 Checksum | 한 번 생성 후 Source 변경 시만 |
| D Module Batch | 모듈 Batch 완료 후 | HRM/PER/PAY/TIM Integration Test | 파일 수정마다 실행하지 않음 |
| E W1 Successor | FE/BE Head 동결 후 | 전체 Runtime, Tenant 격리, Trusted Feed, v35 Activation/Rollback | 동결 조합당 한 번 |
| F Full Promotion | Release 후보 확정 후 | FE/BE/Agent 전체 Gate | Promotion 직전 한 번 |

W1을 일찍 반복해 잠정 Head를 검증하지 않는다. Gate별 실패를 모아 수정하고, 공유 Contract나
Runtime 전제가 변하지 않았다면 전체 Suite 대신 실패·영향 범위를 재검증한다.

## 6. Module 개발 순서와 의존성

정확한 다음 Slice ID는 복구된 Slice Register를 확인하고 상태를 대조한 뒤 선택한다. 이
Roadmap은 새 ID를 만들거나 미확인 ID를 다음 작업으로 지정하지 않는다.

| 순서 | Lane | 선행 의존성 | 다음 개발 방향 |
| ---: | --- | --- | --- |
| 0 | SYS/Common | G0~G7 | Shell, Route, v35, OpenAPI, 공통 Schema, Migration Lease의 단일 Writer |
| 1 | HRM | SYS/Common Contract | Effective-dated Assignment·Employment Lifecycle과 People360 기준 정착; 현재 Assignment Proposal과 합성 |
| 2A | TIM | HRM Assignment/Workforce, SYS Calendar·Job Policy | 근태 수집·해석·예외·기간 마감; 마감 Event를 PAY에 제공 |
| 2B | PER | HRM Population/Assignment Snapshot, SYS Approval·SoD | 평가 실행·결과·승인; PAY 연결 전까지 보상 Handoff 분리 |
| 3 | PAY | HRM 고용·Legal Employer·보상 Snapshot, TIM 마감 결과 | 계산·정산·대사; 국가·세무·은행 Connector는 외부 Gate 유지 |
| 4 | PER→PAY | PAY Typed Contract, XCON, 승인 Gate | 승인된 보상 결과만 Typed Handoff로 전달 |
| 5 | 고급 SYS/AI | 안정된 Owner API, 고객·G6 Gate | 분석·Listening·AI Action; SoR/직접 DB Write 금지 |

모듈 Agent는 [개발 Agent 작업 패킷 Template](development-agent-work-packet-template.md)의 필수
필드를 채운 승인본을 받기 전에는 개발을 시작하지 않는다. 특히 Slice ID, Dependency Pin,
Touch Manifest와 Migration Lease가 비어 있으면 작업을 배정하지 않는다.

## 7. 정본과 증거 위치

- 업무·사용자·화면·데이터·API·Agent·수용 계약:
  `docs/05-features/DWP-R1-HR-001-role-aware-hcm/`
- 공통 통합 Architecture와 ADR: `docs/03-architecture/hris/`
- Roadmap, Gate, Provenance와 Sanitized Evidence: `docs/06-delivery/hris/`
- 복구된 역사 blueprint·통제 packet과 무결성 metadata:
  [`docs/06-delivery/hris/recovery/`](recovery/README.md)
- Machine-readable Runtime Contract: Backend `contracts/**`
- 고객·외부 활성화 Gate: Backend
  `docs/delivery/customer-policy-and-release-gate-register.md`만 정본으로 사용
- Raw Log·HAR·Screenshot: Git이 아닌 승인된 Artifact Storage에 보존하고 Hash만 Versioning

## 8. 최종 잔여 검증

G7 완료 전까지 다음은 열린 항목이다.

- 현재와 Reconciled 변경을 모두 포함한 Backend·Frontend 통합 HEAD 생성
- v35 Canonical Bundle과 실제 Checksum 생성
- JIT Migration Lease 발급 및 Clean/Upgrade History 검증
- Frontend 생성 Projection과 변경 Journey Visual Evidence
- 통합 Pin에 대한 W1 Successor PASS
- 고객 정책·데이터 Mapping·외부 Connector·Production 승인

따라서 이 문서의 존재만으로 Module 개발 또는 Production Release 준비 완료를 선언하지 않는다.
