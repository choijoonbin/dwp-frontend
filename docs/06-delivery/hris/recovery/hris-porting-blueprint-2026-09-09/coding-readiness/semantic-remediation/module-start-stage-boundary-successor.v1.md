# HRIS 모듈 START 단계 경계 후속 계약

상태: **단계 분류 채택, Gate는 계속 `CLOSED_FAIL_SAFE`**. 이 문서는 운영 보안 목표를 낮추는 예외가 아니다. 기존 `runtime-only-wiring-producer-implementation-plan.v2`의 보안 불변식과 최종 운영 목표는 유지하고, 각 의무가 필요한 시점을 START·G4·G6로 정확히 나눈다.

## START에 반드시 완료할 C0~C5

| 순서 | 완료 대상 | 핵심 종료조건 |
| --- | --- | --- |
| C0 | 최신 불변 체크포인트 | 최신 승인 `dwp-dev`와 공통 WIP를 포함한 clean BE/FE integration SHA |
| C1 | migration successor | 실제 high-water, exact-byte rename lineage, 비충돌 owner range, clean/upgrade/mutation PASS |
| C2 | 신원 owner ABI | Auth·People owner adapter, HRM/PER/PAY/TIM/SYS consumer compile, direct cross-owner DB 0, fail-closed negatives |
| C3 | optional capability admission | closed matrix와 shared pre-call guard, 다섯 모듈 disabled/uninstalled zero-call, dependency mutation 차단 |
| C4 | 다섯 authoring 환경 | 동일 체크포인트의 clean BE/FE 5쌍, 격리 namespace, scoped command와 semaphore receipt |
| C5 | 최종 독립 Gate | live checkpoint/full-readiness/published-truth/self-test 전부 PASS |

C0~C5가 **동일한 불변 체크포인트**에서 모두 통과해야만 HRM/PER/PAY/TIM/SYS 모듈 세션의 전체 업무 코딩을 시작할 수 있다. 일부 모듈 또는 과거 증적만 통과한 상태에서는 전체 START를 선언하지 않는다.

## G4와 G6로 남겨 두되 면제하지 않는 항목

- G4: 구현한 기능의 실제 authenticated owner transport, point-of-use PEP, 서비스 startup guard, enabled supplemental stream, native multi-service 통합 및 stale/revoke/tenant/privilege/race 반례.
- G6: durable publication/current ledger, workload identity, HSM급 key lifecycle, lease/drain, 운영 credential 제거, 고객사·국가팩·provider·용량·관측·백업/복구·DR 승인.

G3 START 증적은 기능 구현 완료나 G4 수용을 뜻하지 않으며, G4 수용도 고객 운영 활성화를 뜻하지 않는다. 반대로 기능이 해당 단계에서 실행되는 순간에는 owner/source/PEP/current freshness, fail-closed, no-fallback, optional zero-call 보안 의미를 그대로 지켜야 한다.

기계 판독 정본은 [동반 JSON](module-start-stage-boundary-successor.v1.json)이며 `validate_module_start_stage_boundary.py`가 predecessor/audit pin, C0~C7 DAG, START finding 배치, 필수 불변식과 단계별 금지 주장을 fail-closed로 검사한다.
