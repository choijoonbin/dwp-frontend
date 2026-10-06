# SYS G2 구현 계약 v2

상태: `CODE_READY_PENDING_CROSS_VALIDATION`  
source parent: 189 / decided: 189 / unknown: 0  
successor of: `g2-implementation-contract.md` (`SUPERSEDED_IMMUTABLE`; 역사 근거 전용)  
current migration authority: `g0/migration-allocation-register.csv`의 C1 successor + canonical modern 5개 계약에 합성된 Listening 4-stream 행. `coding-readiness/sys-listening-stream-authority-successor.v1.json`은 그 5개 입력으로부터 단방향 생성한 검증용 summary이며 독립 실행 정본이 아니다.

## 1. Target 책임

SYS는 SKKF 공통설정 모듈을 복제하는 서비스가 아니다. source 행위는 다음 DWP owner로 재배치한다.

| 책임 | Target owner | Frontend |
|---|---|---|
| HRIS 앱 entitlement, access package, assignment, static SoD | `dwp-auth-server/productaccess` | DWP 관리자 > 앱 거버넌스 > HRIS > 권한그룹 |
| HRIS 정책/config version lifecycle | `dwp-platform-server/hrisconfiguration` framework + domain content owner | HRIS 설정 |
| 중앙 automation definition/schedule/run receipt | `dwp-platform-server/automation` | DWP 관리자 > 자동화 |
| connector/secret/mapping/reconciliation control | `dwp-platform-server/integration` | DWP 관리자 > 연계; HRIS domain contribution |
| audit/evidence/search | 기존 DWP Audit | DWP 관리자 > 거버넌스/감사 |
| Home widget composition/freshness | Platform/Gateway read model + module contribution | `/hr/home` |
| 전체 업무 탐색 | Auth product-surface projection | `/hr/explore` |
| 통제 파일전송 | `dwp-platform-server` metadata/receipt + DWP Object/Scan provider | DWP 관리자 > 연계 > 파일전송 |
| 운영예외 통합조회 | `dwp-platform-server` read-only projection; 복구 command는 각 domain owner | DWP 관리자 > 운영센터 > HRIS 예외 |
| 공통 승인/알림/문서 | 기존 Approval/Notification/Object services | domain route에서 참조 |

신규 `dwp-sys-server`와 HRIS 전용 독립 인증 엔진은 만들지 않는다.

## 2. 관리자 경계

DWP 관리자는 플랫폼 통제를, HRIS 설정관리자는 업무 규칙 내용을 담당한다.

- DWP 관리자: 앱 설치/entitlement, 권한그룹·SoD, country/extension pack 설치, connector endpoint/secret/egress, automation executor/schedule, audit/retention/legal hold
- HRIS 설정관리자: 법인/기준정보, 사람/고용, 근태/휴가, 급여, 성과 policy의 draft/validate/simulate/approve/publish
- Domain 업무운영자: 실행 대상/예외/마감/계산 command. 정책 게시권을 자동으로 갖지 않음

개발 단계에서는 합성 tenant의 권한 package를 seed할 수 있지만 모든 사용자에게 데이터를 공개하거나 PEP를 우회하지 않는다. 운영자가 화면에서 assignment를 구성할 수 있도록 bootstrap owner와 break-glass만 별도 통제한다.

## 3. Runtime 계약

### Access package

`DRAFT → PENDING_APPROVAL → APPROVED → ACTIVE → SUSPENDED / EXPIRED / REVOKED`

활성화는 app grant, exact atomic roles, owner-service policy refs가 같은 revision으로 적용돼야 완료된다. 하나라도 실패하면 assignment는 `PENDING_PROJECTION`/`DEGRADED`이며 leaf 권한을 허용하지 않는다. principal/group/scope/기간이 겹치는 effective permission으로 SoD를 검사한다.

### Configuration

`DRAFT → VALIDATED → SIMULATED → PENDING_APPROVAL → APPROVED → SCHEDULED → PUBLISHED → RETIRED`, 실패 시 `REJECTED`; 게시된 version은 immutable하다. rollback은 이전 version을 새 publish로 활성화하며 history를 덮어쓰지 않는다.

Configuration lifecycle의 완결 API는 `SYS-API-012..016`과 `SYS-API-041..045`다. version detail, validate, simulate, submit, approve, schedule, publish, rollback, retire가 각각 typed closed command/response를 가지며 create를 제외한 모든 전이는 `If-Match` CAS를 요구한다. 유효기간은 PostgreSQL half-open `[)` exclusion constraint가 최종 직렬화 지점이며 같은 tenant/config-set(글로벌 scope 포함)의 동시 overlap publish 중 정확히 하나만 성공한다.

### Automation

definition version은 signed allowlisted handler key만 가진다. run은 `QUEUED → LEASED → RUNNING → SUCCEEDED / PARTIAL / FAILED / CANCELLED / DEAD_LETTER`. 동일 concurrency key의 중복 run과 동일 idempotency key의 다른 payload를 차단한다. 재시도는 새 attempt를 만들고 원 receipt를 보존한다.

`SYS-API-046..056`은 definition-version과 schedule의 author/validate/submit/approve/activate/suspend 및 run cancel을 완결한다. schedule은 승인된 immutable version과 input-template ref/digest를 고정한다. run/item/attempt/checkpoint가 별도 aggregate evidence를 남기며 `FAILED_ITEMS_ONLY`는 실패 item 집합 digest를 봉인한다. worker resume은 monotonic checkpoint와 lease-fence token 이후에서만 가능하고 외부 side effect 이후 cancel은 명시적 compensation receipt로 끝난다.

### Connector

definition/mapping은 `DRAFT → VALIDATED → TESTED → APPROVED → ACTIVE → SUSPENDED/RETIRED`. execution은 `ACCEPTED → TRANSFORMING → DISPATCHED → ACKNOWLEDGED → RECONCILED` 또는 `PARTIAL/FAILED/DEAD_LETTER`. secret 평문과 provider payload 원문은 감사/event에 남기지 않는다.

`SYS-API-057..068`은 connector definition과 mapping의 validate/submit/approve/activate, execution의 reconcile/failed-items-only retry/cancel을 제공한다. author와 approver/executor는 분리되고 모든 전이는 CAS다. `RESULT_UNKNOWN`은 원 provider idempotency key와 receipt digest를 사용해 조정하며 재전송으로 성공을 추측하지 않는다.

### Extension/country pack

`DISCOVERED → VERIFIED → APPROVED → INSTALLED_DISABLED → ENABLED → SUSPENDED/REVOKED`. signature, compatibility, hook allowlist, schema, license, permissions가 하나라도 불일치하면 fail closed다.

`SYS-API-028..030`과 `SYS-API-069..075`은 catalog, verify, pack approve/revoke, tenant install request/approve/install/enable/suspend/revoke를 분리한다. 설치는 반드시 `INSTALLED_DISABLED`에서 멈춘 뒤 별도 enable command를 받아야 한다. manifest는 closed schema이며 manifest/signature/compatibility/hook/schema/license/permission digest와 verification evidence를 모두 보존한다. pack revoke는 모든 tenant installation을 비실행 상태로 수렴시킨다.

### Home preference reuse

신규 HRIS preference 저장소를 만들지 않는다. 기존 Platform의 `usr_home_preferences`와 `GET|PUT /api/platform/v1/home-preferences/surfaces/{surfaceKey}`를 재사용하고, product authorization의 fixed constraint `surfaceKey=hcm-home`을 유지한다. 외부 명칭은 HRIS로 바뀌어도 저장 key는 호환 migration을 마치기 전까지 `hcm-home`이 canonical이고 `hris-home`은 legacy alias다. `SYS-API-032`는 pinned baseline의 `platform_updateSurface` 계약을 그대로 재사용하는 유일한 `BASELINE_BODY_VERSION_CAS` named exception이다. 이 low-risk idempotent `PUT`은 별도 `Idempotency-Key`, `If-Match`, 비동기 receipt를 신설하지 않고 request body의 필수 `version`으로 CAS한 뒤 동기 응답한다. 동일 surface와 version을 다시 보내는 동작 및 stale version 충돌은 baseline contract test로 고정한다.

### HRIS Home browser projection

Home은 메뉴 catalog가 아니라 HRM/TIM/PAY/PER 핵심 요약과 SYS 할 일을 합성한 typed widget surface다. owner contribution의 `ownerPopulationScope`와 브라우저용 `browserAudience`는 다른 축이며 같은 필드로 대체하지 않는다. Platform은 persona별 outer PEP와 owner가 봉인한 population·field decision의 교집합만 반환하고, 모든 data field를 `VIEW/MASK/OMIT`로 다시 판정한다. 각 widget은 audience, scope revision, authorization/field-policy revision, freshness, allowlisted deep link와 typed partial error를 함께 가진다. digest-only payload reference, 자유형 JSON, 원천 DTO 또는 민감 원문은 브라우저 응답에 넣지 않는다.

### HRIS Explorer persistence

`/hr/explore`의 검색·즐겨찾기·최근·진행중 업무는 SYS-owned server projection이다. workbench는 `MY_HR|TEAM|HR_OPERATIONS|TIME|PAYROLL|PERFORMANCE|SETTINGS` 일곱 값만 허용한다. 즐겨찾기는 사용자당 최대 20 favorites와 명시 순서를 저장하고, 최근 항목은 server time으로 기록해 30-day TTL을 적용한다. 모든 읽기와 쓰기에서 verified tenant와 authenticated principal을 서버가 바인딩하고 entitlement re-filter를 다시 수행하며 retired/denied route는 같은 트랜잭션에서 제거한다. 진행중 업무는 authorized receipt/case projection의 allowlisted metadata와 deep link만 사용하며 민감 source payload를 별도로 저장하지 않는다.

### Controlled transfer와 operations projection

파일 byte는 Object store, malware 판정은 Scan provider, secret은 Secret manager가 소유한다. Platform은 tenant-bound opaque object ref·digest·분류·목적·만료·상태·receipt만 저장하며 결과 미확정 상태를 재조회로 조정한다. 운영예외는 owner event를 소비하는 read-only projection이다. 중앙 화면은 allowlisted owner route로 deep link만 제공하고 HRM/PER/TIM/PAY의 복구 command를 대행하지 않는다.

### Durable command receipt 조회

Auth와 Platform은 각각 자기 command receipt의 owner이며 `SYS-API-037`과 `SYS-API-038`로만 조회한다. receipt를 만들 때 `originating_action`, `subject_principal_public_id`, `population_scope_digest`, `field_policy_revision`, `purpose_code`, `authorization_revision`을 immutable하게 봉인한다. 조회 시 현재 HRIS 앱 entitlement와 봉인된 원 command의 action·subject·population·field·purpose를 모두 다시 평가하고, 원 정책과 현재 정책 중 더 제한적인 결과를 적용한다. 권한 회수 후 과거 receipt를 읽을 수 없으며 caller가 새로운 scope나 purpose를 넣어 접근을 넓힐 수 없다. tenant 또는 population 불일치는 opaque `404`다.

## 4. API·event·데이터

API·event·golden 정본은 `g2-contract-catalog.csv`, `g2-golden-scenarios.csv`다. 물리 모델 검토 카탈로그는 `g2-physical-schema.sql`이지만 이 합본은 실행하지 않는다. 실제 기본 SYS migration 설계 원본은 서비스별로 독립 실행 가능한 `g2-auth-physical-schema.sql`과 `g2-platform-physical-schema.sql`이며, 그 번호의 현재 권위는 `g0/migration-allocation-register.csv`의 `MIG-SYS-AUTH-217-245`와 `MIG-SYS-PLATFORM-262-290`다. Integration Control은 각각 Auth V217–V245와 Platform V262–V290 범위에서만 해당 스트림의 최종 Flyway 파일을 배정한다. 두 파일은 자기 테이블·index·constraint·RLS policy·`dwp.tenant_id` 경계를 스스로 완결하고 상대 서비스 테이블/FK/include를 포함하지 않는다. `validate_sys_service_local_migrations.py`의 normal, `--self-test`, `--docker-postgres` 검증을 통과하지 않은 migration은 병합하지 않는다.

Employee Listening은 기존 Platform V287 단일 migration을 실행 권위로 사용하지 않는다. 현재 G3 시작 업무 계약 정본은 operation causal·semantic binding·public identity·exact schema·event payload의 canonical 5개이며, `coding-readiness/sys-listening-stream-authority-successor.v1.json`은 그 정본을 검증해 생성되는 derived summary다. 두 계층은 다음 네 개의 create-only 보충 stream을 정확히 분리한다.

| Stream | 정확 migration allocation | Schema / history | Runtime 경계 |
|---|---|---|---|
| Configuration | `MIG-SYS-PLATFORM-HRIS-CONFIGURATION-1-40` | `hris_configuration` / `flyway_hris_configuration_history` | configuration command/query |
| Protected admission | `MIG-SYS-PLATFORM-HRIS-LISTENING-PROTECTED-1-40` | `hris_listening_protected` / `flyway_hris_listening_protected_history` | response admission command/query; raw response owner |
| Insights | `MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40` | `hris_insights` / `flyway_hris_insights_history` | query read-only를 projection writer와 분리 |
| Participation issuer | `MIG-SYS-AUTH-HRIS-PARTICIPATION-ISSUER-1-40` | `hris_participation_issuer` / `flyway_hris_participation_issuer_history` | eligibility/token issuance; response 접근 금지 |

각 stream은 별도 migration location·schema·history table·migration principal·runtime principal을 사용한다. cross-schema FK, foreign local ID/repository import, shared runtime principal/history, primary datasource fallback과 application startup DDL은 금지한다. `deploy/hris/database-streams/{platform-hris-configuration,platform-hris-listening-protected,platform-hris-insights,auth-hris-participation-issuer}`의 native bootstrap·runtime-only startup seal은 Integration Control 소유이며 아직 `NOT_STARTED_G3`다. 서로 다른 database의 commit을 하나의 원자적 transaction으로 주장하지 않고 signed owner port·outbox/inbox·fence·result-unknown refetch로 수렴한다.

모든 신규·고위험 command는 tenant-bound이며 `Idempotency-Key`, payload hash, CAS, audit/outbox/receipt를 적용한다. 기존 Platform baseline을 exact reuse하는 `SYS-API-032`만 body `version` CAS와 동기 응답을 사용하며, 이 예외를 다른 command로 확장하지 않는다. Auth와 Platform은 public ID/revision receipt와 versioned event로만 수렴하며 service 간 DB FK·repository·cross-database query는 금지한다.

`DEP-004`, `DEP-005`, `DEP-006`, `DEP-014`, `DEP-015`, `DEP-016`의 14개 schema는 `coding-readiness/platform-dependency-canonical-schemas.v1.json`이 유일한 wire 정본이다. `platform-dependency-schema-binding-register.csv`가 producer/consumer 양쪽 generated Java import와 contract test를 exact하게 배정하며 어느 서비스도 local DTO를 재정의하지 않는다. `validate_platform_dependency_schema_contracts.py` normal/self-test가 schema hash, closed required set, reference closure, provider/consumer import 동일성 및 64개 consumer test 배정을 검증한다.

## 5. UX 구현 범위

SYS G3 semantic scaffold는 다음을 포함한다.

- `/hr/home`: persona/scope widget composition, personalization, freshness, partial/degraded
- `/hr/explore`: 설치/권한/scope에 맞는 검색·분류·즐겨찾기; 메뉴 catalog를 홈에서 제외
- HRIS 설정 shell: domain contribution, draft/compare/validate/simulate/approval/publish history
- DWP 권한그룹: template, member/SCIM, duties, menu preview, scope/field, validity/review, SoD simulation, audit
- Automation: definitions, schedules, run/attempt/item receipt, retry/DLQ/cancel
- Integration: connector/mapping/secret ref, test/dry-run, execution/reconciliation/retry
- Controlled transfer: malware/digest/expiry 상태, quarantine, delivery receipt와 감사
- Operations center: 모듈별 exception 통합조회, correlation/evidence, owner deep link; 범용 resolve 버튼 금지
- Extension: catalog, signature/compatibility, tenant install/enable/suspend

loading/empty/403/409/stale/partial/result-unknown과 1440/390 semantic 상태를 모두 구현한다. 최종 미감은 G5에서 교체한다.

## 6. 코드 경계

- Auth backend: `dwp-auth-server/src/main/java/com/dwp/services/auth/productaccess/**`
- Platform backend: `dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/**`; 기존 automation/integration framework는 owner 승인 후 확장
- 기본 Auth migration source: `g2-auth-physical-schema.sql` → `dwp-auth-server/src/main/resources/db/migration/V{217..245}__hris_auth_<slice>.sql` (`MIG-SYS-AUTH-217-245`); 기본 Platform migration source: `g2-platform-physical-schema.sql` → `dwp-platform-server/src/main/resources/db/migration/V{262..290}__hris_platform_<slice>.sql` (`MIG-SYS-PLATFORM-262-290`). 합본 `g2-physical-schema.sql`을 어느 서비스에도 복사하거나 실행하지 않음
- Listening migration source: `dwp-platform-server/src/main/resources/db/{hris-configuration,hris-listening-protected,hris-insights}/migration/V{1..40}__hris_listening_<slice>.sql` 및 `dwp-auth-server/src/main/resources/db/hris-participation-issuer/migration/V{1..40}__hris_listening_<slice>.sql`. 각각 `MIG-SYS-PLATFORM-HRIS-CONFIGURATION-1-40`, `MIG-SYS-PLATFORM-HRIS-LISTENING-PROTECTED-1-40`, `MIG-SYS-PLATFORM-HRIS-INSIGHTS-1-40`, `MIG-SYS-AUTH-HRIS-PARTICIPATION-ISSUER-1-40`만 사용하며 legacy V287, 공유 migration history/runtime principal, datasource fallback을 금지함
- Frontend: `features/hris/{shell,home,explorer,administration,integrations}/**`
- 중앙 route/product authorization/OpenAPI/nx/i18n은 Integration Control single-writer
- Gateway에는 route/composition만 두고 config/SoD/domain rule을 넣지 않음

## 7. 수용 기준

- app entitlement 없는 사용자는 어떤 HRIS surface/API도 열지 못한다.
- app entitlement만으로 타인/급여/설정 데이터를 읽을 수 없다.
- 여러 group/direct/delegation을 합쳐도 static/dynamic SoD를 우회하지 못한다.
- 권한 회수/scope revision 변경이 browser cache와 대기 job을 무효화한다.
- 설정 게시자는 자기 authored version을 게시하지 못하고 before/after impact를 확인한다.
- 임의 class/method/SQL batch가 등록되지 않는다.
- connector secret은 reference로만 저장되고 dry-run과 reconciliation receipt가 있다.
- Home에서 모듈 하나가 실패해도 나머지가 보이며 stale/degraded가 명확하다.
- 업무 탐색은 base 76 + modern 22 = 98개 IA 정본을 권한별로 projection하고 홈에는 메뉴 지도를 노출하지 않는다. `hris-shell-navigation-register.csv`의 고정 홈·7개 workbench·비사이드바 `/hr/explore` 및 98-node 단일 귀속을 그대로 구현한다.
- 합성 golden 전부와 tenant/SoD/replay/signature negative가 통과한다.
- 기본 두 service-local migration의 catalog exact coverage, owner prefix, local-only FK, tenant RLS와 Listening 네 보충 stream의 별도 location/schema/history/principal·cross-boundary 금지·runtime-only seal이 `validate_sys_readiness.v2.py` normal/`--self-test`에서 통과한다. 이 SYS 합성 validator는 동일 mode의 `validate_sys_listening_stream_authority_successor.py`를 독립 subprocess로 실행하고 exact count·hostile self-test·successor/validator digest를 함께 봉인한다. PostgreSQL 실행 환경에서는 기본 두 스트림에 `validate_sys_service_local_migrations.py --docker-postgres` 또는 동등 Testcontainers migration test를 적용하고, 네 보충 stream은 각 native datasource/Flyway bootstrap 실행 검증을 추가한다.

실제 법정팩 내용, ERP/은행/세무/보험/타각 연결, 고객 운영 권한배치와 production owner 승인은 G6 activation 범위다.
