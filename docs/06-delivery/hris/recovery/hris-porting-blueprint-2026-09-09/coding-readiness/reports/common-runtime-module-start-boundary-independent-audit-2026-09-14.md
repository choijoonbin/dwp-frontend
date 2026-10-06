# 공통 런타임·모듈 START 경계 독립 감사

생성 시각: 2026-09-14T13:24:23Z  
감사 범위: `START-P0-003`, `004`, `005`, `007`, `008`  
권한: 독립 읽기 전용 감사이며 정본·Gate 변경 권한 없음

## 최종 판정

**현재 다섯 모듈 세션 전체 START는 `NO_GO`입니다.** 현재 Gate는 계속 `CLOSED_FAIL_SAFE`이며 G6 운영 활성화는 승인되지 않았습니다.

다만 기존 `runtime-only-wiring-producer-implementation-plan.v2`는 안전한 운영 목표를 제시하면서도, P2-A/B/C·P3·P4 전체를 모듈 도메인 코딩 시작 전에 끝내야 하는 것처럼 묶어 START와 G4/G6를 과도하게 결합했습니다. 이를 분리해도 보안 요구를 낮추는 것은 아닙니다. 신원 owner/source/PEP/current freshness, fail-closed, no fallback, optional disabled no-call, production runtime-only 권한은 해당 기능이 실행되는 모든 단계에서 그대로 강제해야 합니다.

현재 모듈 코딩을 막는 실제 최소 공통 작업은 다음 다섯 가지입니다.

1. 최신 `dwp-dev`와 현재 공통 WIP를 통합한 단일 불변 체크포인트
2. 그 체크포인트에 고정된 신원 owner ABI/adapter와 다섯 소비자 compile·no-fallback 증거
3. 실제 high-water에 근거한 충돌 없는 migration successor와 모듈 range 예약
4. optional capability machine contract와 전 모듈 disabled zero-call 증거
5. 동일 체크포인트를 받은 다섯 BE/FE 작업쌍의 현재 authoring receipt

물리적인 13개 stream 전부의 운영 활성화, 내구성 publication ledger, 운영 mTLS/HSM/key rotation, 운영 8개 서비스의 최종 credential 제거 증명, 고객사 활성화 자료와 5개 heavyweight stack 동시 실행은 모듈 **작성 시작 전** 필수사항이 아닙니다. 전자는 G4 또는 G6에서 기능 수용·운영 활성화 전에 반드시 닫아야 합니다.

## 읽은 현재 상태

| 대상 | 현재 증거 | 판정 |
|---|---|---|
| Backend integration | HEAD `db0d2b5`, latest `dwp-dev` `315e1b2`, 읽기 시점 dirty entry 68개 | 공통 소스가 아직 불변 checkpoint가 아님 |
| Frontend integration | HEAD `4e1333c6`, latest `dwp-dev` `495b6192`, clean | 다섯 모듈 frontend branch fanout 증거는 별도 필요 |
| Current Gate | `g0/current-g3-gate-decision.json`, SHA-256 `74c2d372…` | `CLOSED_FAIL_SAFE` |
| Session evidence | `g0/session-environment-evidence.json` 부재 | 다섯 세션 START 차단 |
| Production runtime guard | 8개 production service `src/main`에서 guard/freshness 참조 0개 | runtime wired 주장 불가 |

## 단계 경계

### START — 모듈 작성 전에 필수

- 현재 소스를 merge/commit하여 하나의 immutable checkpoint로 고정
- owner-neutral identity/authority ABI, Auth·People native owner adapter, fail-closed test fixture를 다섯 모듈에 배포
- 정확한 8-service/13-stream topology와 optional prerequisite 계약 고정
- 최신 upstream high-water와 충돌하지 않는 migration successor/range 정본화
- 다섯 module pair를 동일 checkpoint로 동기화하고 scoped authoring receipt 발행
- optional capability matrix/guard와 disabled zero-call cross-module test 완료

### G4 — 해당 기능 integration acceptance 전 필수

- 실제 인증된 owner transport와 current PEP wiring
- 대상 서비스 startup guard/freshness 구현 및 enabled supplemental stream의 schema/role/pool receipt
- Control inspection/publication integration 경로와 stale/revoke/tenant/privilege drift/race negative
- 필요한 multi-service native integration boot

### G6 — 운영 활성화 전 필수

- durable multi-resource publication/current ledger
- workload-authenticated transport, HSM급 signing/key rotation/revocation
- continuous lease renewal, drain/offline fencing, safe credential distribution
- 8개 production service identity에서 migration datasource/secrets/Flyway/schema privilege 부재 증명
- 고객 adoption, 용량/SLO/관측/백업·복구·DR 증거

현재 정본은 더 넓은 runtime wiring을 G3에 두고 있으므로, 이 감사만으로 단계가 바뀌지는 않습니다. 승인된 canonical successor가 분류를 채택하고 validator가 같은 의미를 검사하기 전까지 Gate는 닫혀 있어야 합니다.

## 항목별 감사

### START-P0-003 — 신원 owner adapter

상태: **PARTIAL / START BLOCKED**

현재 `GuardedSelfContextPortV1`, `SelfContextOwnerPortsV1`, Auth의 `AuthPersonBindingQueryReaderV1`, People의 `NativeSelfContextQueryReaderV1`가 존재합니다. People reader는 multi-employment를 first-row로 축약하지 않습니다. 그러나 모두 현재 backend WIP에 있고, Auth reader 자체도 Spring/HTTP/signing을 제공한다고 주장하지 않습니다. 현재 증거에서 consumer compile witness는 People/Payroll에 국한되며 HRM/PER/PAY/TIM/SYS 전체 행렬이 아닙니다.

START close condition:

- exact DTO/SPI/guard ABI를 current checkpoint에 고정
- Auth와 People이 각자 DB 경계 안에서 native owner adapter를 등록
- 다섯 모듈 모두 owner-neutral port만 compile하며 직접 cross-owner DB 의존/조회 0건
- wrong tenant, missing/ambiguous employment, stale revision, owner unavailable를 fail-closed로 검증

최소 allocation: `dwp-platform-contracts` identity ABI, `dwp-auth-server`/`dwp-people-server` owner adapter, 모듈별 consumer boundary fixture/test. ABI 고정 후 다섯 consumer slice는 병렬화할 수 있습니다.

실제 authenticated owner transport, current PEP/revocation/point-of-use freshness는 G4, 운영 workload identity와 key lifecycle/customer adoption은 G6입니다.

### START-P0-004 — 8-service/13-stream runtime-only authority

상태: **PARTIAL / 계약은 있으나 runtime wiring 없음**

`ExactStreamTopology`은 정확한 8개 서비스/13개 stream을, `StreamAuthorityContract`은 네 supplemental capability prerequisite를 표현합니다. `CompositeRuntimeBindingGuard`에는 disabled supplier no-call과 missing binding fail-closed 테스트가 있습니다. 그러나 topology는 `UNWIRED_DISABLED_SCAFFOLD`이고, production service `src/main`에는 `RuntimeOnlyStartupGuard`/`RuntimeStartupFreshnessPort` 참조가 0개입니다. 서비스 설정에는 migration/Flyway profile이 남아 있으며, `MigrationControlMain`도 `ControlInspectionFenceBridgeV1`를 호출하지 않습니다.

START close condition은 production wiring 전체가 아니라 다음입니다.

- topology/stream/receipt ABI와 no-call 계약을 current checkpoint에 commit/fanout
- all-five module이 동일 ABI와 typed mock/fail-closed port로 compile
- unknown/missing/duplicate stream, disabled zero-call, analytics/AI non-listening, employee-listening prerequisite negative 통과
- production activation은 명시적으로 false 유지

G4에서 실제 service startup guard와 enabled supplemental stream을 wiring하고 native receipt를 검증합니다. Durable publication ledger, authenticated Control transport, HSM/key/lease lifecycle 및 운영 8-service runtime-only 제거 증명은 G6입니다.

### START-P0-005 — migration allocation

상태: **OPEN / HARD START BLOCKER**

최신 backend `dwp-dev` `315e1b2` 기준 high-water는 Auth `V214`, Platform `V253`, People `V46`, Approval `V33`, Notification `V27`입니다. 특히 Platform은 기존 판단의 `V249`가 아니라 **`V253`**까지 상승했습니다. 따라서 integration common Platform `V231..V237`은 `V254..V260`으로, Auth `V211..V212`는 `V215..V216`으로, Approval `V15..V16`은 `V34..V35`로 exact-byte lineage를 보존하여 successor 처리해야 합니다. People `V47..V50`은 upstream `V46` 다음 번호라 유지 가능하지만 `V49/V50`은 snapshot에서 아직 uncommitted입니다. Notification `V28..V30`은 번호 충돌은 없지만 이미 적용된 integration DB와 clean DB 양쪽 upgrade를 검증해야 합니다.

충돌 없는 모듈 시작점 권고는 다음과 같습니다. 이는 감사 권고이며 아직 canonical authorization이 아닙니다.

| 모듈 | stream | 권고 range |
|---|---|---|
| HRM | people-main | `V51..V73` |
| PER | performance-main | `V1..V63` |
| PAY | payroll-main | `V1..V49` |
| TIM | time-main | `V1..V39` |
| SYS | auth-main | `V217..V245` |
| SYS | platform-main | `V261..V289` — public/shared만 허용 |

private capability는 public Platform range로 밀어 넣지 않고 Control `V1 bootstrap`, config `V2..V4`, protected `V2`, insights `V2..V4`, issuer `V2`처럼 소유 stream의 named exact migration만 예약합니다.

START close condition:

- exact merge candidate에서 high-water 재계산
- 충돌 파일 exact-byte rename lineage와 clean/upstream/integration upgrade test
- G0/coding-readiness의 allocation/stream/ownership/generator/validator를 원자적으로 successor화
- duplicate/overlap/stale high-water/private-to-public leakage mutation 차단

중앙 reservation이 봉인된 뒤에만 모듈 migration 작성이 병렬화될 수 있습니다.

### START-P0-007 — 모듈 세션 환경

상태: **OPEN / HARD START BLOCKER**

5개 profile의 command catalog는 있지만 receipt가 없습니다. Backend module branch들은 `db0d2b5`이고 현재 integration WIP를 포함하지 않으며, frontend module branch도 current integration `4e1333c6`보다 뒤에 있습니다. 기존 branch register도 최신 fanout을 증명하지 못합니다. 과거 doctor 0/5를 현재 transient memory 관찰만으로 PASS로 바꿀 수 없습니다.

START close condition:

- common P0 이후 immutable BE/FE checkpoint를 다섯 pair에 fanout
- 10개 worktree의 clean/current commit 증명
- 모듈별 unique port, DB/schema, cache/build/output namespace 할당
- scoped backend compile/unit와 frontend architecture/typecheck 실행
- migration reservation readback과 capacity semaphore fail-closed 증거
- hash-pinned `session-environment-evidence` 발행

다섯 heavy stack의 동시 실행은 START 조건이 아닙니다. host semaphore 내 병렬 또는 순차 authoring이면 충분합니다. Whole-runtime boot는 G4, production capacity/SLO/DR은 G6입니다.

### START-P0-008 — optional dependency

상태: **PARTIAL / START BLOCKED**

DB supplemental stream의 prerequisite/no-call guard는 일부 닫혔고 platform dependency binding class는 register상 14/14 존재합니다. 그러나 `module-dependency-register.csv`의 READY 표시는 문서 상태일 뿐 runtime admission 증거가 아닙니다. 계획된 provider/consumer test reference를 실제 파일과 대조하면 78개 중 18개만 존재하고 60개가 없습니다. ATS/LMS/skills/WFM/connectors/country pack을 통합한 machine dependency/install/admission 계약도 없습니다.

START close condition:

- capability/owner/consumer/contract version/default/install prerequisite/affected operation/failure code의 closed matrix
- enabled-but-missing을 외부 call 전에 해당 기능만 deny하는 shared guard
- disabled/uninstalled일 때 owner/provider call count 0을 다섯 모듈에서 검증
- analytics/AI non-listening, listening prerequisites, WFM-without-skills, connector-independent manual path, missing country-pack generic-payroll 유지 negative
- unknown capability/version downgrade/cycle mutation 차단

실제 provider adapter/retry/idempotency는 G4, tenant entitlement/credential/country-pack certification/SLO는 G6입니다.

## 구현 순서와 병렬 경계

| Chunk | 단계 | 작업 | 병렬성 | 종료조건 |
|---|---|---|---|---|
| C0 | START | latest dwp-dev + common WIP를 단일 checkpoint로 통합 | integration owner 직렬 | clean immutable BE/FE manifest |
| C1 | START | migration successor/rename/range/validator | 중앙 직렬 후 독립 readback | collision/upgrade/mutation PASS |
| C2 | START | identity owner ABI/adapter + 5 consumer | owner 중앙 후 소비자 병렬 | all-five compile, direct DB 0, negatives PASS |
| C3 | START | optional matrix/guard/no-call | C2와 병렬 가능 | machine validator + cross-module tests PASS |
| C4 | START | 5 pair fanout/isolation/receipt | semaphore 범위 병렬 또는 순차 | 5 current authoring receipts |
| C5 | START | current/full/published/self-test 독립 감사 | 직렬 | authorized Gate publication |
| C6 | G4 | real owner/PEP/startup/supplemental wiring | shared ABI 후 service 병렬 | native integration receipts |
| C7 | G6 | production ledger/transport/key/runtime-only/adoption | 승인 흐름 직렬 | 명시적 G6 승인 |

## 모듈 세션 START 결론

지금은 `START-P0-003/004/005/007/008`이 **하나의 current immutable checkpoint에서 동시에 닫히지 않았으므로 `NO_GO`**입니다. C0~C5가 같은 source pin에서 모두 통과하고 승인된 canonical Gate가 실제로 열릴 때만 HRM/PER/PAY/TIM/SYS 다섯 독립 세션의 전체 메뉴 개발을 시작할 수 있습니다.

본 감사가 backend/frontend 소스, canonical register 또는 Gate를 수정하지 않았습니다. 상세 path/hash, exact close condition, 최소 파일·테스트 allocation과 stage 분류는 동명 JSON에 기계 판독형으로 기록했습니다.
