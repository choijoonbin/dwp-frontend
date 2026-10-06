# HRIS 모듈 exact-business P0 successor 독립 재감사

기준 시각: 2026-09-14 22:12 KST  
판정 권한: `INDEPENDENT_REAUDIT_EVIDENCE_NO_GATE_AUTHORITY`

## 결론

HRM·PER·PAY·TIM의 모듈 고유 exact-business 설계 P0는 versioned canonical successor로 닫혔다. 그러나 전체 코딩 시작 판정은 **`FAIL_CLOSED_NO_G3_START`** 이다. 이 결과는 G4 준비, 기능 구현 완료, 현재 통합 소스 승인 또는 Gate 개방을 뜻하지 않는다.

두 판정은 의도적으로 분리한다.

- 모듈 계약: `EXACT_BUSINESS_DESIGN_P0_PASS_GLOBAL_GATE_STILL_REQUIRED`
- 전역 시작 Gate: `NONE_CLOSED_FAIL_SAFE`
- 실제 구현: `runtimeImplemented=false`
- production: G6 미승인

## 무엇을 정본으로 승격했는가

기존 HRM/PER, PAY v2/v3, TIM v4 proposal 전체를 승인하지 않았다. SHA로 봉인한 역사적 제안에서 타당한 결정을 다시 명시하고, 다음 결함을 버린 새 정본만 승격했다.

- 불가능한 closed `allOf`, 필수 source의 `NULL`, `OPEN_EXACT_SOURCE`
- generic patch, free-text 실행 규칙·급여식
- digest만 있고 재조회할 authoritative artifact/source vector가 없는 계약
- caller가 score/cohort/distribution의 권위가 되는 계약
- correlation ID 또는 first UUID로 업무 identity를 추정하는 계약
- schedule/timecard/accrual/pay formula/period-close/effective-dating/population-freeze의 부분 상태기계
- 미게시 proposal을 runtime truth처럼 사용하는 패턴

새 정본은 다음 파일로 구성된다.

- `module-exact-business-start-canonical.v1.json`: 4개 모듈, 30개 aggregate 상태기계, BASE-P0-004~011의 일대일 closure
- `module-exact-business-schemas.v1.json`: Draft-07 closed schema 34개와 TIM/PAY typed operator registry
- `module-exact-business-lineage-register.v1.csv`: target family·transport PEP/SVC·API-SoR·semantic scope·read source·write set·fixture·세션 prompt를 연결한 16개 binding
- `module-exact-business-fixtures.v1.json`: 유효 schema 12, positive journey 11, negative 51
- `module-exact-business-start-pin.v1.json`: 정본·schema·fixture·lineage·primary validator·4개 세션 prompt의 9개 SHA pin

## 감사 지적별 closure

| 지적 | 모듈 | exact-design 결과 |
|---|---|---|
| BASE-P0-004 | TIM | schedule을 native period/assignment/segment aggregate로 정의하고 validate→submit→approve→publish→amend/cancel/reconcile, CAS, source vector, timezone/DST, correction lineage를 고정했다. |
| BASE-P0-005 | TIM | 시간 규칙과 accrual을 closed typed AST/policy로 바꾸고 arity/type/unit, eligibility, enrollment, basis, cap, carryover, expiry, proration, calendar, rounding을 고정했다. |
| BASE-P0-006 | TIM | timecard storage와 wire가 동일한 literal vocabulary를 쓰며 `LOCKED`, `CLOSED`, `CORRECTION_REQUIRED`를 구분한다. |
| BASE-P0-007 | HRM | 고용 이벤트를 closed discriminator로 만들고 최초 입사·다중 고용·발령·휴직/복직·퇴직·정정의 event-specific body, version, write set을 고정했다. separation은 별도 guarded aggregate다. |
| BASE-P0-008 | PER | cycle/population/goal/evaluation/feedback/check-in/calibration/result/appeal/talent-growth의 terminal state까지 named command 또는 trusted owner signal로 도달한다. caller baseline은 compare-only다. |
| BASE-P0-009 | PER | population freeze를 네 필수 필드의 단일 closed object로 평탄화하고 owner 재조회·재계산·hash 비교·stale 차단·atomic freeze를 정했다. |
| BASE-P0-010 | PAY | full foundation artifact, HRM/TIM/PER/config/country-pack source vector, typed formula AST, unit/currency/rounding, immutable run attempt와 close/reopen/correction을 고정했다. |
| BASE-P0-011 | TIM | WFM availability 소유자는 TIM이며 HRM assignment/location과 TIM schedule/leave/arrangement를 조합한다. PER skill 미설치 상태는 typed `NOT_INSTALLED`이고 PER 호출은 0회다. |

## 독립 재검증

작성자 validator만으로 승인하지 않았다.

1. Node/Ajv primary validator는 schema와 semantic graph를 함께 검증한다.
2. Python stdlib independent auditor는 Node validator를 import하거나 실행하지 않고, 먼저 9개 immutable pin을 검증한 뒤 별도 구현으로 state reachability, typed operator set, lineage, fixture 의미와 mutation을 다시 계산한다.

최종 실행 결과:

| 실행 | 결과 | 실제 검증 수 |
|---|---|---|
| `node coding-readiness/validate_module_exact_business_start.cjs --self-test` | PASS | schema-valid 12 + journey 11 + negative 51 + mutation 12 = 86; 상태기계 30, lineage 16 별도 |
| `python3 -B coding-readiness/audit_module_exact_business_start.py --self-test` | PASS | pin 9, fixture inventory/closure link 74, 상태기계 30, lineage 16과 critical schema/operator 불변식을 별도 계산; mutation 12/12 차단 |
| `python3 coding-readiness/validate_target_family_resolution.py --compact` | PASS | family 86, parent 2,269, child 10,001 |
| `python3 coding-readiness/validate_transport_schema_resolution.py --self-test --compact` | PASS | 고의 변조 28종 전부 차단 |
| `python3 coding-readiness/validate_hris_api_sor_transitions.py --compact` | FAIL | 현재 integration FE의 `payroll-api.ts` 부재로 source transition seal 해소 불가 |

primary validator가 실제 실행한 exact-business scenario는 86회이며, 그중 fixture 74개와 validator mutation 12개다. 독립 auditor는 같은 fixture의 JSON-Schema 실행 횟수를 중복 주장하지 않고, 9개 pin과 fixture closure, 30개 상태기계, 16개 lineage, critical schema/operator 불변식을 별도 구현으로 재계산한 뒤 추가 mutation 12종을 차단한다. transport validator의 고의 변조 28종은 별도다.

독립 auditor의 첫 mutation 실행에서는 모듈 제거 변조가 의도대로 실패하는 대신 `KeyError`로 중단되는 validator robustness 결함이 드러났다. 누락 모듈을 먼저 `MODULE_SET_DRIFT`로 판정하도록 보강한 후 최종 SHA `f33eb83d92e930986fc74517ed38920dd9d00a02ec3e7d5dde4bb200f7414ed8`에서 12/12 mutation이 모두 fail-closed 됐다.

## 아직 닫히지 않은 시작 차단 항목

- `BASE-P0-001 / START-P0-005`: 현재 migration high-water와 create-only owner allocation successor
- `BASE-P0-002 / START-P0-001 / START-P0-002`: 현재 transport/API source lineage 및 corrected central-byte publication. 현재 API-SoR validator가 실제 FAIL이다.
- `BASE-P0-003 / START-P0-003`: 설계에는 명시적 multi-employment 선택을 넣었지만, 실제 Auth principal→People person→worker→relationship→assignment owner adapter, freshness와 lifecycle 연결은 아직 없다.
- `START-P0-004`: shared DTO/SPI/PEP, field/purpose/population enforcement와 13-stream runtime startup 연결
- `START-P0-006`: 현재 공통·모듈 실행 증거와 authoritative LIVE 2회
- `START-P0-007`: 5개 세션 환경 receipt와 승인된 capacity/concurrency 계획
- `START-P0-008`: optional installed/uninstalled admission과 실제 owner call-count runtime fixture
- G4: migration, handler, projection, engine, UI function과 native happy/denied/replay/correction journey 구현
- G6: 실 법정팩·은행·세무·보험·ERP·고객사 데이터 및 운영 승인

따라서 모듈별 exact-business 계약은 독립 구현자가 재결정 없이 소비할 수 있는 수준이지만, 위 공통 선행조건이 닫히기 전에는 세션 prompt의 `NO_G3_START`를 변경할 수 없다.

## 재현과 pin

독립 재감사 입력 pin:

- `coding-readiness/module-exact-business-start-pin.v1.json`
- SHA-256: `2d482081ccf3a227582454d171ff7fcf825a0f70af58c54971bcf4aafca7b25c`

blueprint 루트에서 다음을 실행한다.

```bash
node coding-readiness/validate_module_exact_business_start.cjs --self-test
python3 -B coding-readiness/audit_module_exact_business_start.py --self-test
```

두 명령이 모두 exit 0이어야 하며, 어느 명령도 G3/G4/READY/Gate를 변경할 권한이 없다.
