# TIM WFM 설계안 독립 검토

결론: **현재 snapshot은 G3 준비 완료가 아닙니다.** 검토 상태는 INDEPENDENT_REVIEW_BLOCKED_G3_NOT_READY / G3_AUTHORIZATION_NONE이며, G4 실제 업무 실행·G5 디자인 패키지는 아직 실행하지 않았습니다.

수요·후보안·solver run·평가·승인·게시 객체 분리, 실제 WORK/BREAK 구간과 시간대·정책 snapshot 보존, TIM owner 단일 트랜잭션의 방향은 적절합니다. 직접 응답 컬럼 65개와 테넌트 복합 FK 18개는 계획된 컬럼·unique target과 일치했습니다. 그러나 이것이 전체 28개 작업의 검증을 대체하지는 않습니다.

검토 원본은 [JSON](../semantic-remediation/tim-wfm-exact.proposal.v1.json) / [MD](../semantic-remediation/tim-wfm-exact.proposal.v1.md)이며, SHA-256은 각각 `5c0af043947c007c9304edb29519a8176011fd46180cfa49d2d04d2f0107bd91` / `d17c150c44315d0018dc6a8ed68103ad291944729a7c6d3a59ce9bf3a0aca674`입니다. 검토 종료 대조에서도 원본 변경은 없었습니다. reviewer는 이 보고서 두 파일만 생성했습니다.

## 우선 해소할 P0

### TIM-WFM-001 — 무기술 요구의 native WFM에서도 PER snapshot을 강제함

requiredSkills가 absent/empty인 native 수요는 PER 없이 실행하도록 정의했지만 PlanningWorker.skillSnapshotRef는 required=true이고 planning worker의 skill/source rows도 PER owner가 무조건 소유한 값만 요구한다. source missing이면 zero snapshot + 409/503라는 create 규칙과 결합하면 선택 모듈 경계가 깨진다.

조치: needsSkills를 frozen demand/constraint의 실제 요구로 결정하고 skill snapshot/ref/qualifications를 조건부로 정의한다. 무기술 경로는 PER 호출 0, optional ref absent/empty typed qualifications, 동일 TIM work/rest rule 적용. Skill feature가 없는데 실제 요구가 있으면 명시 capability error로 거부하며 latest/fabricated snapshot fallback 금지.

근거 pointer: `/recordSchemas/1/fields/8`, `/recordSchemas/5/checks/0`, `/tableSpecifications/4/columns/5`, `/tableSpecifications/4/columns/6`, `/planningInputOwnerDecision/composition`.

### TIM-WFM-002 — 만료된 RUNNING lease를 RESULT_UNKNOWN으로 fence할 수 없음

lease-claim은 expired external execution을 RESULT_UNKNOWN/reconcile로 처리하라고 하나 mark-unknown은 unexpired exact lease를 요구한다. owner-clock이 lease_expires_at을 지난 최초 시점에는 선언한 UNKNOWN 경로가 실행 불가능하다.

조치: verified owner watchdog의 timeout→UNKNOWN 전이를 completion/failure의 live-lease 조건과 분리한다. 정확 current run/lease/candidate/input/cancel fence CAS로 실행하고 old delivery를 fence한다. lease 만료 자체를 안전한 신규 dispatch로 해석하지 않는다.

근거 pointer: `/internalOperations/0/guards/2`, `/internalOperations/3/solverRunGuard`, `/internalOperations/3/guards`, `/tableSpecifications/6/columns/4`.

### TIM-WFM-003 — solver 출력이 frozen 수요·worker membership·worksite 요구를 지울 수 있는 모호성

shift.requiredSkills는 solver가 보낸 verified shift 필드에서만 저장되고 absent/empty이면 skill 요구가 없다고 정의된다. demandLineKey FK는 수요행 존재만 증명한다. frozen demand.required_skills의 권위/equality, planning snapshot의 worker+assignment membership, forecast worksite binding은 exact guard/source graph에 없다. 구현 취약점이 이미 실행됐다는 주장이 아니라 검증 전 설계의 중대한 미정 경계다.

조치: 수요의 requiredSkills를 authoritative frozen demand에서 owner가 재도출하고 callback의 임의 축소/변경을 거부한다. 각 worker/assignment는 정확 planning snapshot의 허용 구성원, worksite는 해당 frozen forecast/location으로 검증한다. 공급자가 결정하는 값과 owner가 결정하는 값의 DTO·source authority를 분리한다.

근거 pointer: `/recordSchemas/8/fields/7`, `/recordSchemas/8/checks/4`, `/tableSpecifications/7/columns/9`, `/tableSpecifications/7/foreignKeys`, `/internalOperations/1/guards`, `/operationDeltas/14/rules`.

### TIM-WFM-004 — 28개 operation의 쓰기·receipt·event·nested projection closure가 아직 없음

각 table.column의 source가 설명 문자열이고 per-operation reads/write variants/typedSources/requiredColumnSources/receiptContracts/inputMappings/responseFieldSources/eventFieldSources는 정의되지 않았다. actual receipt/outbox 컬럼을 정확히 이름붙인 개선은 확인했으나 callback의 원본 optimize receipt resolution, 원자적 finalization, public vs internal ID provenance 및 nested projection을 완전 검증할 수 없다.

조치: 수정·생성·no-op·실패·internal outcome별 exact successor graph를 생성한다. FK/entity oracle·actual G2 receipt/outbox SQL·등록 derivation inputs·closed owner DTO에 대조하고 source missing이면 실패한다. run→candidate→원본 receipt의 exact sealed action/tenant/caller/request relation도 지정한다.

근거 pointer: `/operationDeltas`, `/internalOperations`, `/queryProjectionBindings`, `/operationResultBindings`, `/eventContractDecision`, `/stillOpenG3/0`.

### TIM-WFM-005 — solver/Approval reconcile은 typed 실행 계약이 아닌 skeleton

solver reconcile에 inputSchema/writes/actor/lease fences/outcome-specific run+candidate+receipt+outbox transition이 없고 Approval reconcile에도 exact submission request ID/input/outcomes/write graph가 없다. 선언된 abstract candidate 상태는 모두 도달 가능하지만 실제 UNKNOWN/approval/cancellation 과정의 원자적 실행·재전송·대사 경로는 증명되지 않는다.

조치: 각 outcome의 closed owner input/verified evidence receipt, current lease/candidate/submission CAS, canonical error/outbox/receipt 결과를 게시한다. 외부 UNKNOWN을 임의 실패/성공으로 변환하거나 generic retry로 새 run을 만들지 않는다.

근거 pointer: `/internalOperations/4`, `/internalOperations/5`.

### TIM-WFM-006 — operation별 DWP 권한·owner PEP·두 설정 fixture는 아직 검증 불가

모든 public API는 APP.HCM/atomic duty/purpose/population/field/asOf라는 공통 문구만 있고 exact DWP action/group resource binding, owner read/refetch/callback PEP, workload lease owner equality와 denials는 없다. G3/G4 A/B settings는 배정 문자열이며 API-valid 정책/solver fixture의 실제 입력→행/event/receipt/오류 oracle가 없다.

조치: DWP 앱 하위 권한 그룹·atomic action을 재사용하여 22 public과 6 workload entry 각각 entitlement/duty/scope/mask/asOf/SoD/owner validation 규칙을 등록한다. 검증된 workload principal과 lease_owner_public_id를 정확히 묶는다. 법정값은 pinned country/work-rule policy로 설정하고 최소 두 실제 API-valid config + 결과 fixture를 정의한다.

근거 pointer: `/operationDeltas/0/requiredHeaders`, `/internalOperations/1`, `/tableSpecifications/5/rowSecurity`, `/testAllocation`, `/stillOpenG3/3`.

### TIM-WFM-007 — 현 source validator에 직접 넣으면 0 operation noop

독립 read-only 호출에서 raw errors=0, validated operations=0이었다. proposal에는 operationBindings/operationFieldLineage가 없어 validator가 22+6 작업을 읽지 않는다. 원본의 NOT_CANONICAL/G3_NONE 표기는 맞지만 오류 0을 readiness PASS로 인용하면 안 된다.

조치: 명시적 proposal dialect/schema 검증과 lossless successor 변환 뒤 operation closure=실제 28개(정당한 설계 변경 시 수량 갱신)를 검증한다. dialect/zero operations를 readiness runner가 reject해야 한다. 본 검토는 기존 validator를 변경하지 않는다.

근거 pointer: `/contractId`, `/operationDeltas`, `/internalOperations`, `/stillOpenG3/0`.

## 추가 P1 / 프로세스 개선

| ID | 등급 | 검토 결과 |
| --- | --- | --- |
| TIM-WFM-008 | P1 | 14개 commonTableContract 상대 경로가 존재하지 않음 |
| TIM-WFM-009 | P1 | 가용 구간 0개인 정상 worker를 표현할 수 없음 |
| TIM-WFM-010 | P1 | 이미 COMPLETED인 run과 취소 candidate의 상태·digest를 구분해야 함 |
| TIM-WFM-011 | P1 | OWNER_SNAPSHOT revision의 새 owner snapshot 입력 경로가 없음 |
| TIM-WFM-012 | P1 | internal payload 폐쇄와 segment enum dialect가 일관되지 않음 |
| TIM-WFM-013 | P1 | state event의 허용 상태와 outbox aggregate sequence를 확정해야 함 |
| TIM-WFM-014 | P1 | 0 headcount 수요의 빈 정상 결과를 무조건 blocker로 처리함 |
| TIM-WFM-015 | P2 | Approval 결정을 사용자 수동 reject/withdraw 후처리에 의존하지 않게 설계 |

대표적으로 14개 commonTableContract 상대 ref가 존재하지 않는 경로로 resolve되고, availableIntervals 최소 1개 조건은 전기간 휴가 등의 정상 worker를 표현하지 못합니다. 이미 COMPLETED인 run을 candidate cancel과 함께 무조건 CANCELLED로 바꾸면 result digest invariant와 충돌하므로 outcome별 CAS/write를 분리해야 합니다. OWNER_SNAPSHOT revision의 새 ref 입력, internal closed schema/enum dialect, event aggregate sequence/state와 zero-headcount 처리도 명확히 해야 합니다.

## 검증 결과와 실행 경계

- 제안: 22 public operations (13 commands / 9 queries), 6 internal operations, 14 tables, 22 records / 152 fields, 13 event schemas / 47 fields.
- 실제 수행: 전체 logical sections 검토, 65 direct projection columns·18 tenant-local/deferred FKs 대조, imported 3 schema IDs 존재 확인, actual G2 receipt/outbox 컬럼·status 대조, abstract state reachability 및 raw validator compatibility 검사.
- 컬럼명 존재 대조는 실제 공통 contract를 별도로 읽어 의도된 공통 컬럼까지 비교한 구조 검사입니다. 잘못된 상대 import의 해결이나 typed derivation/owner source 승인·SQL 실행으로 해석하면 안 됩니다.
- Abstract candidate 상태명 10개는 선언된 branch상 도달 가능합니다. guard와 owner 실행을 무시한 계산이며, 만료 lease·reconcile 실제 실행 가능성의 증명이 아닙니다.
- 현 semantic validator에 raw proposal을 넣으면 **errors 0 / validated operations 0**입니다. 미지원 dialect의 noop이므로 NOT_VALIDATED로 판정했습니다.
- 이 검토에서 native 업무 HTTP→rows→event/receipt 테스트나 Gradle/DB 실행은 하지 않았습니다. 실제 WFM domain 소스 매치는 현재 TIM production/test Java·SQL·JSON inventory에서 없었으며 G4 구현 배정으로 구분했습니다.
- Backend 관찰 HEAD는 `76130dde620084124a9c16ff8edc731487e0a4c3` / tree `b7007b8c27cd4cfb9aadf50a034e316e7864869e`입니다. 검토 시작 시 clean이었으나 뒤에는 다른 작업의 `scripts/devctl.py`, `scripts/tests/test_devctl.py` 변경이 관찰됐습니다. reviewer는 이를 건드리지 않았으며 현재 full backend readiness를 승인하지 않습니다.

## 부정 수용 기준

[Machine-readable 보고서](tim-wfm-proposal-independent-review-2026-09-14.json)에 15개 finding의 exact pointer·원본 excerpt·조치와 WFM-N01–N32의 요구 fixture를 보존했습니다. 무기술/PER 호출0, expiry UNKNOWN/late callback fence, frozen 요구 축소·membership·worksite 위조, source/receipt entity, Approval 대사·withdraw race, DWP PEP·cursor·replay, policy A/B, exact segments/paidness/DST/overnight, 단일 트랜잭션 rollback, counters/CAS와 event 최소화를 포함합니다. 이는 **실행된 업무 테스트가 아닌 요구 수용 정의**입니다.

원본의 DESIGN_PROPOSED_NOT_CANONICAL / G3_NONE / G4_NOT_EXECUTED 표기는 정확히 유지해야 합니다. 구체적 모순을 수정하고 versioned successor graph·owner DTO/SPI·PEP·API-valid fixture·common pilot을 독립 재검증한 후에만 G3를 검토할 수 있습니다.
