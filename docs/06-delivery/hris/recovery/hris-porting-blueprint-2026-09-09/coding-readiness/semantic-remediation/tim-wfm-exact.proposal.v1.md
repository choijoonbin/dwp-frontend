# TIM WFM exact successor 입력

상태: DESIGN_PROPOSED_NOT_CANONICAL / G3_AUTHORIZATION_NONE / DOMAIN_NOT_EXECUTED_G4. 작성자 설계이며 현재 module/exact/event 정본이나 독립 승인 결과를 대체하지 않는다.

## 제품·메뉴

WFM은 모든 회사에 강제하는 core가 아니라 설치 가능한 고급 근무계획 capability다. 근태 workbench의 하나의 인력·근무일정 최적화 업무 공간 안에서 수요/후보안/검증/승인/게시의 목록·상세·탭·문맥 행동을 제공한다. command/query가 늘었다고 같은 수의 사이드바 메뉴를 만들지 않는다. native 수요 입력·기본 deterministic solver는 외부 connector 없이 사용할 수 있도록 설계하며, 회사별 제한·근무제·법정값은 효력 있는 policy/country pack으로 해석한다.

Root 후속 교정: canonical shift는 breakMinutes만으로 확장하지 않는다. 실제 WORK/BREAK 구간·paidness·localWorkDate·IANA zone·start/end offset·tzdbVersion·calendar/work-rule snapshot을 저장·조회·게시 입력으로 보존한다. requiredSkills는 optional이며 빈 요구이면 skill pack을 강제하지 않는다. SolverRun QUEUED→RUNNING lease-claim을 별도 owner 행위로 정의하고 candidate QUEUED와 구분했다. 이 추가 계약의 TIM BASE 이름·schema·owner transaction adapter 및 독립 검증은 아직 OPEN이다.

## 이전 설계에서 개선한 내용

- 수요의 실제 typed 행, 근무안의 실제 shift 행, 위반과 공정성 measure를 보존한다. digest-only 성공 모델을 제거한다.
- HRM은 고용·배정·위치, PER는 기술·자격을 소유한다. TIM은 자기 휴가/현재 일정과 합성해 가용시간 planning-input snapshot을 소유한다. HRM.WorkforceAvailability라는 미게시 이름으로 근태 계산을 인사 owner에게 넘기지 않는다.
- forecast/candidate/evaluation/publication은 다른 객체다. draft 수정·새 forecast revision·수요행/근무행/검증/게시 상세조회와 approval withdrawal이 실제 계획에 포함된다.
- revise는 기존 forecast를 허구 NEW_DRAFT 상태로 바꾸지 않는다. source 상태를 유지하고 별도 공개 ID의 DRAFT revision을 생성한다. validation은 실제 VALIDATED/VALIDATION_FAILED 두 guarded 결과만 저장한다.
- candidate lease/cancel/unknown 결과를 분리하고 client가 완료를 임의 확정하는 public endpoint를 만들지 않는다. 게시 전에 실제 입력·승인·충돌을 다시 검증한다.
- 게시 ledger, canonical 근무일정, event outbox와 receipt는 같은 TIM owner transaction이다. 승인 요청 단계에서 게시 기록을 만들지 않는다.
- 실제 G2 `tme_command_receipts.public_id/status/result_ref`와 `tme_outbox_events`를 참조한다. 내부 receipt ID를 공개 UUID로 취급하거나 존재하지 않는 outbox/source column을 생성하지 않는다.

## machine-readable 설계

[JSON](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/tim-wfm-exact.proposal.v1.json)에 public operation 계획, 별도 owner workload 경로, closed typed records/page projections, physical table specifications, tenant-local FK/unique/check/index와 column-authority, operation result entity binding 및 최소 event field sources를 정의한다. source-mode one-of, taxonomy/version/proficiency code, route/body UUID 일치, 세 가지 revision allocator와 pointer 소유 확인도 포함한다.

이 JSON의 physical specifications는 실제 SQL migration 실행 증거가 아니다. 테이블/operation 개수는 통합 설계에서 정당하게 바뀔 수 있으며 이전 100/56 수량에 맞추기 위해 필요한 행동을 숨기지 않는다.

## 아직 닫히지 않은 G3 항목

1. 모든 command/internal callback의 exact per-column write/source dependency graph 및 event emission/receipt payload closure를 현행 schema dialect의 successor로 합성하고 독립 검증한다.
2. 미게시 HRM effective assignment/location, TIM absence/canonical schedule, PER skill vocabulary, SYS effective configuration 및 Approval cancellation의 exact DTO/SPI·권한·refetch·stale 계약을 게시한다. 이름만 정의한 owner port는 실행 계약이 아니다.
3. 공통 fail-closed adapter와 producer/consumer compile, canonical schedule transaction port 및 보호된 workload 실행·취소/unknown pilot을 검증한다.
4. policy/solver registry, 효력·timezone/DST·휴식/교대/동시 배정·공정성 handler의 입력/출력·unit contract와 API-valid 두 설정 fixture를 통합한다.
5. migration successor 용량·예약/파일 소유권, 새로운 SYS authority 및 현재 baseline·전체 증거·5개 profile 자원을 검증한다.

G4에는 실제 모든 업무 CRUD/migration 및 요청→행→event/receipt→조회 여정과 장애·정정·동시성의 native 수용 실행이 필요하다. G5에는 완성된 모든 메뉴/상세/탭/모달/상태/persona에 대한 Design AI 프롬프트·파일 패키지를 작성한다. 실제 고객 authority/data/country/provider 운영 활성화는 G6다.

## 5c0af0 snapshot 독립 감사 이후 보완

[독립 보고서](../reports/tim-wfm-proposal-independent-review-2026-09-14.md)는 P0 7/P1 7/P2 1을 발견했으며, 직접 column65/FK18 일치와 raw validator errors0/operations0 무검사를 명확히 구분했다. 그 승인을 후속안에 승계하지 않는다. 후속 JSON SHA `2f95367ceb94b871833bce3b38406c08c770049fd41b0df94b720a5123898c40`은 22 public/6 internal, record24/table14의 제안 입력이다.

후속 방향 교정: planning qualificationMode NONE이면 PER 호출0/skill ref 없음/typed qualification[]이고, PER_VERIFIED_TAXONOMY이면 설치된 exact owner snapshot이 필요하다. 실제 needsSkills는 frozen demand와 constraint policy에서 도출하며 NONE이 요구를 우회하지 못한다. 정상 zero availability는 snapshot에 보존하되 배정 대상이 아니다. Solver callback은 assignment·시간·실제 segment placement만 제안하고, TIM이 frozen demand 요구·worksite·paidness·근무일/zone/offset/tzdb/calendar/rule refs를 도출한다. candidate의 동일 planning snapshot 및 worker+assignment membership은 추가 tenant composite FK로 묶었으며 temporal/skill/source 진실성은 여전히 owner guard 검증 대상이다.

만료 lease의 watchdog UNKNOWN 전이는 live completion/failure와 분리해 current lease/input/candidate/cancel CAS 후 late delivery를 fence하도록 계획했다. candidate 취소는 이미 완료된 run의 terminal status/result digest를 덮지 않는다. OWNER_SNAPSHOT의 새 revision에는 explicit replacement refetch 경로를 추가하고, 미지정 시 exact old source 복사만 허용한다. commonTableContract 상대 ref와 segment enum dialect를 수정했고, all-headcount0/empty result에 가짜 coverage blocker를 만들지 않는다. Outbox sequence는 business revision이 아닌 owner aggregate CAS version이다.

이는 10개 finding에 대한 제안 방향 수정이지 P0/P1 폐쇄 증거가 아니다. 특히 full operation source/receipt/event graph, exact reconcile outcome/owner PEP, API-valid A/B oracle, 공통 DTO/SPI·fail-closed adapter·consumer compile와 actual shared pilot 및 canonical 합성/independent recheck는 OPEN이다. 원본 5c0af0 독립 보고서는 보존한다.

## d61723 후속 record-schema 검증 범위

최신 JSON SHA `d61723e26d9830ac634d2ae06ec44c758633519d80d95701d4cc30c901d52b11`에는 planning qualificationMode의 조건부 owner-ref 요구, typed measure의 kind별 실제 값 one-of, OWNER_SNAPSHOT/NATIVE_INPUT forecast의 ref 조건을 명시했다. [읽기 전용 projection 검사](validate_tim_wfm_record_projection.cjs)는 설치된 Ajv 6.12.6으로 local 24/imported 2개 record를 Draft-07로 변환·compile하고 실제 36개 selected shape 사례를 실행했다. 정상 no-skill·zero availability, 필요한 PER ref 누락/다른 owner ref, NONE에 PER ref 주입, solver의 owner-owned field·paidness 위조, typed value 종류 혼합 등을 확인했다. 입력 source는 실행 전후 같은 SHA였다.

이는 작성자 record shape 검사다. Imported skill record의 누락된 closed metadata를 **새 projection에서만** 닫았으며 원본 계약을 수정하거나 그 결함이 닫혔다고 선언하지 않는다. Registered unit/taxonomy/정책의 실제 값, owner source 진실성, capability admission, 시간 구간·수요·qualification 의미, BIGINT wire 정밀도, 전체 operation/source graph, native DB 및 독립 승인은 검증되지 않았다. G3_AUTHORIZATION_NONE/G4_NOT_EXECUTED를 유지한다.
