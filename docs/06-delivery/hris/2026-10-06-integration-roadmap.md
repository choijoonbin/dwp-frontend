# 2026-10-06 HRIS 통합 로드맵과 개발 Gate

> 상태: G0 independently audited; G1 integration lock complete with successor obligations; G2 authorized, not started
>
> 기준일: 2026-10-06
>
> Architecture 결정: [ADR-001 HRIS 통합 Lineage, 조건부 v35 Successor와 Migration Lease](../../03-architecture/hris/ADR-001-lineage-v35-successor-and-migration-lease.md)
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
2. 조건부 Authorization Successor 결정과 실제 Migration Lease가 발급되어 단일 Writer가
   정해져 있다. 의미 Diff가 없으면 v34를 유지한다.
3. Backend와 Frontend 통합 HEAD가 Targeted·Contract·Migration Gate를 통과한다.
4. 동결된 통합 HEAD 조합에 대해 W1 Successor를 한 번 실행해 PASS한다.

이후 중앙 세션은 공통 Contract·Migration·Release Gate만 통제하고 HRM/PER/PAY/TIM Agent는
승인된 작업 패킷의 Touch Manifest 안에서 병렬로 개발한다.

## 3. 단계와 Gate

| 단계 | 상태 | 핵심 작업 | Exit Gate |
| --- | --- | --- | --- |
| G0 문서·Pin 복구 | `COMPLETE_WITH_AUDIT_AMENDMENT` | raw recovery를 byte 보존하고 exact supplement·독립 감사·Roadmap·ADR·Provenance를 고정 | 원복 manifest를 유지하면서 critical gap과 해소/후속 disposition을 별도 amendment에 고정 |
| G1 통합 Lock과 패킷 발급 | `COMPLETE_WITH_SUCCESSOR_OBLIGATIONS` | 현재/Reconciled Pin 재확인, Integration Worktree·원격 Branch 생성, 충돌 목록, 102-slice current overlay, recovery disposition, 조건부 successor 결정과 JIT Lease 발급 | [G1 Lock Receipt](2026-10-06-g1-integration-lock-receipt.json)의 digest와 Worktree clean/upstream 검증 PASS |
| G2 Backend 의미 통합 | `AUTHORIZED_NOT_STARTED` | 현재 Backend Base에 Reconciled 기능 반입, 현행 Admin/Home/Assignment 보존, Migration 재배치 | 충돌 잔여 0, 기존 v32~v34 byte 동일, Targeted Backend Test PASS |
| G3 Canonical·조건부 v35 생성 | `NOT_STARTED` | 통합 Source와 v34 의미 Diff 판정, 필요한 경우에만 Authorization successor 생성; OpenAPI/Fixture/Projection 한 번 재생성 | Diff=0이면 v34 byte 동일, Diff>0이면 v35 Checksum·Generator·Default-OFF·targeted CAS rollback PASS |
| G4 Frontend 의미 통합 | `NOT_STARTED` | 현재 Frontend Base에 Reconciled UI 반입, Backend Projection 동기화, Route/i18n/Snapshot 해결 | Contract Sync와 변경 Journey 대상 Test·Visual PASS |
| G5 통합 안정화·동결 | `NOT_STARTED` | Clean Install, 기존 DB Upgrade, Module Batch, Cross-module Contract와 결정론적 FE/BE Full Static/Build/Release Gate 실행 | 모든 정적·빌드 Gate PASS, Migration History·Owner DB 경로 PASS 후 Head 동결 |
| G6 W1 Successor | `NOT_STARTED` | 동결된 FE/BE Head와 선택된 Authorization Version에서 Synthetic Full Runtime을 정확히 한 번 실행 | 전 Assertion, Trusted Feed, Runtime Activation/Rollback, Teardown, Secret Scan PASS |
| G7 Evidence Promotion·위임 | `NOT_STARTED` | 코드 재실행 없이 결과 Versioning·Evidence Promotion·Module Packet 발급 | 통합 Base Commit과 Module별 Dependency/Producer Pin 승인 |

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
7. 통합 의미 Source와 현재 v34를 비교한다. Diff가 있을 때만 v35를 발급하며, 그 결정 뒤
   Authorization, OpenAPI, Fixture를 한 번 재생성한다.

### 4.2 Frontend 후속

1. `dwp-frontend` 현재 Pin에서 새 Integration Branch를 만든다.
2. 현재 Home/Admin/Assignment와 Reconciled HRIS Module Workflow를 함께 보존한다.
3. Authorization·OpenAPI Projection은 G3 Backend 결과에서 생성한다. v34 유지 판정이면
   기존 Authorization Projection을 불필요하게 재발행하지 않는다.
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
| E Full Promotion Static | G5 동결 직전 | FE/BE 전체 정적·Build·Release Gate. Agent는 source 또는 소비 contract pin 변경 시만 실행 | 동결 후보당 한 번; 실패 시 targeted 수정 후 새 후보 생성 |
| F W1 Successor | 모든 결정론적 Gate PASS 및 FE/BE Head 동결 후 | 전체 Runtime, Tenant 격리, Trusted Feed, 선택된 Authorization Version Activation/Rollback | 동결 조합당 한 번 |

W1을 일찍 반복해 잠정 Head를 검증하지 않는다. Gate별 실패를 모아 수정하고, 공유 Contract나
Runtime 전제가 변하지 않았다면 전체 Suite 대신 실패·영향 범위를 재검증한다.

## 6. Module 개발 순서와 의존성

정확한 다음 Slice ID는 복구된 Slice Register와
`current-slice-integration-status.v1.csv`의 current/reconciled overlay를 함께 확인한 뒤 선택한다.
역사 Register의 `NOT_STARTED_G3`를 현재 상태로 재사용하거나 새 ID를 만들지 않는다.

| 순서 | Lane | 선행 의존성 | 다음 개발 방향 |
| ---: | --- | --- | --- |
| 0A | SYS/Common Foundation | G0~G7 | 공통 Route/OpenAPI/Schema/Migration Lease의 단일 Writer. 의존성이 적은 `SYS-007`을 조기 처리 |
| 1 | HRM | SYS/Common Contract | Effective-dated Assignment·Employment Lifecycle과 People360 기준 정착; 현재 Assignment Proposal과 합성 |
| 2A | TIM | HRM Assignment/Workforce, SYS Calendar·Job Policy | 근태 수집·해석·예외·기간 마감; 마감 Event를 PAY에 제공 |
| 2B | PER | HRM Population/Assignment Snapshot, SYS Approval·SoD | 평가 실행·결과·승인; PAY 연결 전까지 보상 Handoff 분리 |
| 3A | PAY Foundation/Config | HRM 고용·Legal Employer, SYS/Common | 계산 입력 전 Ledger·Config·Provider Test 경계를 준비 |
| 3B | PER→PAY Typed Handoff | PER 승인 결과, PAY Typed Contract, DEP-019/XCON | 승인되고 최신인 Compensation Snapshot만 PAY 입력으로 전달 |
| 3C | PAY Calculation/Settlement | HRM·TIM 마감·3B Handoff | 계산·정산·대사; 국가·세무·은행 Connector는 외부 Gate 유지 |
| 4 | SYS Home Composition | HRM/PER/PAY/TIM Home contribution DEP-010~013 | 모든 producer가 고정된 뒤 `SYS-012` 처리; 역사 packet 순서 override |
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
- 역사 Register의 현재 구현 상태 overlay:
  `docs/06-delivery/hris/current-slice-integration-status.v1.csv`
- G1 Lock, Conflict, Migration Lease와 Recovery Disposition:
  `docs/06-delivery/hris/2026-10-06-g1-*`
- G1 완료 판정: [G1 Integration Lock Receipt](2026-10-06-g1-integration-lock-receipt.json)
- Machine-readable Runtime Contract: Backend `contracts/**`
- 고객·외부 활성화 Gate: Backend
  `docs/delivery/customer-policy-and-release-gate-register.md`만 정본으로 사용
- Raw Log·HAR·Screenshot: Git이 아닌 승인된 Artifact Storage에 보존하고 Hash만 Versioning

## 8. 최종 잔여 검증

G7 완료 전까지 다음은 열린 항목이다.

- 현재와 Reconciled 변경을 모두 포함한 Backend·Frontend 통합 HEAD 생성
- v34 유지 또는 v35 successor 필요 여부의 G2 의미 판정과 실제 Checksum
- 발급된 Auth V242의 G2 사용 여부 확정과 G5 Clean/Upgrade History 검증. 의미 Diff가 있을 때만
  Auth V243 successor seed Lease 조건부 발급
- Frontend 생성 Projection(변경 시)과 변경 Journey Visual Evidence
- 통합 Pin에 대한 W1 Successor PASS
- 고객 정책·데이터 Mapping·외부 Connector·Production 승인

따라서 이 문서의 존재만으로 Module 개발 또는 Production Release 준비 완료를 선언하지 않는다.
