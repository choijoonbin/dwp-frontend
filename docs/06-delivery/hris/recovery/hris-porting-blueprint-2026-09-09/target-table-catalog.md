# DWP HRIS 목표 테이블 카탈로그

## 1. 설계 방향

SKKF의 558개 JPA 엔티티와 536개 명시 테이블명을 그대로 DWP에 생성하지 않는다. 같은 인물·조직·공통코드가 서비스별로 반복되고, 기술적 화면 상태와 업무 원장이 혼재해 있기 때문이다. DWP의 기존 `ppl_*`, `int_*`, 감사·아웃박스·접근·반출 모델을 기준으로 의미를 통합하고, 계산량과 보안 경계가 다른 Time과 Payroll을 분리한다.

이 문서는 논리 테이블 카탈로그다. 물리 DDL은 capability별 ADR, 부하 모델, 국가팩 상세를 거쳐 작성한다.

## 2. 공통 컬럼 및 제약 계약

### 모든 tenant 업무 테이블

| 컬럼 | 형식 예 | 규칙 |
|---|---|---|
| `id` | bigint | 내부 PK, 외부 노출 금지 |
| `public_id` | uuid | API/event 식별자, tenant 내/전역 uniqueness 명시 |
| `tenant_id` | uuid/bigint | NOT NULL; 모든 UK/FK에 포함 |
| `version` | bigint | optimistic concurrency |
| `created_at/by` | timestamptz, uuid | actor/service principal 보존 |
| `updated_at/by` | timestamptz, uuid | append-only 테이블은 nullable 또는 미사용 |
| `correlation_id` | uuid | command/job/event 연결 |
| `source_system_id` | uuid/public ID | migration/integration provenance; 같은 물리 store에서만 tenant 복합 FK |
| `source_record_key` | text | 재수집 idempotency key |

### 유효일 테이블

- `valid_from DATE NOT NULL`
- `valid_to DATE NULL`; 반개구간 `[from, to)` 사용
- 같은 business key의 기간 중복을 exclusion constraint 또는 trigger로 차단
- `recorded_at`과 `effective_at`을 혼동하지 않음
- 과거 정정은 원래 기록을 삭제하지 않고 correction/version 관계를 남김

### 원장/실행 테이블

- `status`, `attempt_no`, `rule_snapshot_id`, `input_snapshot_id`
- 확정/게시 이후 update/delete 금지
- 정정은 `reverses_entry_id`, `supersedes_run_id`, `reason_code` 사용
- 금액은 `NUMERIC(19,4)` 등 통화별 정밀도 정책과 `currency_code CHAR(3)` 사용
- 시간은 원본 timezone/offset과 canonical instant를 함께 보존

### 논리 owner와 물리 참조

- 초기 modular-monolith처럼 같은 DB에 있는 aggregate끼리는 `(tenant_id, id)` 복합 FK를 허용한다.
- Time/Payroll/Auth/Integration이 물리 서비스로 분리되면 다른 context를 향한 DB FK와 직접 SQL join을 금지하고 `(tenant_id, public_id)` 참조와 outbox/inbox projection을 사용한다.
- 각 상세 DDL에는 `logical_owner`, `physical_store`, `cross_context_reference`를 명시한다. `source_system_id`도 Integration 서비스가 분리된 뒤에는 검증된 public ID이며 물리 FK가 아니다.

## 3. 기존 DWP 테이블 재사용

아래는 새로 복제하지 않고 현행을 SoR로 확장한다.

| 현행군 | 대표 테이블 | 목표 역할 | 주요 보강 |
|---|---|---|---|
| Person | `ppl_persons`, `ppl_person_names` | 인물과 유효일 이름 | 중복병합, locale name policy |
| Private/Identifier | `ppl_person_private`, `ppl_person_identifiers` | 암호화 개인정보/식별자 | field purpose, key version, masking policy |
| Workforce | `ppl_workers`, `ppl_work_relationships`, `ppl_assignments` | 직원·고용·배치 SoR | 계약조건/발령 event 연결 |
| Enterprise | `ppl_legal_employers`, `ppl_organizations`, `ppl_locations` | 법인·조직·위치 | 사업단위/사업장 등록정보 확장 |
| Jobs | `ppl_job_profiles`, `ppl_job_grades`, `ppl_positions` | 직무·직급·포지션 | 직군/직렬, 보상 grade 연결 |
| Org graph | `ppl_organization_relationships`, scenario 테이블 | 유효일 조직/개편안 | 게시 event, impact snapshot |
| Custom attributes | `ppl_attribute_definitions/values` | 제한적 metadata field | typed schema, sensitive class, index policy |
| Integration | `int_source_systems`, mappings, sync/receipt/reconciliation | 연계 control plane | HR event cursor, quarantine/replay |
| Access/export | workforce access와 export 테이블 | 대상집단/반출 거버넌스 | HRIS field group와 purpose 강화 |
| Audit/outbox | 현행 공통 패턴 | 변경증적/event 전달 | schema registry와 replay state |

### 권한 테이블은 HRIS 도메인 DB에 새로 만들지 않음

SKKF의 메뉴·역할·사용자 권한 테이블은 업무명세와 이관 매핑 자료로만 사용한다. Auth는 DWP의 `com_groups`, `com_group_members`, `com_roles`, `com_group_role_assignments`, `com_resources`, `com_permissions`, `com_role_permissions`, grant와 역할 부여/충돌 정책을 확장한다. People는 현행 workforce access policy와 live 조직/manager population 판정을 확장한다. Time과 Payroll은 자신이 소유한 time group·period·pay group·급여대상과 민감필드를 최종 판정한다. HRIS 업무 DB에 별도 사용자-메뉴 ACL을 만들지 않는다.

추가가 필요한 것은 새 권한 엔진이 아니라, 서로 독립된 앱 grant·atomic role·owner-service 데이터정책을 하나의 승인 단위로 묶는 제품 중립 거버넌스 계층과 계약이다.

| 소유 | 추가/확장 테이블 | 목적 |
|---|---|---|
| Auth | `sys_product_access_package_catalog` | 제품별 package/version/위험도/lifecycle catalog |
| Auth | `sys_product_access_package_roles` | package에 포함된 평면 atomic role/duty 목록 |
| Auth | `sys_product_access_package_conflicts` | package/duty 간 정적 SoD 정책 |
| Auth | `com_product_access_package_assignments` | USER/GROUP 대상 package, 유효기간, 승인·활성·review의 aggregate root |
| Auth | `com_product_access_package_policy_refs` | assignment별 1:N `{policy_owner, policy_ref, policy_revision}`; People/Time/Payroll 정책 동시 결합 |
| Auth | `com_product_access_package_projection_status` | app grant·role·owner policy의 expected/applied revision과 drift |
| People | 기존 `ppl_workforce_access_policies` 확장 | People 접근정책 aggregate header; package assignment의 opaque ID/revision과 목적·effect·우선순위·fingerprint 연결 |
| People | `ppl_access_population_sets` | `SELF/DIRECT_REPORT/ORG/ORG_TREE/LEGAL_ENTITY/NAMED_POPULATION` 정의와 live 관계 revision |
| People | `ppl_field_group_catalog`, `ppl_field_catalog` | 고정 field 배열을 versioned field catalog로 전환하고 `VIEW/MASK/OMIT` projection 정의 |
| People | `ppl_workforce_access_policy_populations` | 기존 policy header의 1:N population-set binding |
| People | `ppl_workforce_access_policy_actions` | 기존 policy header의 exact capability/action binding과 deny 우선 effect |
| People | `ppl_workforce_access_policy_field_groups` | 기존 policy header의 field group별 `VIEW/MASK/OMIT` |
| Time/Payroll | owner별 access policy 또는 read model | `TIME_GROUP/PERIOD/PAY_GROUP/PAYROLL_ENTITY` 사실과 민감필드를 owner service에서 최종 판정 |

People 정책의 action은 별도 권한동사를 소유하지 않고 Auth/product manifest가 소유한 product-neutral `capability_key`와 `action_key`를 논리 참조한다.

기존 app-admin preset의 승인·활성·만료·review·SoD 패턴은 재사용하지만 `sys_admin_*`에 HR 업무권한을 직접 적재하지 않는다. 현행 `APP.HCM` canonical과 `APP.HRIS` 호환 alias, HRIS capability/resource/action catalog, 메뉴 manifest와 백엔드 PEP registry의 동일 mapping, effective permission 기반 SoD를 함께 고도화한다. Auth에는 HR 업무행이나 도메인 정책을 복제하지 않고 assignment별 1:N `{policy_owner, policy_ref, policy_revision}` 집합만 저장한다. 서비스 간 물리 FK도 만들지 않는다. 각 owner는 opaque scope key를 자신의 데이터로 재검증한다.

세부 설계는 `authorization-blueprint.md`를 따른다.

## 4. 공통 설정과 확장

### 4.1 Versioned configuration

| 테이블 | 주요 키/컬럼 | 설명 |
|---|---|---|
| `cfg_hris_policy_definitions` | `policy_key`, `policy_type`, owner | 정책 identity와 schema |
| `cfg_hris_policy_versions` | policy, version, valid period, payload, status | 불변 버전, draft/published/retired |
| `cfg_hris_policy_assignments` | policy version, scope kind/id, priority | 법인/사업장/집단별 적용 |
| `cfg_rule_definitions` | `rule_key`, language, input/output schema | 계산/판정 규칙 정의 |
| `cfg_rule_versions` | expression/decision table, effective period | 샌드박스 실행 버전 |
| `cfg_rule_test_cases` | inputs, expected, legal/business reference | 게시 gate 테스트 |
| `cfg_code_sets` | `code_set_key`, ownership, extensibility | typed 코드 집합 |
| `cfg_code_values` | code set, code, valid period, attributes | tenant/국가팩 코드값 |
| `cfg_translations` | resource key, locale, text, version | 메뉴/코드/템플릿 다국어 |
| `cfg_calendars` | calendar key, timezone, jurisdiction | 영업/근무/급여 캘린더 |
| `cfg_calendar_dates` | calendar, date, day type, hours | 공휴일/회사휴일/대체휴일 |

### 4.2 Custom field와 확장팩

| 테이블 | 설명 |
|---|---|
| `ext_field_definitions` | 대상 aggregate, data type, validation, sensitivity, search/index 여부 |
| `ext_field_values` | tenant, definition, subject public ID, typed/encrypted value |
| `ext_package_catalog` | package key, provider, signature, compatibility, support 상태 |
| `ext_package_versions` | artifact digest, API/event requirements, permissions, data classes |
| `ext_tenant_installations` | tenant 설치 버전, config, status, installed/approved by |
| `ext_hook_subscriptions` | 허용 event/hook, endpoint ref, retry/dead-letter policy |
| `ext_execution_receipts` | 호출, 입력 digest, 결과, latency, 오류, correlation |

JSONB를 만능 custom field 저장소로 사용하지 않는다. 검색/정렬/법정보고에 쓰이는 필드는 정식 typed column/table로 승격한다. 확장값은 sensitivity와 암호화 방식을 정의하지 않으면 게시할 수 없다.

## 5. Core HR 테이블

### 5.1 Enterprise와 employment

| 테이블 | 주요 관계 | 핵심 불변식 |
|---|---|---|
| `ppl_legal_entity_registrations` | legal employer, jurisdiction | 등록번호 암호화/유효일, jurisdiction별 unique |
| `ppl_business_units` | legal employer/organization | tenant+code+valid period unique |
| `ppl_establishments` | legal employer, location | 사업장/세무/보험 신고단위 |
| `ppl_employment_terms` | work relationship/assignment | 고용형태·시간·급여군·노조·계약기간 |
| `ppl_assignment_events` | assignment, reason, effective time | 입사/이동/승진/휴직/복직/종료 event |
| `ppl_assignment_event_items` | event, changed field, before/after ref | 발령 영향과 승인 증적 |
| `ppl_compensation_basis` | assignment, grade/rate, period | 급여계산 입력; 직접 급여결과 아님 |
| `ppl_employment_contracts` | relationship, template/document | 서명/버전/시작·종료 |
| `ppl_worker_bank_accounts` | person/worker | 계좌 암호화, 용도/우선순위, 검증상태 |

### 5.2 Profile과 employee service

| 테이블 | 설명/보안 |
|---|---|
| `ppl_dependents` | 가족/부양 관계; 민감 필드 분리, 급여·복지 목적별 접근 |
| `ppl_educations` | 학력과 검증 문서 |
| `ppl_careers` | 경력과 재직기간 |
| `ppl_qualifications` | 자격/면허/만료/검증 |
| `ppl_service_records` | 병역/보훈 등 국가팩 가능한 field group |
| `ppl_accessibility_records` | 장애/편의 정보; 최고 민감도·목적 제한 |
| `ppl_employee_change_requests` | 대상 aggregate, patch, before/after, workflow case |
| `ppl_employee_change_evidence` | request, object/document ref, classification |
| `ppl_certificate_requests` | 증명 종류, 언어, 용도, 수신/만료 |
| `ppl_issued_certificates` | 불변 문서 digest, 진위 token, revoke status |
| `ppl_separation_cases` | 퇴직/종료 case, 사유, 일정, checklist |
| `ppl_separation_tasks` | 회수/정산/연계 task와 owner/SLA |

## 6. Time 테이블

### 6.1 스케줄과 타각

| 테이블 | 주요 컬럼 | 불변식 |
|---|---|---|
| `tme_work_rule_sets` | rule key, version ref, timezone | 게시된 규칙 버전만 배정 |
| `tme_shift_templates` | start/end/break/cross-day | timezone/DST 처리 명시 |
| `tme_schedule_patterns` | rotation, cycle length | 유효일과 calendar 연결 |
| `tme_work_schedule_profiles` | 현행 확장 | 근무제 identity |
| `tme_worker_schedule_assignments` | worker/assignment, profile, period | assignment 기간 밖 배정 차단 |
| `tme_scheduled_segments` | worker, local date, start/end, segment type | 생성 source/rule 버전 보존 |
| `tme_clock_sources` | device/vendor/channel, trust level | credential은 secret ref만 |
| `tme_clock_events` | source event ID, worker, captured/received time, type | append-only, source idempotency unique |
| `tme_clock_event_links` | raw event와 해석 segment | 원시자료와 결과 추적 |

### 6.2 해석·카드·마감

| 테이블 | 설명 |
|---|---|
| `tme_interpretation_runs` | 대상 기간/집단, 입력·규칙 snapshot, attempt, 상태 |
| `tme_interpreted_segments` | regular/overtime/night/holiday/break/absence 결과 |
| `tme_time_ledger_entries` | 시간/수량 delta 원장, source, reversal 관계 |
| `tme_time_cards` | 현행 확장; 기간 projection/제출/승인 상태 |
| `tme_time_entries` | 수기/정정 입력; ledger posting 전 command state |
| `tme_time_exceptions` | 규칙 위반, severity, owner, resolution/evidence |
| `tme_close_periods` | day/month scope, open/closing/closed/reopened |
| `tme_close_attempts` | validation 결과, blocker snapshot, approval/ref |
| `tme_close_events` | close/reopen/freeze 불변 event |
| `tme_payroll_handoffs` | payroll로 보낸 time aggregate와 digest, 수신 대사 |

원시 타각은 절대 덮어쓰지 않는다. 오입력은 취소 event 또는 신뢰도 낮은 원천으로 표시하고 재해석한다. 해석 결과와 급여 인계는 사용한 rule snapshot을 가진다.

## 7. Leave 테이블

| 테이블 | 설명 | 핵심 불변식 |
|---|---|---|
| `abs_leave_plans` | 현행 확장; 유형/단위/jurisdiction | 게시된 plan version |
| `abs_leave_plan_versions` | 자격, 발생, 소멸, 이월, 한도 rule refs | 유효일 버전 |
| `abs_worker_plan_enrollments` | 현행 확장 | worker/assignment 적격기간 내 |
| `abs_leave_requests` | 현행 확장 | workflow와 segment 합계 일치 |
| `abs_leave_request_segments` | 날짜/시간대/수량/타임존 | schedule과 충돌 검증 |
| `abs_entitlement_runs` | 발생·소멸·이월 dry/commit run | 동일 input/rule idempotent |
| `abs_entitlement_ledger_entries` | grant/use/release/expire/carryover/adjust/reverse | append-only |
| `abs_leave_balances` | 현행 projection | 원장에서 재생성 가능 |
| `abs_leave_evidence` | 증빙 object ref와 보존/접근 등급 | 사유와 의료정보 분리 |
| `abs_leave_period_locks` | payroll/time close 연동 잠금 | 승인된 reopen만 해제 |

잔액 테이블을 진실로 삼지 않는다. 잔액은 entitlement ledger의 projection이어야 한다.

## 8. Payroll 테이블

### 8.1 Foundation과 규칙

| 테이블 | 주요 역할 |
|---|---|
| `pay_legal_payroll_entities` | 지급/세무/보험/회계 단위와 legal employer 연결 |
| `pay_pay_groups` | 대상집단, 빈도, 통화, 지급방식 |
| `pay_pay_calendars` | 주기 생성 규칙, cutoff/pay date |
| `pay_pay_periods` | open/input-locked/calculating/approved/posted/closed 상태 |
| `pay_element_definitions` | earning/deduction/employer cost/information/balance |
| `pay_element_versions` | 이름, 과세/보험/회계 분류, priority, input/output schema |
| `pay_formula_definitions` | formula identity와 owner |
| `pay_formula_versions` | expression/decision table, rounding, dependencies, tests |
| `pay_balance_definitions` | period-to-date/year-to-date/lifetime balance |
| `pay_rounding_policies` | 단계·통화·법정 항목별 반올림 |
| `pay_worker_element_entries` | worker/assignment별 고정·변동 항목, 유효일/출처 |
| `pay_worker_tax_profiles` | 원천징수/거주/부양 등; 암호화/목적 접근 |

### 8.2 실행과 결과

| 테이블 | 주요 역할 | 불변식 |
|---|---|---|
| `pay_payroll_runs` | regular/off-cycle/retro, period, 대상 snapshot | 확정 후 불변 |
| `pay_payroll_run_attempts` | 실행/재실행, engine/rule/input version | 이전 attempt 덮어쓰기 금지 |
| `pay_payroll_run_workers` | 대상자 상태, 제외/보류 근거 | run 대상 snapshot 고정 |
| `pay_calculation_traces` | rule graph, inputs, intermediate/rounding | 민감 접근, 설명 가능 |
| `pay_worker_results` | gross/deduction/net/employer cost totals | line 합과 일치 |
| `pay_result_lines` | element별 amount/rate/quantity/balance effect | NUMERIC, currency |
| `pay_balance_ledger_entries` | balance delta, source result line | append-only/reversal |
| `pay_retro_events` | 원 변경, 영향기간, 발견시각, 처리 run | temporal lineage |
| `pay_reconciliation_issues` | 전월/지급/GL/외부 차이와 resolution | closure evidence |
| `pay_run_approvals` | maker/checker, policy, decision | 동일 actor 분리 |
| `pay_run_audit_bundles` | input/rule/result/export digest | WORM 보존 검토 |

### 8.3 지급·회계·명세

| 테이블 | 설명 |
|---|---|
| `pay_payment_batches` | 승인된 run 결과에서 생성된 지급 batch |
| `pay_payment_instructions` | 수취계좌 token, 금액, 상태; 원 계좌 평문 저장 금지 |
| `pay_payment_files` | object ref, digest, bank format, 생성/다운로드 감사 |
| `pay_payment_reconciliations` | 은행 결과와 instruction 대사 |
| `pay_gl_mapping_rules` | element/cost center/legal entity → account rule version |
| `pay_gl_batches` | posting 단위, debit/credit total, status |
| `pay_gl_lines` | account/cost object/amount, source result lineage |
| `pay_gl_reconciliations` | ERP receipt/posted ref/차이 |
| `pay_payslips` | 기존 statement reference 확장; 불변 문서, 게시/철회 |
| `pay_payslip_access_events` | 조회/download/print actor와 목적 |

## 9. 국가팩 테이블

국가별 업무는 코어와 물리적으로 같은 DB에 있어도 namespace와 release 단위를 분리한다.

| 테이블 | 설명 |
|---|---|
| `stt_jurisdictions` | 국가/지역/기관과 통화·timezone |
| `stt_country_pack_versions` | pack digest, 시행일, 지원기간, 승인/근거 |
| `stt_rate_table_definitions/versions` | 세율·보험료율·구간·상한/하한 |
| `stt_worker_registrations` | 기관별 가입/자격·식별 token |
| `stt_liability_results` | employee/employer liability와 payroll line 연결 |
| `stt_filing_cases` | 신고기간/기관/상태/접수번호 |
| `stt_filing_artifacts` | 제출/응답 파일, digest, object ref |
| `stt_retirement_cases` | 퇴직 대상/기간/계산/지급/신고 |
| `stt_yearend_cases` | 연말정산 대상, 단계, 자료, 결과, 정정 |
| `stt_yearend_evidence` | 공제자료와 민감 등급/보존 |

`PAY`, `RET`, `YEA`가 별도 화면/모듈이더라도 worker, pay result, statutory liability 간 lineage를 끊지 않는다.

## 10. Performance 테이블

| 테이블 | 설명 |
|---|---|
| `prf_cycle_definitions/versions` | 주기 단계, 일정, 공개/이의 정책 |
| `prf_template_definitions/versions` | section/item/weight/scale |
| `prf_population_assignments` | 대상집단과 template/cycle |
| `prf_participants` | 대상자, 상태, 예외/제외 |
| `prf_goals` | 조직/개인 목표, cascade, 측정/가중치, 버전 |
| `prf_evaluator_assignments` | 평가자 유형, 관계, 익명성, 유효일 |
| `prf_evaluations` | 단계별 evaluation identity와 상태 |
| `prf_evaluation_responses` | 문항/점수/서술; 공개 범위 분리 |
| `prf_feedback_requests/responses` | 다면/수시 feedback |
| `prf_interviews` | 면담 일정/양식/기록/공개등급 |
| `prf_calibration_sessions` | 대상집단, owner, 상태, 기준 |
| `prf_calibration_adjustments` | before/after, 사유, 승인과 감사 |
| `prf_results` | 확정 결과, 공개시각, 이의 상태 |

평가 원문과 최종 결과, 보정 전후를 덮어쓰지 않는다. 가시성 정책은 직원/평가자/관리자/HR/감사자별로 분리한다.

## 11. 문서·워크플로·통합 참조

HRIS 안에 공통 승인/알림/파일 엔진을 복제하지 않고 참조 테이블만 둔다.

| 테이블 | 설명 |
|---|---|
| `hrs_business_cases` | 업무 case identity, type, subject, workflow case ID |
| `hrs_case_actions` | 업무 action과 승인 decision/event 연결 |
| `hrs_document_bindings` | aggregate와 DWP object/document ID, 분류/보존 |
| `hrs_template_bindings` | 업무·locale·scope와 DWP template ID/version |
| `hrs_notification_bindings` | domain event와 notification policy ID |
| `hrs_integration_handoffs` | outbound payload digest, adapter receipt, 대사상태 |

## 12. 인덱스·파티션·보존

### 필수 인덱스 패턴

- `(tenant_id, public_id)`
- `(tenant_id, business_key, valid_from)`
- `(tenant_id, status, effective/pay/work date)`
- 외부 매핑 `(tenant_id, source_system_id, source_record_key)` unique
- event/receipt `(tenant_id, correlation_id)`, `(tenant_id, occurred_at)`

### 파티션 후보

- `tme_clock_events`, `tme_time_ledger_entries`: tenant hash + 월/분기 range
- `pay_result_lines`, `pay_calculation_traces`: payroll entity/기간
- 감사/접근 event: 월 range와 archive tier

작은 tenant마다 개별 물리 테이블을 만들지 않는다. 대형 전용 배포는 같은 논리 schema와 migration contract를 사용한다.

### 보존

- 원시 타각, 급여/세무/지급/회계, 평가자료는 국가·계약별 보존정책 ID를 참조
- legal hold는 파기보다 우선하되 최소권한 유지
- 대용량 trace는 digest와 핵심 index를 DB에, 상세 bundle을 WORM 가능한 object storage에 저장 가능
- 파기 job도 대상, 근거, 승인, 결과 digest를 감사에 남김

## 13. 물리 설계 전 반드시 검증할 질문

1. 테넌트 규모 상한, 일일 타각 건수, 급여 대상 수와 급여기간 peak는 얼마인가?
2. 한국 외 어느 국가를 언제 지원하는가?
3. 급여 engine을 자체 계산할지 외부 provider와 병행할지?
4. ERP/은행/세무/타각별 동기·batch·파일 계약과 SLA는 무엇인가?
5. retro의 최장 소급기간과 재계산/회계 역분개 정책은 무엇인가?
6. 직원 한 명의 복수 고용·복수 법인·복수 통화·글로벌 assignment 요구가 있는가?
7. 조직/직무/급여/평가에서 실제 고객별 custom field와 검색 요구는 무엇인가?
8. 보존·파기·노무감사·법정신고 증적에 적용할 관할 규정은 무엇인가?

이 질문의 답 없이 물리 테이블을 먼저 확정하면 SKKF의 사별 구조를 새로운 이름으로 재생산할 가능성이 높다.
