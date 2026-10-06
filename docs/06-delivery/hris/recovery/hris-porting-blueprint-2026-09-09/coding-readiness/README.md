# DWP HRIS 전체 코딩 준비 패키지

기준일: 2026-09-11  
상태: `VALIDATOR_CONTROLLED` — 최신 live 리포트의 `effectiveGate`가 정본

이 디렉터리는 SKKF의 화면과 테이블을 그대로 복제하기 위한 명세가 아니다. 5개 source 분석 세션이 회수한 행위를 DWP의 제품·권한·서비스·데이터·운영 규칙으로 재설계하여, 모듈별 기능 코딩을 시작할 수 있는 단일 실행 계약으로 만든다.

## Gate 의미

- `G0 BASELINE`: clean backend/frontend 기준선, worktree, 소유권, source governance가 검증됨
- `G1 CHARACTERIZED`: source parent·child 추적과 `REUSE / REBUILD / CONFIGURE / EXTENSION / RETIRE` 판단이 `UNKNOWN=0`으로 닫힘
- `G2 CODE READY`: 서비스 경계, 물리 스키마 blueprint, API/event/state/권한, 합성 golden과 비기능 기준이 승인됨
- `G3 IMPLEMENT`: 기능 코딩과 semantic UI scaffold를 수행할 수 있음
- `G4 FUNCTIONALLY ACCEPTED`: 기능·권한·상태·회귀·운영 수용기준을 통과함
- `G5A/B/C DESIGN`: 전체 화면 Design AI 요청서, 디자인 승인, 시각 교체 및 회귀
- `G6 ACTIVATION`: 실제 국가팩·외부 연계·고객 데이터·부하·운영 승인 후 tenant별 production 활성화

`G2 CODE READY`는 범용 core 코딩 허가이며 production 출시 승인이 아니다. 실제 세율·법정 서식·은행·ERP·타각·고객사 데이터와 실명 책임자 승인은 `G6`에서 닫는다. 코어에는 미확정 값을 하드코딩하지 않고 versioned configuration, country pack, connector, tenant extension 경계로 둔다.

같은 원칙으로 fresh/disposable Approval DB의 clean migration과 `NOINHERIT`·strict ACL 검증은 G3를 차단하지 않는다. 다만 V24-era 역할의 `INHERIT=true` 잔존 가능성이 있는 기존 Approval 운영 DB는 `ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING`의 일회성 역할/ACL 복구 receipt와 실명 DBA·Security·SRE release 승인 없이는 해당 production activation을 열 수 없다.

## 정본 목록

1. [전체 아키텍처](./01-full-coding-architecture.md)
2. [프론트엔드 모듈 구조](./02-frontend-module-architecture.md)
3. [백엔드 서비스 구조](./03-backend-service-architecture.md)
4. [데이터·API·이벤트 계약](./04-data-api-event-contract.md)
5. [보안·개인정보·컴플라이언스](./05-security-privacy-compliance.md)
6. [품질·운영·마이그레이션·릴리스](./06-quality-operations-release.md)
7. [Architecture Decision Register](./architecture-decision-register.csv)
8. [모듈 의존성 Register](./module-dependency-register.csv)
9. [비기능 요구 Register](./nonfunctional-requirements-register.csv)
10. [코드 Gate Register](./module-code-gate-register.csv)
11. [Production Activation Register](./activation-gate-register.csv)
12. [Cross-cutting Ownership Register](./cross-cutting-ownership-register.csv)
13. [외부 입력 분류 Register](./external-input-classification-register.csv)
14. [모듈 간 계약 Register](./cross-module-contract-register.csv)
15. [모듈 간 Canonical Typed Schema](./cross-module-canonical-schemas.v1.json)
15a. [Canonical Decimal Value-Type SSOT](./decimal-value-types.v1.json)
15b. [Decimal/Money 실행 검증기](./validate_decimal_value_contract.py)
15c. [Command receipt 보안 검증기](./validate_command_receipt_contracts.py)
15d. [Country-pack Product Core/G6 경계 등록부](./country-pack-boundary-register.csv)
15e. [Country-pack 경계 검증기](./validate_country_pack_boundaries.py)
16. [모듈 간 Schema Binding Register](./cross-module-schema-binding-register.csv)
17. [모듈 간 Schema Validator](./validate_cross_module_schema_contracts.py)
18. [물리 Schema/Prefix/Runtime Owner Register](./physical-owner-prefix-register.csv)
19. [물리 Owner/Prefix Validator](./validate_physical_owner_prefixes.py)
20. [최신 HRIS 기능 Delivery Register](./modern-capability-delivery-register.csv)
21. [최신 HRIS 기능 Trace Register](./modern-capability-trace-register.csv)
22. [최신 HRIS 기능 Exact Coding Contract](./modern-capability-coding-contract-register.csv)
23. [최신 HRIS Exact Schema Contract](./modern-capability-exact-schema-contracts.v1.json)
24. [최신 HRIS Event Payload Contract](./modern-capability-event-payload-contracts.v1.json)
25. [최신 HRIS 메뉴 노드 Register](./modern-menu-node-register.csv)
26. [최신 HRIS 권한 Binding Register](./modern-capability-authorization-register.csv)
27. [최신 HRIS 기능 실행 계약](./07-modern-capability-coding-contract.md)
28. [모듈 구조 계약 Register](./module-structure-contract-register.csv)
29. [G3 파일 할당 Register](./g3-file-allocation-register.csv)
30. [DWP 공통 플랫폼 Binding Register](./platform-integration-binding-register.csv)
31. [API PEP Binding Register](./api-pep-binding-register.csv)
32. [Internal Service API Authorization Register](./service-api-auth-binding-register.csv)
33. [Home Materialization Security Register](./home-materialization-security-register.csv)
34. [Shared Baseline Contract Catalog](./shared-contract-catalog.csv)
35. [Source Target-family Resolution Register](./target-family-resolution-register.csv)
36. [Public API Transport Schema Resolution Register](./transport-schema-resolution-register.csv)
37. [Transport Schema 실행 계약](./08-transport-schema-contract.md)
38. [API PEP Binding Validator](./validate_api_pep_bindings.py)
39. [최신 HRIS 기능 Contract Validator](./validate_modern_capability_contracts.py)
40. [최신 HRIS 기능 Authorization Validator](./validate_modern_capability_authorization.py)
41. [Source Target-family Resolution Validator](./validate_target_family_resolution.py)
42. [Transport Schema Resolution Validator](./validate_transport_schema_resolution.py)
43. [Source Provenance Validator](./validate_source_provenance.py)
44. [98-node 통합 IA Register](./hris-information-architecture-register.csv)
44a. [HRIS Shell Navigation Register](./hris-shell-navigation-register.csv) — 고정 widget 홈 + 순서가 고정된 7개 workbench + 비사이드바 `/hr/explore`, 98-node 단일 귀속
44b. [HRIS Workbench Task Group Register](./hris-workbench-task-group-register.csv) — 홈을 제외한 97개 화면을 46개 업무지향 그룹에 전량·단일 배정
44c. [IA Node Access Contract SSOT](./ia-node-access-contract-register.csv) — 98개 노드별 initial query, visibility capability, action, canonical persona와 package/duty 도달성을 TFR 전체 합집합과 분리
44d. [IA Entry Query Projection Register](./ia-entry-query-projection-register.csv) / [closed response schemas](./ia-entry-query-projection-schemas.v1.json) / [shared authorization exceptions](./ia-shared-authorization-exception-register.csv) — 66개 신규 initial-read projection과 기존 GET/shared query를 node별로 고정하고 trusted tenant context, query state, field decision, partial failure, cursor/cache invalidation을 봉인
45. [BENSK 경로 전환 결정 Register](./route-transition-register.csv)
45a. [HRIS API Source-of-Record 전환 Register](./hris-api-sor-transition-register.csv) — 기존 People HR 23개 operation을 HRM 유지·TIM/PAY/PER cutover·SYS composition으로 전량 분류하고 aggregate 재조합, 단일 feature-flag 선택, dual-read/write·silent fallback 금지와 retirement trigger를 고정
45b. [HRIS API Source-of-Record 전환 Validator](./validate_hris_api_sor_transitions.py) — frontend source에서 getter 14개 variant와 mutation 9개를 독립 추출하고 contract/slice/IA owner 및 Control transition allocation의 exact closure를 검증
46. [통합 IA 실행 계약](./09-information-architecture-contract.md)
47. [통합 IA Generator](./generate_information_architecture_register.py)
48. [통합 IA Validator](./validate_information_architecture.py)
48a. [IA Entry Query Schema Generator](./generate_ia_entry_query_projection_schemas.py)
48b. [IA Node Access Independent Validator](./validate_ia_node_access_contracts.py) — generator 상수를 재사용하지 않고 98-node query/action 및 5 persona → 31 package → 128 duty → capability/SoD 경로와 schema contamination/closure를 검증
49. `../readiness-tools/validate_trace_semantics.py` — 10,001 child trace 의미 검증과 deterministic risk sample 검증
50. [전체 코딩 준비 Validator](./validate_full_coding_readiness.py)
51. [최신 검증 리포트](./reports/full-coding-readiness-latest.md)
52. `../session-evidence/sys/g2-auth-physical-schema.sql` — Auth 전용 독립 migration 정본
53. `../session-evidence/sys/g2-platform-physical-schema.sql` — Platform 전용 독립 migration 정본
54. `../session-evidence/sys/validate_sys_service_local_migrations.py` — 합본 exact closure, owner/prefix, local-only FK, RLS 및 선택적 PostgreSQL 실행 검증
55. [Base Schema PostgreSQL 16 Validator](./validate_base_schema_postgres_feasibility.py) — People V1~V50 공통 기반 → HRM → PER 순차 실행과 TIM/PAY 독립 빈 DB 실행, 물리 table/constraint/index/trigger/RLS/policy exact closure 및 고의 변조 차단 검증
56. [G3 Named Slice Code-Go Register](./g3-slice-code-go-register.csv) — base target family 86 + modern capability 16, 총 102개 추적 slice 중 100개 code-enabled 행의 IA/API·event/auth/schema/state/file/migration/test 귀속과 고유 `G3-CODE-GO-*` 토큰; HRM-006/SYS-013은 retired evidence-only
56a. [G3 Contract Primary Ownership SSOT](./g3-contract-primary-ownership-register.csv) — public PEP 175, internal service PEP 11, XCON producer 21, SYS G2 contract 84, base event 49, modern operation 100, modern event 32의 472행 exact primary owner·slice·source semantic seal
56b. [Generated Contract Runtime Invariant SSOT](./generated-contract-runtime-invariant-register.csv) — generated DTO/compile 완료와 실제 domain runtime 불변식 완료를 분리하고, canonical schema의 89개 `DOMAIN_RUNTIME` member(기존 81개 + PDX-012~014 8개)를 producer·consumer named slice와 exact acceptance policy에 귀속. `../g0/validate_generated_contract_runtime_invariants.py`가 generator 상수를 import하지 않고 source manifest·slice 역할·digest를 검증한다.
57. [G3 Named Slice 실행 계약](./10-g3-slice-code-go-contract.md)
58. [G3 Named Slice Generator](./generate_g3_slice_code_go_register.py)
59. [G3 Named Slice/Touch Manifest Validator](./validate_g3_slice_code_go.py)
59a. `../g0/session-environment-command-catalog.v1.json`, `../g0/session-environment-evidence.json`, `../g0/capture_session_environment_evidence.py`, `../g0/prepare_g3_checkpoint.py`, `../g0/host_semaphore.py` — 12개 target 및 18개 support worktree, module command receipt, frontend dependency materialization과 공통 host lock을 기계 봉인하는 실행환경 정본
59b. `../g0/central-artifact-classification-register.csv`, `../g0/g3-control-release-register.csv`, `../g0/g3-control-sync-receipt-register.csv`, `../g0/g3-control-delivery-state.json`, `../g0/append_g3_control_delivery.py`, `../g0/validate_central_artifact_delivery.py` — 중앙 artifact class, Git blob manifest, 허용 consumer receipt 전체 closure와 Control-only CAS append를 봉인하는 배포 정본
59c. `../g0/validate_typed_contract_test_allocations.py` — XCON/PDX provider·consumer contract-test 130개가 의도한 session의 active backend allocation에 exact-one으로 귀속되는지 검증
59d. `frontend-shared-presentation-binding-register.csv`, `validate_frontend_shared_presentation_boundary.py` — 계층화된 `shared/components/hris-domain-components.tsx`를 Control/SYS shell presentation single-writer로 고정하고 TIM의 세 source가 `shared/index.ts` public barrel만 사용하도록 read-only consumer edge를 허용한다. 모듈 allocation overlap·clone·consumer-test 누락을 거부한다.
60. [G5A Design-AI Package Ownership/Path Register](./g5a-design-ai-package-allocation-register.csv) — HRM 24, PER 19, PAY 17, TIM 17, SYS 21개 IA owner 화면과 모듈별 output/ZIP/checksum/detached-verification 경로
61. [G5A Design-AI Package Validator](./validate_g5a_design_ai_packages.py) — 현재 `PLANNED_NOT_DUE_AFTER_G4` 계약과 G4 이후 실제 package/manifest/hash/PII·secret/coverage/ZIP 검증을 분리. G4 frontend surface inventory를 `(ia_node_id,surface_key)`로 양방향 대조하고 세션별 G3 FE allocation·실제 G4 commit blob을 고정하며, `g5a_image_ocr.swift`의 fresh Apple Vision OCR을 재실행한다.
62. [G5A Apple Vision OCR Runtime](./g5a_image_ocr.swift) — PNG 입력마다 Apple Vision accurate OCR을 새로 실행해 tool/version과 추출 결과를 반환하며, validator가 runtime-script/input/evidence digest와 PII·secret findings를 독립 봉인한다.
63. [모듈 Exact-business P0 Canonical Successor](./module-exact-business-start-canonical.v1.json) / [Closed Schemas](./module-exact-business-schemas.v1.json) / [Lineage](./module-exact-business-lineage-register.v1.csv) / [Fixtures](./module-exact-business-fixtures.v1.json) — HRM·PER·PAY·TIM의 BASE-P0-004~011을 30개 aggregate 상태기계, 34개 schema, 16개 lineage로 닫은 versioned 설계 정본. 기존 proposal은 SHA-pinned 역사 근거일 뿐 wholesale 승격하지 않는다.
63a. [Exact-business Primary Validator](./validate_module_exact_business_start.cjs) / [Independent Re-audit](./audit_module_exact_business_start.py) / [Immutable Re-audit Pin](./module-exact-business-start-pin.v1.json) — 서로 다른 Node/Ajv와 Python stdlib 구현이 9개 pinned artifact, 74개 fixture, 30개 상태기계, 16개 lineage와 각 12개 mutation을 독립 검증한다. 이 PASS는 모듈 exact-design P0만 뜻하며 G3/G4/READY/Gate를 열지 않는다.
63b. [Exact-business 독립 재감사 보고서](./reports/module-exact-business-p0-successor-independent-pass-2026-09-14.md) — 해결된 BASE-P0-004~011과 계속 열린 BASE-P0-001~003/START-P0-001~008, 실제 API-SoR 회귀 실패 및 최종 `FAIL_CLOSED_NO_G3_START`를 함께 기록한다.

모듈별 상세 G1/G2 근거는 `../session-evidence/{hrm,per,tim,pay,sys}`에 있고, source 정본은 `../session-registers/hris-*-source-coverage.csv`다. 메뉴·권한 정본은 `../uiux-and-menu-blueprint.md`, `../authorization-blueprint.md`, `../hris-*-matrix.csv`다.

## 변경 통제

- 중앙 single-writer: backend `settings.gradle`, `contracts/**`, generated HRIS contracts, `dwp-gateway/**`; frontend `routes/**`, HCM/HRIS manifest·navigation, `architecture/**`, `libs/api-contracts/**`, 공통 i18n, `features/hris/shared` presentation primitive, `nx.json`
- 모듈 writer: 자기 bounded-context package, migration, test, feature directory와 자기 G1/G2 evidence
- 계약 변경은 additive 우선이며 producer와 consumer contract test가 함께 통과해야 한다.
- 서비스 간 DB 접근·FK·repository import, UI의 권한 추론, 고객사 식별자 분기, 값 하드코딩, 임의 batch class/method 실행은 금지한다.
- Gate 변경은 `validate_full_coding_readiness.py`의 static/live 검증 결과와 Integration Control decision을 함께 요구한다.

## 최종 판정 조건

다음이 모두 참일 때만 5개 모듈을 `OPEN_G3_CODE`로 바꾼다.

- 2,269 source parent가 정확히 한 모듈에 속하고 모든 in-scope 행이 결정됨
- 모듈별 G1 3종과 G2 계약 세트가 존재하며 orphan·중복·미확정 참조가 없음
- 공통/모듈 API, event, state, authorization, schema, golden, NFR 계약이 기계 검증됨
- 10,001 child trace가 의미 가짜 placeholder 없이 query/command/state/validation 의미로 정규화되고 58개 deterministic risk sample이 PASS
- 10,001 child가 `parent_artifact_id`를 통해 2,269 parent와 86개 target family의 정확한 API/event/internal/shared 계약으로 전이 폐쇄됨
- 5개 모듈의 backend/frontend layer, import 금지, source/test/scaffold와 중앙 build/settings/Docker/devctl/CI/deploy single-writer 할당이 일치함
- DWP 공통 Event/Approval/Notification/Audit/Config/API routing/PEP의 정확한 adapter·schema·test 경계가 연결됨
- 21개 모듈 간 snapshot/event가 Draft 2020-12 타입·format·nullability·nested cardinality·정규화 digest, 동일 generated import와 producer/consumer contract test까지 양끝에서 일치함
- DEP-019는 `ApprovedCompensationPlanSnapshot.v1` + post-snapshot-commit `ApprovedCompensationPlanSnapshotPublished.v2`만 사용한다. 16개 modern capability trace는 lineage successor v2 86건을 정확히 반영하고 `CompensationPlanApproved.v1`은 G2/lineage 역사 정본으로만 남으며 active producer·consumer·trigger·primary owner·slice 및 dual publish가 금지됨
- 모든 금액·비율·수량 wire가 arbitrary-precision non-exponent decimal string 정본을 따르고 application pre-bind rounding, signed-zero canonicalization, currency/unit pairing 및 실행 가능한 `PAY-GOLD-014`가 통과함. `ClosedTimeResult.v1`·`ApprovedCompensationPlanSnapshot.v1`은 gateway 무버퍼링, bounded backpressure, 압축/비압축 byte·line·ratio 한도, 연속 순서, incremental digest, atomic finalize와 전량 rollback/quarantine까지 검증됨
- base 163개와 producer-owned modern 56개로 구성된 authoritative 219개, PAY consumer materialization 2개를 합친 배포 물리 객체 221개가 승인된 schema prefix와 실제 owner runtime에 정확히 한 번 귀속되고 다른 service의 DB/FK/repository 접근이 차단됨
- SYS 합본 물리 catalog는 실행되지 않고 Auth/Platform service-local migration 정본으로 정확히 분할되며, 각각의 빈 PostgreSQL 데이터베이스에서 상대 서비스 의존 없이 생성 가능함
- People 실제 V1~V50 migration(47~50은 공통 기반)을 같은 psql session에서 migration별 transaction으로 재생한 뒤 HRM 24개와 PER 34개 물리 테이블을 같은 `dwp-people-server` DB의 `public`/`hris_performance` 경계에 순서대로 생성하고, TIM 31개와 PAY 42개는 각각 독립 빈 DB에서 생성하며, PostgreSQL 16 catalog의 PK/UK/FK/CHECK/EXCLUDE/index/trigger 및 전 모듈 table의 FORCE RLS·tenant policy가 exact contract와 일치함
- source contract에서 산출한 공개 API 전 건의 PEP tuple과 실제 분리 서비스의 internal API 전 건의 workload identity, mTLS, tenant/purpose, field projection, audit, replay/idempotency 계약이 정확히 일치함
- 공개 API 전 건의 path/query/body/response/error DTO 필드·타입·required·validation과 baseline/local schema pointer가 해소되어 구현자가 wire contract를 재결정할 필요가 없음
- 모든 `202` command가 owner별 권한 있는 receipt `GET`으로 수렴하고, 조회가 원 command의 봉인된 action·subject·population·field·purpose와 현재 권한의 교집합만 반환함
- 기존 76개와 최신 22개를 합친 98개 IA node가 서로 다른 canonical route, workbench tab, owner, exact API/auth reference와 deep link로 닫히고 BENSK 두 경로와 충돌하지 않음. 별도 shell 정본이 고정 widget-only 홈, `내 HR·팀·인사 운영·근태·급여·성과·설정` 7개 workbench, 비사이드바 `/hr/explore`를 순서·default·권한 fallback과 함께 봉인하며 98개 node를 정확히 한 entry에 귀속함. 홈을 제외한 97개 node는 46개 업무지향 task group에 정확히 한 번 귀속됨
- base target family 86개와 modern capability 16개, 총 102개 추적 slice 중 active 100개만 IA/API·event/auth/schema·state/dependency/file/migration/test evidence와 고유 `G3-CODE-GO-*` 토큰으로 닫히며, retired 2개는 source retirement/target absence만 증명하고 실제 변경은 touch manifest로 세션과 허용 경로에 귀속됨
- G5A의 5개 모듈별 output/ZIP/checksum/detached-verification writer와 98-node IA owner 수량이 계획 계약으로 닫히고 validator mutation 9종(missing/hash/text PII/secret/unmapped/wrong-module/foreign·nonexistent G4 target/rendered-image OCR PII/ZIP)이 fail-closed임. 현재 G3에서는 실제 package 검증이 `NOT_RUN_NOT_DUE`이며 `PLANNED_NOT_DUE_AFTER_G4`일 뿐, `DESIGN_REQUEST_READY`나 디자인 완료를 주장하지 않음
- backend/frontend clean baseline 명령과 source security 검증이 통과함
- worktree가 동일한 승인 기준선에서 clean 상태임
- 실제 외부값이 필요한 항목은 core blocker로 오인되지 않고 명시적 `G6` activation gate로 격리됨
- BENSK·ADDSK 식별 분기와 SKKF code/config/SQL/formula/asset 복사가 target 코드에 없음

`10,001 child traces`는 2,269개 source parent의 controller method, service/job,
interface, formula, SQL, state transition 등 source→target 추적 링크 수다. 이는 서로
다른 10,001개 제품 기능이나 구현 완료 건수를 뜻하지 않는다.

각 child의 `target_api_event_candidate`는 source 행위의 역사적 characterization이며
구현 정본이 아니다. canonical 구현 연결은
`child.parent_artifact_id → source parent target family → target-family-resolution-register.csv의 resolution_refs`
한 경로뿐이다. 구 `/api/approval/v1`, `/api/notification/v1` 같은 candidate 문자열은
이 경로를 우회해 API를 만드는 근거로 사용할 수 없다.

`modern-capability-delivery-register.csv`와 `modern-capability-trace-register.csv`의
최신 HRIS capability 16건도 전체 제품 개발 범위에 포함한다. SKKF parity 완료율과는
분리해 측정하지만, 모듈별 owner, prompt, implementation slice, menu, data/auth/API,
G3B/G3C/G3D implementation wave, test와 acceptance evidence를 모두 닫아야 이후 전체
제품 완료를 선언할 수 있다. 현재 상태는
`PLANNED_REQUIRED_SCOPE / NOT_STARTED_G3`이며, 이번 Gate는 이 기능들의 구현
완료를 주장하지 않는다.

최신 기능의 현재 exact coding contract는 16 capabilities, 100 planned API
operations, 22 menu nodes, 48 atomic authorization bindings, 16 state machines,
81 transitions, 32 events, 56 producer-owned physical tables, 48 acceptance tests다. 기존 core
물리 테이블 163개와 이름 중복 없이 합친 authoritative owner/SoR 계획 총계는 219개다. PAY는
Compensation Planning 소유자가 아니라 PER가 발행한 승인 snapshot의 consumer이며,
PAY 측에는 consumer materialization table 2개만 별도 할당한다. 따라서 실제
배포 물리 객체 총계는 221개이며, 이 2개를 PER의 SoR로 과장하지 않는다. 이 모든 수치는
`NOT_STARTED_G3` 설계 수량이지 구현 완료 수량이 아니다.

100개 operation에는 request field 전부와 command의 NOT NULL/no-default column,
event payload field, response projection을 잇는 field lineage가 있다. local
composite FK 36개는 target candidate key·column 순서·SQL type을 검증하고, text
enum check는 quoted PostgreSQL SQL로 고정한다. 승인 보상 snapshot은 header/line,
analytics·AI 다중 UUID 입력은 canonical `UUID[]`+digest로 무손실 저장한다.
`validate_modern_capability_contracts.py --self-test --postgres-feasibility`는
base schema·lineage·migration 고의 변조 16종을 차단하고, 독립 semantic
lineage suite 63건의 healthy/negative case를 재검증한 뒤 disposable
PostgreSQL 16에서 56개 테이블, 132개 check, 36개 local FK DDL을 실제 컴파일한다.

`validate_command_receipt_contracts.py`는 HRM·PER·TIM·PAY·SYS 5개 모듈의 6개
물리 owner(People HRM/PER, Time, Payroll, Auth, Platform)와 6개 receipt 조회를
한 번에 닫는다. caller/action-bound idempotency, immutable originating
authorization seal, 현재·원 권한의 교집합 조회, opaque 404와 update/delete
차단을 공통 규칙으로 검증한다.
`country-pack-boundary-register.csv`는 G3에서 구현할 범용 Product Core·signed
pack runtime·synthetic conformance harness와 G6 전까지 금지할 실제 KR 법정
규칙·요율·서식·YEA·tenant activation을 분리한다.

### Modern causal 독립 오라클

`modern-causal-independent-oracle.v1.json`과
`modern-causal-independent-pg-fixtures.v1.json`은 후보 generator의 상수·함수나
`modern_causal_successor.py`를 import하지 않는 reviewer 소유 정본이다. 오라클의
`sourcePinsAtReview` 중 exact/event/semantic/identity hash는 기대 결과가 아니라
2026-09-15 remediation 이전 inventory를 조사했다는 역사적 증거다. 후보 산출물이
바뀌어도 이 hash나 sealed oracle digest를 자동 repin하지 않는다. 기대 의미는
오라클 안의 100개 operation별 selector, input effect, ordered DML, transition,
event audience/refetch 및 4개 internal handler 결정만이 가진다.

오라클 builder는 기존 봉인 파일을 기본적으로 덮어쓰지 않는다. 새로운 전문가
판단으로 오라클 자체를 개정할 때만 reviewer가 `--review-update`를 명시하고 새
hash를 기록한다. 후보 검증은 다음처럼 수행하며, `--design-only`는 machine-readable
`reports/modern-causal-independent-design-findings.v1.json`을 남긴다. 이 결과가
0건이어도 PG16·PG18 실트랜잭션 evidence와 두 번째 reviewer 서명이 없으면 전체
Gate는 닫힌 상태다.

```bash
python3 validate_modern_causal_independent_oracle.py --oracle-only --compact
python3 validate_modern_causal_independent_oracle.py --design-only --compact
python3 validate_modern_causal_independent_oracle.py --compact
```

## 실행과 판독

정적 구조 점검은 다음 명령으로 수행한다.

```bash
python3 validate_full_coding_readiness.py --static
node validate_module_exact_business_start.cjs --self-test
python3 -B audit_module_exact_business_start.py --self-test
```

코드 Gate를 실제로 열 수 있는 최종 점검은 반드시 live 모드와 리포트 기록을 함께 수행한다.

```bash
python3 validate_full_coding_readiness.py --check-live --write-report
python3 validate_published_gate_truth.py --compact
python3 validate_published_gate_truth.py --self-test --compact
```

static 결과만으로는 `OPEN_G3_CODE`가 되지 않는다. live 검증에서 source/G1/G2, 5개 모듈 validator, owner/dependency, clean baseline/worktree, 실제 command evidence, migration 구간, authoritative G0 code checkpoint가 모두 통과해야 한다. 이어서 published-truth validator가 LIVE 보고서·entry/G3 checkpoint·현재 선언·모든 봉인 artifact digest를 확인해야 외부에 Gate를 보고할 수 있다. 통과해도 모듈 코드 상태는 `NOT_STARTED_G3`, production 상태는 `NOT_AUTHORIZED_G6`로 남는다.

기반 물리 스키마의 독립 검증은 다음 세 모드로 재현할 수 있다. V7의 `TEMP ... ON COMMIT DROP`을 보존하기 위해 People 기준선은 문장별 autocommit이 아니라 동일 psql session의 migration별 transaction으로 실행된다.

```bash
python3 validate_decimal_value_contract.py --compact
python3 validate_decimal_value_contract.py --self-test --compact
python3 validate_command_receipt_contracts.py
python3 validate_command_receipt_contracts.py --self-test
python3 validate_country_pack_boundaries.py
python3 validate_country_pack_boundaries.py --self-test
python3 validate_modern_capability_contracts.py --self-test --compact
python3 validate_modern_capability_contracts.py --postgres-feasibility --compact
python3 validate_base_schema_postgres_feasibility.py --compact
python3 validate_base_schema_postgres_feasibility.py --self-test --compact
python3 validate_base_schema_postgres_feasibility.py --docker-postgres --compact
```
