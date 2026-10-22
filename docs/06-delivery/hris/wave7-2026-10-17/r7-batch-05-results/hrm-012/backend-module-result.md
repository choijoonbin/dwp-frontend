# HRM-012 Backend module result

HRM-012 backend 구현은 허용된 모듈 경계에서 완료되어 전용 backend branch에 커밋·푸시되었습니다. 최신 고정점은 `b5e71940ba96d6d6daec2eaacc4ac00954089efa`, tree는 `5b14cee170175f194387492ed4ecb26cb6fc8cd7`이며 `HEAD=origin`, clean, `git diff --check` 통과 상태입니다.

## 권위와 활성화 경계

- 원 start token SHA-256은 `0592ca8b606236f0e36c639c547a94387dd517754fbb4a3ada091bbca19b662d`입니다.
- 격리 저장과 출력 금지 범위를 분리한 append-only correction은 dwp-frontend `dwp-dev`의 `aadf12379fc71defc02cad94491132428fbbd5dd`에 고정되었고, 파일 SHA-256은 `c6ff15bdad9f14695d02f69fa5e840c9c6ba631fb7b65d8366acc038b888dcdd`입니다. 독립 검토 결과는 P0/P1/P2 `0/0/0`, GO입니다.
- 기능 키 `HRIS_HRM_DATA_QUALITY_WORKBENCH`는 기본 OFF이고 tenant enrollment는 0입니다. runtime entrypoint와 두 controller는 `dwp.hris.data-quality-workbench.enabled=true`일 때만 생성되며 `matchIfMissing=false`입니다.
- route/menu/provider/scheduler/broker를 활성화하지 않았습니다. production object·mapping·effect·quarantine·credential/key provider 대신 fail-closed adapter만 존재합니다.
- 기존 frontend 증적 `frontend-module-result.v1.json`은 수정하지 않았습니다. 해당 증적은 commit `a2d9320d5d9b9c7b846832aea79877b0242e1c75`에 고정되어 있으며 default-OFF zero-call, 비마운트 route/menu와 29개 frontend 논리 테스트를 기록합니다.

## 구현 결과

- IAQ-012 exact GET schema, population closure, 7-layer PEP, VIEW/MASK/OMIT, 안정 정렬과 tenant/scope/revision에 묶인 fixed-digest cursor
- PEP-HRM-015의 exact six-field command, receipt-first idempotency, complete trusted snapshot, post-receipt exact equality, object-access ordering
- same-tuple safe retry, terminal race short-circuit, deterministic duplicate, immutable linked replay, encrypted quarantine-after-acceptance
- VALIDATE_ONLY/APPLY별 닫힌 accounting과 cursor/run/receipt/audit/outbox 원자적 reconciliation
- exact 10-field `WorkforceIngestionReconciled.v1`, JCS digest와 결정적 event identity
- People V60의 정확히 두 개 ledger table, FORCE RLS, immutable evidence, terminal insert 차단과 expired-RUNNING lease recovery
- stale HRM-008 상수와 그 두 assertion만 제거하고 기존 route/capability 회귀 없음 확인

변경은 44개 파일(신규 41, 수정 3), `+11,393/-3`이며 허용 경계 밖 변경은 0입니다.

## 비반복 검증 회계

최초 bounded 진단은 49개 중 37 PASS/12 FAIL로 끝났습니다. 이 실행을 최종 PASS로 표기하지 않았고 동일 bundle을 재실행하지도 않았습니다. 실패한 IAQ, idempotency, linked replay, transport만 최소 단위로 수정·재검증했습니다.

후속 11-class 진단도 43개 중 42 PASS/1 FAIL이었습니다. 남은 실패는 확정된 safe-retry 규칙과 충돌한 stale test였으며, 이 bundle 역시 반복하지 않았습니다. 이후 영향 범위만 다음과 같이 닫았습니다.

- 6-class affected bundle 36/36 PASS, Authorization 2/2 PASS
- Reconciliation + Outcome 12/12 PASS
- V60 contract 전체 6/6 PASS
- V60 실제 PostgreSQL 최초 전체 10개는 9 PASS/terminal assertion 1 FAIL이었고, 실패한 named case만 1/1 PASS로 닫았습니다. 이 실행에서 V59→V60 upgrade, 두 table의 FORCE RLS missing/cross-tenant denial, rollback, lifecycle-negative, linked replay 표적이 모두 통과했습니다.
- V60 contract 1 + 실제 PostgreSQL 9 = 10/10 PASS
- expired-RUNNING recovery contract 1 + 실제 PostgreSQL 1 = 2/2 PASS
- 최종 backend commit `b5e71940...`에서 필수 실제 PostgreSQL 5개(V59→V60 upgrade, FORCE RLS, rollback/retry, lifecycle-negative, linked replay)를 한 번의 named 실행으로 5/5 PASS했습니다. BUILD SUCCESSFUL 28초, XML은 failure/error/skipped 0입니다.
- JCS 4/4 PASS
- `compileJava`, `compileTestJava`, 최종 `git diff --check` PASS

따라서 최종 판정은 “처음부터 한 번에 모두 통과”가 아니라, 이미 통과한 표적은 유지하고 실패·변경 표적만 재검증한 correction chain과 최신 소스 독립 검토에 근거합니다. 이후 V60 변경은 receipt/marker/terminal/shared-cursor/item-lock/expired-lease에 국소화되었고, 그 영향 표적은 후속 named PostgreSQL 또는 contract 실행으로 별도 통과했습니다. 마지막으로 초기 통과 후 유지했던 필수 DB 5개도 최종 commit에서 다시 한 번 정확히 실행해 gap을 닫았습니다. 저장소 전체 suite는 실행하지 않았습니다.

## 인수조건과 독립 검토

AC01~AC13은 backend 결과와 기존 frontend 증적을 합쳐 모두 PASS로 매핑했습니다. 특히 AC04의 receipt-first/safe retry, AC09의 실제 transaction·cursor atomicity, AC11의 lease recovery/linked replay, AC12의 default-OFF·zero-call·비마운트 상태를 각각 별도 증거로 고정했습니다.

최신 Java/IAQ/receipt lifecycle/security 검토와 V60/실제 PostgreSQL 검토는 모두 P0/P1/P2 `0/0/0`, GO입니다. 이 결과는 중앙 admission, dwp-dev 직접 merge, 기능 활성화, tenant enrollment, customer data 또는 production release를 의미하지 않습니다.

상세 명령, 실패와 보완 실행의 구분, 파일 해시 및 AC01~AC13 기계 판독 매핑은 `backend-module-result.v1.json`에 기록했습니다.
