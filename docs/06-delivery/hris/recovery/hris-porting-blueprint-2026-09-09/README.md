# DWP HRIS 완전 이관 설계 패키지

작성일: 2026-09-09  
현재 정본 기준일: 2026-09-11  
현재 상태: **`VALIDATOR_CONTROLLED` / 현재 `BLOCKED` / 구현 `NOT_STARTED_G3` / Production `NOT_AUTHORIZED_G6`**  
분석 범위: `SKKF/eHR`, `SKKF/eHR_Front/cloudhr-front`, `dwp-backend`, `dwp-frontend`  
제외 범위: BENSK 및 ADDSK 업무 기능. 공통 PAY/TIM 코드 안의 ADDSK 표식은 범용 core 재유입 방지를 위해 격리 심사

이 패키지는 SKKF 화면과 소스를 DWP에 그대로 복제하기 위한 문서가 아니다. SKKF가 보유한 인사·급여·근태·성과·공통설정의 업무 능력을 빠짐없이 식별하고, DWP의 테넌트·권한·승인·감사·통합 기반 위에서 범용 HRIS 제품으로 다시 구성하기 위한 목표 설계다.

## 먼저 읽을 문서

1. [현재 전체 코딩 준비 정본](./coding-readiness/README.md) — 아키텍처·프론트·백엔드·데이터·보안·품질·운영·Gate 통합 계약
2. [최신 live 코딩 준비 검증 리포트](./coding-readiness/reports/full-coding-readiness-latest.md) — static 보고서가 덮어쓸 수 없는 authoritative LIVE 정본. 공개 판정 전 `validate_published_gate_truth.py`가 `PASS`, `OPEN_G3_CODE`, `NOT_STARTED_G3`, `NOT_AUTHORIZED_G6`와 현재 digest를 검증한다.
3. [G3 전체 코딩 실행 계약](./session-prompts/07-g3-full-coding-execution-contract.md) — 5개 모듈과 Integration Control의 착수 명령, 의존 순서, 경계, 종료 조건
4. [현재 5개 세션 실행안](./implementation-readiness-and-five-session-plan.md) — source 책임 분할과 target runtime, 모듈화, 병렬 순서, G3→G6 경계
5. [G0 코드 checkpoint validator](./g0/validate_code_checkpoint.py) — 현재 baseline·worktree·소유권·migration·module evidence live 검증기
6. [5개 세션 source coverage 정본](./five-session-source-coverage-register.csv) — parent 2,269건의 단일 모듈 배정과 최종 disposition
7. [5개 세션 G3 manifest](./five-session-execution-manifest.csv) — target runtime, 허용/금지 경로, 의존 계약, migration 정책
8. [모듈별 G1/G2 증거](./session-evidence) — HRM/PER/PAY/TIM/SYS parent·child trace, 물리 schema, API/event, state, authorization, synthetic golden, validator
9. [HRIS 메뉴·UX 설계](./uiux-and-menu-blueprint.md) — 사용자·관리자 메뉴, 홈 위젯, 탐색기, 고위험 업무 UX
10. [HRIS 권한 설계](./authorization-blueprint.md) — 5개 logical UI/persona category를 31개 risk/duty access package와 128개 atomic duty(base 67 + modern 48 + IA initial-read 13), population/field/purpose/SoD로 세분화
11. [모듈 기능 완료 후 Design AI 전달 계약](./session-prompts/90-design-ai-handoff-output-contract.md) — G5A 전체 화면 프롬프트 패키지, G5B 승인, G5C 교체·회귀
12. [남은 준비·활성화 대장](./remaining-preparation-register.csv) — G3 내부 준비와 G5/G6 미래 Gate를 분리

과거 검증 시점의 문서는 추적을 위해 보존한다. [G0 G1-entry closeout](./g0/g0-closeout-report.md), [1차 검증 보고서](./phase1-validation-report.md), [2026-09-10 사전 재검증](./full-module-readiness-revalidation-2026-09-10.md)은 각각 당시 checkpoint의 이력이며, 현재 Gate 판독에 사용하지 않는 `HISTORICAL / SUPERSEDED` 문서다.

## 기계 추출 원본 인벤토리

- [skkf-route-inventory.csv](./skkf-route-inventory.csv) — 코드상 라우트 선언 886건
- [skkf-backend-controller-inventory.csv](./skkf-backend-controller-inventory.csv) — `*Controller.java` 후보 825개(표준 controller annotation 후보 820개)
- [skkf-entity-table-inventory.csv](./skkf-entity-table-inventory.csv) — 엔티티 558개, 모듈 간 중복 제거 후 고유 명시 테이블명 536개

인벤토리의 개수는 실제 운영 메뉴나 독립 업무기능 수와 같지 않다. 상세 화면, 별칭, 동적 경로, 퍼블리싱 샘플, 중복 공통 구현이 함께 포함되어 있다. raw parent 2,269건은 HRM 583, PER 349, PAY 580, TIM 568, SYS 189로 중복 없이 배정됐고 모두 target disposition·owner·acceptance evidence가 결정되어 `UNKNOWN / UNASSESSED=0`이다. child behavior 10,001건도 모듈 증거에 연결됐다. source 접근 상태는 별도 개념이다. 2,258건은 승인된 정제 분석 뷰로 확인했고, BENSK 2건은 `RETIRE`, 민감 경계 9건은 raw를 열지 않고 안전한 대체 행위로 판정했다. 이는 source 코드 재사용 허가가 아니며 `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`를 유지한다.

## 최상위 결론

- 사용자 표시는 `인사`에서 `HRIS`로 변경하되, 내부 `hcm`, `/hr`와 권한 canonical `APP.HCM`은 1차 이관에서 유지하고 `APP.HRIS`는 compatibility alias로 읽는다.
- 권한은 DWP 체계를 그대로 사용한다. canonical app entitlement는 `APP.HCM`, `APP.HRIS`는 compatibility alias다. 5개 logical UI/persona category(직원·관리자·업무운영자·설정관리자·전사감사자)는 화면 경험 분류이며, 실제 허용은 31개 risk/duty access package → 128개 atomic duty(base 67 + modern 48 + IA initial-read 13) → population/field/purpose/SoD로 세분화한다.
- SKKF의 Vue 2 단일-spa 프론트와 Spring Boot 2/Java 8 서비스 5개를 그대로 들여오지 않는다.
- DWP의 People 데이터 모델, 정책 기반 화면 진입, 승인·감사·알림·연계 기반을 보존하고 `Core HR`, `Time`, `Payroll` 경계를 명확히 한다.
- 급여와 근태 결과는 수정 가능한 CRUD 데이터가 아니라 버전이 고정되는 원장으로 설계한다.
- 제품 코어, 국가팩, 테넌트 설정, 승인된 확장팩의 4계층으로 고객사 커스텀을 격리한다.
- 급여는 최소 2~3개 병행 산정 주기에서 총액·개인별·세금·보험·지급·회계 결과가 모두 일치해야 전환한다.
- G0의 소스 취급 모드는 `BEHAVIORAL_REIMPLEMENTATION_NO_CODE_REUSE`로 닫았다. 서면 권리 확대 전에는 SKKF 코드·설정·SQL·산식·asset·dependency를 복사/import하지 않고 행위 명세와 합성 fixture로 독립 재구현한다.
- backend code-entry `787f25753a72dc5f0fbbb06783205c0bff6635a5`, frontend code-entry `c658679ef377f43ec4f9fec7e7433eb98f46970e`를 현재 clean integration baseline으로 고정했다. backend `5670877de7a39e94e75021c7e23cbbb553296c90`과 frontend `7635ce4223000ed83cb4965f8374d8a8433f1a62`은 source-characterization predecessor provenance로만 보존한다.
- HRM/PER/PAY/TIM/SYS의 코드 착수 권한은 정적 문구나 개별 검증 결과로 발급하지 않는다. Integration Control의 `g0/transition_g3_gate.py --open`만 네 후보 검증을 내부 실행하고 동일 publication digest를 묶은 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행을 커밋할 수 있다. 그 뒤 `g0/gate_authority.py --check-open --compact`가 PASS할 때만 권한이 유효하다. 현재는 재봉인 중이므로 `BLOCKED`다.
- 설계·추적 G2 계약은 닫혔지만 현재 코딩 착수는 validator-controlled다. 구현은 `NOT_STARTED_G3`이며, 실제 국가팩·ERP/은행/세무/보험/타각·고객 데이터·운영 승인은 `G6` 활성화 조건으로 격리됐고 Production은 `NOT_AUTHORIZED_G6`다.
- G3 코드 권한은 `g0/worktree-branch-register.csv`에 등록된 12개 exact path로만 한정한다. 모듈은 `g1-20260910/{hrm,per,pay,tim,sys}/{backend,frontend}`, 통합은 `integration/{backend,frontend}`를 사용한다. 남아 있는 구 `/hris/{hrm,per,pay,tim,sys}/{backend,frontend}` 경로는 `SUPERSEDED_DO_NOT_USE`이며 checkpoint·증거·병합에 사용하지 않는다.
- 102개 추적 slice 중 실제 code-enabled 범위는 100개다. `BASE-TFR-HRM-006`, `BASE-TFR-SYS-013`은 `RETIRED_NO_CODE` evidence-only이며 source retirement·target absence 증적 외 target code, migration, runtime 검증을 만들 수 없다.
- G2/G3 명령은 slice 행의 자유형 문자열이 아니라 폐쇄형 profile/key/path binding이다. G2는 `BLUEPRINT` cwd의 5개 base exact validator와 modern static normal+self-test를 모듈에 배정하고 PostgreSQL 16/18은 Control만 실행한다. G3 모듈 backend는 service/slice-bounded test, frontend는 exact slice-tagged test typed receipt만 인정하며 root Gradle check와 전체 suite는 Control에만 둔다. register의 `*_display_non_authoritative` 값은 사람이 읽는 파생 표기다.
- 525개 API/event/XCON 계약의 exact primary 구현 owner는 `coding-readiness/g3-contract-primary-ownership-register.csv`가 정본이며 generator와 독립 validator가 source semantic 및 single-owner closure를 함께 검증한다.
- generated contract의 89개 `DOMAIN_RUNTIME` member(기존 81개 + PDX-012~014의 notification/audit 8개)는 `coding-readiness/generated-contract-runtime-invariant-register.csv`가 producer·consumer named slice와 acceptance를 별도로 소유한다. DTO 생성·compile만으로 runtime invariant 완료를 주장할 수 없다.
- 중앙 baseline-syncable artifact는 `g0/append_g3_control_delivery.py`가 공통 host lock 아래 release와 모든 허용 consumer receipt를 한 batch로 CAS append하고 `g0/g3-control-delivery-state.json` digest marker로 봉인한다. 수기 CSV 변경, 일부 consumer 누락, stale·replayed receipt 또는 Git blob drift는 Gate를 닫는다.
- 모듈의 non-Git evidence shard와 자체 hash chain은 `UNTRUSTED_SUBMISSION`이다. G3 checkpoint는 자기 `session-evidence/<module>/g3/module-evidence/checkpoints/<id>`에만 manifest `CREATE_NEW_ONLY`로 준비·봉인하며, blank operation template의 선택 입력은 blueprint 밖에서 작성한다. canonical shard 안 직접 write·rename·overwrite나 실패 bundle 삭제는 허용하지 않는다. Control이 공통 lock 안에서 현재 Gate, shard membership, closed-catalog 명령과 Git touch, exact path·bytes·mode를 독립 재실행·검증하고 durable 중앙 checkpoint test/touch digest로 CAS append한 경우에만 Gate가 소비한다. 이 anchor는 workflow integrity이며 외부 신원 attestation이 아니다.
- 독립 세션 실행성은 `g0/session-environment-evidence.json`이 12개 target worktree, 18개 read-only support worktree, Node/Yarn·dependency materialization, repository별 command receipt와 공통 `hris-verification` lock을 현재 digest로 증명할 때만 인정한다.
- 운영 메뉴·권한·로그, 레거시 DDL/batch는 정확한 운영 parity나 계약된 데이터 이관에만 필요하며 G3 core blocker가 아니다. 실제 연계·법정·고객 golden·실명 승인도 G6에서 해당 capability/테넌트만 fail-closed로 차단한다.
- 과거 V24-era 역할을 가진 기존 Approval 운영 DB는 `INHERIT=true` 잔존 가능성을 별도 위험으로 관리한다. fresh/disposable DB의 G3 clean migration·`NOINHERIT`·strict ACL 검증은 계속 가능하지만, 영향을 받는 운영 DB는 principal inventory, `rolinherit=false` 전환 또는 controlled rebuild, membership/ownership/cluster·database ACL diff, schema-history/ownership digest, backup restore point, strict restart, rollback rehearsal와 실명 DBA·Security·SRE release 승인 없이는 `ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING`이 production을 fail-closed한다.
- 각 모듈은 기능·권한·상태·오류·대사가 G4를 통과한 뒤 `확장형 근무공간 예약 구축` 수준의 **전체 화면 Design AI 프롬프트 패키지와 검증 ZIP**을 의무 산출한다. G5A 요청 준비, G5B 사용자·제품 owner 승인, G5C 코드 교체·회귀를 분리하며 G5C 전에는 최종 완료가 아니다.
- G3 시점의 G5A package 검증 상태는 `NOT_RUN_NOT_DUE`다. G4 이후에만 G4 frontend surface inventory를 기준으로 package/manifest/hash/PII·secret/IA-owner/ZIP 일치를 검사하고, 모든 렌더 이미지에는 fresh Apple Vision OCR을 다시 실행한다.
