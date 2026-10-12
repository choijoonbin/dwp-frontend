# 2026-10-12 HRIS G7 통합 로드맵 상태 Successor

> 상태: G7 evidence promotion complete; PER/TIM domain authoring authorized; SYS/HRM/PAY/Agent withheld
>
> 기준일: 2026-10-12
>
> 판정: [G7 Evidence Promotion and Delegation Receipt](2026-10-12-g7-evidence-promotion-and-delegation-receipt.json)

G6 W1은 frozen Frontend `4546024ca9036f217c1d13ddb0622c21a3264b60`, Backend `c0d72ca8e26a6e2a0b3885b62c0aa0e3ad7b1329` 조합에서
full mode 정확히 1회 실행되어 28/28 phase와 15/15 checkpoint assertion을 통과했다. G7은 이 실행을
재실행하지 않고 raw SHA-256을 별도 G6 receipt로 승격했다.

## G7 판정

| 모듈 | Slice | 상태 | 현재 허용 범위 |
| --- | --- | --- | --- |
| PER | `BASE-TFR-PER-006` | `AUTHORIZED` | token-bound 새 child 경로와 Performance V2 migration의 domain authoring만 |
| TIM | `BASE-TFR-TIM-006` | `AUTHORIZED` | token-bound 새 child 경로와 Time V8 migration의 domain authoring만 |
| SYS | `BASE-TFR-SYS-007` | `START_WITHHELD` | packet/Platform V325 예약만; Control bootstrap 결과 pin 전 소스 변경 금지 |
| HRM | `BASE-TFR-HRM-010` | `START_WITHHELD` | packet/People V54 예약만; event·양방향 Approval handoff pin 전 소스 변경 금지 |
| PAY | `BASE-TFR-PAY-016` | `WITHHELD` | `MOD-PER-COMPPLAN` producer result와 named test 전 packet/token/lease 없음 |
| Agent | 없음 | `WITHHELD` | canonical slice와 deterministic owner tool contract 전 packet/token 없음 |

PER/TIM token은 공통 경로 편집, 중앙 integration merge, customer data, activation 또는 production release를
허용하지 않는다. Frontend와 Backend는 각각 전용 pushed branch/worktree에서 단일 writer로 작업한다.
공통 authorization, generated contract, Gateway, route, shell, i18n 작업은 module result 이후 Control request로
한 번에 처리한다.

## 검증 효율화

G7에서는 application code와 W1을 다시 실행하지 않았다. 검증은 input/raw hash, Git object/tree/clean/upstream,
102행 closed set, packet/token/lease 1:1 결박, migration high-water, path overlap 및 manifest seal만 수행했다.
모듈 구현도 변경 cluster test를 먼저 실행하고 실패를 일괄 수정한 뒤 module batch를 한 번 수행한다.

## 다음 실행 순서

1. `HRIS-PER`가 `BASE-TFR-PER-006` packet/token으로 population freeze vertical slice를 구현한다.
2. `HRIS-TIM`이 `BASE-TFR-TIM-006` packet/token으로 clock ingestion/void vertical slice를 병렬 구현한다.
3. 각 module result commit과 targeted evidence가 준비되면 Control lane이 해당 CR을 한 묶음으로 통합한다.
4. SYS/HRM은 별도 중앙 Control bootstrap이 계약 result pin을 만든 뒤에만 새 promotion receipt/token을 받는다.
5. PAY는 `MOD-PER-COMPPLAN`이 완료된 뒤 재분류하며 Agent는 canonical work definition이 생길 때까지 보류한다.

이 문서의 bundle commit은 `6ff72b672743751cb8851e968b87c1c2b848e9e0`이며 final promotion receipt가 PER/TIM token만
활성화한다. 과거 G3 code-go token과 stale G1 overlay는 현재 작업 권한이 아니다.
