# Modern causal-semantic independent audit — FAIL / P0

결론: 현재 modern 계약은 자동검증이 모두 PASS였지만 모듈 코드 Gate를 열 수 없습니다. 구조적 closure는 닫혔으나, 그 closure가 동일 generator가 만든 canonical·semantic registry·identity registry를 서로 대조하는 방식이어서 실제 operation 의미 오류를 false-pass 했습니다.

기계 판독 가능한 전체 기준은 modern-causal-semantic-independent-audit-2026-09-15.json에 기록했습니다.

## 재현 결과

- 93 semantic tests: PASS
- generator --check: PASS, typeFallbacks=0, eventFallbacks=0, explicitBindings=3079
- semantic normal/self-test: PASS, errors=0, operations=100
- modern normal/self-test: PASS, capabilities=16, operations=100, events=32, tables=56
- PostgreSQL 16 feasibility: PASS, 그러나 DDL 생성/constraint 설치/ROLLBACK만 수행하며 실제 INSERT·UPDATE는 0건
- 독립 hostile mutation: 19건 실행, 19건 기대대로 거부
- closure: operation 100, event 32, modern table 56, typed source 1,183, input mapping 744, required-column edge 1,130, response edge 657, event edge 548, write-set edge 137

## 7개 차단 사유

1. P0 상태 전이: 전이 command 81개 모두 physical post-state mutation edge가 없습니다. 선택한 물리 컬럼 CHECK와 불일치하는 post-state가 13개이며, 비-create 전이 6개는 새 INSERT/APPEND row에서 pre-state를 읽습니다.
2. P0 DDL/DML: 8개 테이블의 status DEFAULT가 CHECK와 충돌하며 10개 INSERT/APPEND operation path가 실제 실행 시 실패합니다.
3. P0 이벤트 인과성: event field가 write-set 외 테이블에서 오면서 명시적 selector/join 계약이 없는 edge가 58개입니다. ATS, onboarding, benefits, skills, learning, marketplace, compensation, WFM, listening, analytics, AI governance의 43개 operation을 operation 단위로 재설계해야 합니다.
4. P0 입력 효과/selector: required 입력 253개가 generic guard-only이고, required path selector 42개는 typed/persistence/response/event data dependency가 없습니다. title, displayName, reasonCode, visibility, amount, currency가 수용된 뒤 버려질 수 있습니다.
5. P0 requiredness: optional request에서 NOT NULL/no-default 컬럼으로 가는 edge 5개, required event field로 가는 edge 1개가 있습니다.
6. P0 identity: compensation snapshot 응답의 snapshotId, planId, cycleId 세 값이 모두 prf_cmp_approved_snapshots.public_id로 붕괴합니다.
7. P1 차단 oracle: semantic/public-identity registry는 candidate canonical에서 생성되어 다시 candidate와 비교됩니다. byte drift는 막지만 의도된 업무 의미의 독립 oracle은 아닙니다.

## 요구 successor

각 operation마다 primary aggregate, target selector, pre-state source, exact physical post-state sink/literal, ordered column mutation set, request field effect, event subject/causal write edge, cross-aggregate join/cardinality/version/as-of/null 규칙, distinct public identity를 독립 승인된 successor oracle에 고정해야 합니다. Generator는 request field나 readsTables를 자동 추가하여 의미 공백을 숨기면 안 됩니다.

## 신규 검증 Gate

기존 93 tests에 상태 sink/CHECK/aggregate, DEFAULT-CHECK, required-input effect, target selector, optional-to-required, event subject/causal join/auto-read/ambiguous identity, compensation ID collapse, reseal self-certification, generated API drift를 겨냥한 18개 mutation·execution family를 추가해야 합니다.

PostgreSQL 검증은 DDL compile에서 끝내지 않고 45개 operation transaction, 58개 INSERT/APPEND edge 전부에 대해 최소 유효 fixture를 실제 실행해야 합니다. commit 가능성, persisted post-state, required input 효과, outbox causal subject, idempotent replay, 실패 시 aggregate·receipt·outbox 원자 rollback을 검증해야 합니다.

errors=0, 확장 정의의 typeFallbacks=0/eventFallbacks=0, 신규 mutation 전부 거부, 45/58 실제 DML PASS, 독립 재감사 P0/P1=0이 모두 충족된 뒤에만 Gate를 다시 검토할 수 있습니다.

이 보고서는 remediation 이전 baseline을 고정합니다. successor 변경 후 digest와 reciprocal pin을 재생성하고 별도의 독립 재감사가 필요합니다.
