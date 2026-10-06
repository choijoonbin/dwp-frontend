# Identity C2 — five-consumer final evidence

## 결론

C2의 제한된 목표를 완료했습니다. HRM, PER, PAY, TIM, SYS가 owner-neutral `dwp-platform-contracts` identity ABI를 각각 독립적인 audience/purpose로 compile하고, adapter 누락과 owner 장애 시 fallback 없이 실패하는 증거가 있습니다. backend는 기준 `b6d1f23e`에서 단일 커밋 `fc8fbfd38103f7fb2b47adaea861e5327450a74e`로 고정됐고 worktree는 clean입니다.

이 결과는 consumer compile/fail-closed 시작 증거입니다. production HTTP, Spring bean 등록, 실제 PEP 연결 또는 업무 handler 연결을 구현하거나 완료로 주장하지 않습니다.

## 5개 소비자

| 모듈 | 서비스 / bounded context | Audience | Purpose | 증거 |
|---|---|---|---|---|
| HRM | People / `people.hris.identity.v1` | `HRIS_HRM` | `SELF_PROFILE_READ` | selected projection + missing adapter + owner unavailable |
| PER | People / `people.hris.performance.identity.v1` | `HRIS_PER` | `SELF_PERFORMANCE_READ` | HRM과 분리된 package witness + no HRM fallback |
| PAY | Payroll / `payroll.hris.identity.v1` | `HRIS_PAY` | `SELF_PAY_READ` | selected projection + no fallback |
| TIM | Time / `time.hris.identity.v1` | `HRIS_TIM` | `SELF_ATTENDANCE_READ` | selected projection + no People DB fallback |
| SYS | Platform / `platform.hris.identity.v1` | `HRIS_SYS` | `SELF_HRIS_HOME_READ` | 별도 Platform consumer witness + no fallback |

`SelfContextPurposeV1`에는 PER와 SYS purpose/audience만 additive로 추가했습니다. 기존 HRM/TIM/PAY 값은 변경하지 않았습니다.

각 소비자 test는 정상 경로에서 verifier/Auth/People provider를 각각 한 번 호출하고 guard가 검증한 native ID와 revision만 projection합니다. adapter가 하나라도 없으면 provider 호출 전 `ADAPTER_UNAVAILABLE(0/0/0)`, verifier owner가 실패하면 `OWNER_UNAVAILABLE(1/0/0)`이며 다른 경로나 DB로 우회하지 않습니다.

## 공통 fail-closed 검증

기존 guard 계약 59건과 progress-clock 회귀 1건을 그대로 실행했습니다.

- 잘못된 tenant: 실패 owner layer에 따라 `AUTH_BINDING_INVALID` 또는 `OWNER_RESPONSE_INVALID`, 이후 provider 호출 차단.
- 고용 context 0건: `SELF_SCOPE_UNRESOLVED`, 호출 `1/1/1`.
- 복수 고용 context: 첫 항목을 암묵 선택하지 않고 `SELECTION_REQUIRED`; 명시 selector로만 선택.
- user row version 또는 access revision stale: `AUTH_BINDING_STALE`, 호출 `1/1/0`.
- owner unavailable: `OWNER_UNAVAILABLE`, 호출 `1/0/0`.
- adapter missing: `ADAPTER_UNAVAILABLE`, 호출 `0/0/0`.

## 경계와 소스 스캔

새 [정적 검증기](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_identity_c2_consumers.py)는 다섯 witness의 `com.dwp.*` import가 오직 `com.dwp.platform.contracts.hris.identity.v1` ABI인지 검사하고 Auth/People repository, JDBC, JPA, DataSource, EntityManager 사용을 거부합니다.

- 소비자 witness 5/5 존재, 서로 다른 bounded-context package.
- ABI-only DWP import: PASS.
- direct cross-owner DB access: 0.
- missing consumer, wrong purpose, direct JDBC import, fallback 증거 제거, purpose/audience rehome mutation: 5/5 거부.
- 전체 repository service-boundary scan: 72개 ratchet test 및 실제 scan PASS.

Auth native binding reader, People native context reader, v1 self-context/self-person guard, v2 authorization guard, People v2/v3 admission pilot의 7개 digest도 기준과 동일합니다. migration SQL과 optional package는 변경하지 않았습니다.

## 실행 결과

모든 비용성 명령은 공통 `hris-verification` semaphore 아래 `--no-daemon --max-workers=1`로 직렬 실행했습니다.

- Focused tests: 75건, failure/error/skip 0. 공통 계약 59 + progress clock 1 + 소비자 15.
- Semaphore: 즉시 획득, focused 44.533초, quality 8.28초.
- Service-boundary ratchet: 72건 및 실제 scan PASS.
- Production source-size: 2,172 파일 PASS.
- Test source-size: 1,108 파일 PASS.
- Static C2 validator: PASS, self-test 5/5.
- `git diff --check`: PASS.

## 변경 경계

backend 커밋에는 `SelfContextPurposeV1`과 5개 소비자 test 파일만 포함됩니다. 신규 production adapter, controller, Spring security, repository, SQL, migration, provider/optional 기능은 포함하지 않았습니다.
