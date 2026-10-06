# 공통 migration·schema allocation successor 작성자 제안

상태: **DESIGN_PROPOSED_NOT_CANONICAL / AUTHOR_ONLY / G3_AUTHORIZATION_NONE**.
역사적 G2 SQL503 blobs·seal·23 allocation행과 현재 G0/G3 CSV/source/main SQL을 수정하지 않았다. 이 패키지는 정본 합성·독립 기술 검토에 넘길 예약 입력이다. 작성자가 자신의 설계를 독립 PASS로 승인하지 않는다.

## Git-only 현행 사실과 아직 없는 공통 예약

고정 backend commit은 `db0d2b5067e6fbee27ee58121c5a4406cab132b9`, tree는 `20f345a640b1d8238b9a2e709a060cc51df9b729`다. Historical `6f1ed92d2610ace3df75f094297032e8b476ef5d` 이후 SQL503개 mode/OID/bytes/SHA는 불변이고18개만 추가되어521개다. 전체 stream/core/local fixture 파일 manifest SHA는 `b983d1452c25b35461caf9fd311642dd33447e42f1cfb48dfde9a052dcb46d65`다. 기존 전수 manifest를 pinned predecessor로 보존하고 새 도구가 Git blob을 직접 다시 읽는다. 작업-tree SQL이나 실제 DB history를 읽었다고 주장하지 않는다.

| stream | 현재 numbered SQL files / high-water | successor 역할 |
| --- | --- | --- |
| auth-main/public | 114 / 212 | common WCE213 후보를 먼저 구분, SYS module214..242 후보 |
| people-main/public | 48 / 48 | common native-employer49 후보를 먼저 구분, HRM module50..72 후보 |
| people-performance/hris_performance | 0 / 0 | PER1..63 후보; primary와 별도 filename/history namespace |
| platform-main/public | 203 / 237 | module238..266 후보, private 현대 업무를 public에서 제외 |
| approval-main/public | 16 / 16 | common Control on-demand만; module writer 새 허가 없음 |
| notification-main/public | 29 / 30 | V1..26+28/29/30; 숫자27 부재만으로 missing-source 결함 아님 |
| provider-main/public | 57 / 57 | common Control on-demand만; module writer 새 허가 없음 |
| time-main/public | 0 / 0 | TIM1..39 후보 |
| payroll-main/public | 0 / 0 | PAY1..49 후보 |

Meeting27files/high41·Space6/high6·Messaging15/high16, core repeatable1과 local fixture5는 별도 보호 inventory다. Time/PAY numbered source0은 native DB history0이나 core repeatable 미실행 증명이 아니다. 같은 정수 prefix의 Auth89/89.1/89.2/89.3도 각각 distinct Flyway version이다.

People49와 Auth213은 **아직 commit되지 않은 제안 예약**이다. free high-water 뒤 숫자라는 이유만으로 승인한 것이 아니다. common/private 후보와 module 후보 전체를 함께 대조해 충돌을 제거했다. 실제 common SQL이 다른 슬롯을 소비하면 module CREATE 전에 successor를 재계산·독립 검토·게시한다. 새 commit 이후521count를 current proof로 재사용하지 않는다.

## exact CREATE-only 후보와 기존 범위 영향

| owner/stream | 역사적 범위 | module 후보 범위 | named files / capacity / unused |
| --- | --- | --- | --- |
| HRM/people-main | 47..69 | 50..72 | 21 / 23 / 2 (65,66) |
| PER/people-performance | 1..63 | 1..63 | 22 / 63 / 41 |
| SYS/auth-main | 211..239 | 214..242 | 1 / 29 / 28 |
| SYS/platform-main | 231..259 | 238..266 | 12 / 29 / 17 |
| TIM/time-main | 1..39 | 1..39 | 20 / 39 / 19 |
| PAY/payroll-main | 1..49 | 1..49 | 21 / 49 / 28 |

105 candidate rows는 기존100 schema-touch slice의 exact IDs·기존 planned filename·allocation ID·owner session·test/acceptance/source 문자열을 모두 보존한다. SYS 현대3slice를8private files로 분할했으므로100−3+8=105다. operation 수를 SQL 수로 계산하지 않았다. retired/no-migration slice에 슬롯을 부여하거나, source count를 바꾸어 historical Gate를 PASS시키지 않는다. **현재 schema-touch demand100 자체가 새 BASE/modern 전체 의미 재설계에 충분하다는 인증은 아니다.**

각 후보 row는 `CREATE_ONLY`, `ROLE.HRIS_<module>_ENGINEERING`, `DESIGN_RESERVATION_NOT_CREATE_AUTHORIZATION`이다. Integration Control은 module owner가 생성한 **동일 Git blob**만 통합하고 실제 전체 resource/replay/ACL/history/receipt를 검증한다. common candidate6개는 module 후보와 분리된 Control 책임이다. 해당 test path는 **새 테스트 할당 제안**이며 파일/compile/native 실행이 존재한다는 뜻이 아니다.

기존 People70..89 PER G2 entry allocation은 이미 SUPERSEDED/HISTORICAL_ONLY다. HRM70/71/72와의 숫자 겹침은 active PER authority가 아니라 predecessor 기록이다. 정본 successor에서 명시적 supersession 링크를 게시해야 하며 역사 행을 삭제하거나 당시 예약을 수정하지 않는다.

### People native legal-employer 공통49

Exact candidate filename: `dwp-people-server/src/main/resources/db/migration/V49__add_native_legal_employer_public_id.sql`.
현재 V1..48의 `ppl_legal_employers`에는 `legal_employer_id BIGINT`, `tenant_id`, `employer_key`만 있고 native `public_id`가 없다. Root native query reader가 존재하지 않는 UUID를 SELECT하는 P0를 수리하기 위한 **공통 데이터 타입 보완**이다. 새 별도 신원 원장이나 HRM domain migration이 아니다.

제안은 기존 owner table에 `public_id UUID NOT NULL DEFAULT pg_catalog.gen_random_uuid()`를 forward 추가해 existing rows에 실제 독립 UUID를 배정하고, public_id 단독 및 tenant_id+public_id uniqueness/COMMENT를 봉인한다. 내부 PK·tenant/local FK·business employer_key·수명주기는 유지한다. 다국가·다법인·다assignment에서도 사업자 명명 규칙과 무관한 실제 owner public identity가 필요하다. correlation ID·employer_key hash·BIGINT relabel은 대안이 아니다.

Writer는 common `ROLE.INTEGRATION_CONTROL`, CREATE-only이며 root가 reservation review 후 실제 새 파일만 생성한다. 이 작성자 패키지는 V49 SQL을 만들거나 적용하지 않았다. 기존48업그레이드 backfill/non-null/unique/default-new-row, duplicate/tenant identity 거부, fresh/restart/source query compile/native payload 증거가 필요하다. HRM은 V49를 소비할 수 없다. 이 allocator가 commit되면 새522+ inventory/native seal/Control source reference를 다시 고정해야 한다.

## private4 stream의 개별 예약 — 실제 bootstrap OPEN

Root authority decision SHA `4be3e9a506387c463cfea1f7d1584a10ec1fd65ce689dfb897bf0b2d4c0081a1`에 맞춘다. 기존8service/9scalar stream은 보존하고 추가4개를 scalar receipt에 이름만 추가하지 않는다.

| stream/schema | history | migration 후보 principal / runtime purpose |
| --- | --- | --- |
| platform-hris-configuration/hris_configuration | flyway_hris_configuration_history | dwp_hris_configuration_migration / CONFIGURATION(dwp_hris_configuration_runtime) |
| platform-hris-protected/hris_listening_protected | flyway_hris_listening_protected_history | dwp_hris_listening_protected_migration / LISTENING_ADMISSION(dwp_hris_listening_admission_runtime) |
| platform-hris-insights/hris_insights | flyway_hris_insights_history | dwp_hris_insights_migration / INSIGHTS_EXECUTION_WRITE(dwp_hris_insights_execution_runtime), INSIGHTS_QUERY(dwp_hris_insights_query_runtime; readOnly) |
| auth-hris-participation-issuer/hris_participation_issuer | flyway_hris_participation_issuer_history | dwp_hris_participation_issuer_migration / PARTICIPATION_ISSUER(dwp_hris_participation_issuer_runtime) |

이 문자열은 후보 deployment identifiers다. 실제 역할·DS·schema·history·receipt가 존재/배선됐다는 뜻이 아니다. 각각 별도 `db/hris-*-migration` location과 history key를 가진다. V1은 Control privilege-baseline **미구현 예약**이고 domain 후보는 V2..4(configuration/insights), V2(protected/issuer)만 exact named 예약한다. speculative 미래 범위는 만들지 않았다. V1에서 schema/role CREATE를 app에 허가하지 않는다. external Control이 승인 schema/owner/LOGIN/CONNECT/history를 선프로비저닝하고 `createSchemas=false`, missing/wrong-owner fail-closed를 실제 입증해야 한다.

Listening은 configuration/protected/insights/issuer4경계를 요구하고 Analytics/AI는 configuration+insights2경계만 요구한다. disabled capability의 DS는 열지 않으며 primary credential/fallback·SET ROLE·cross-schema FK/repository import는 금지한다. query purpose를 writer로 바꾸거나 primary runtime에 보호 답변/issuer 접근을 주지 않는다. 현재 composite inspection scaffold는 **미배선 외부 검사 파일럿**이고 실제 Control producer/runtime-only signed startup seal/현재 epoch·freshness·deployment fence는 OPEN이다. People main/performance 기존 shared principal 역시 새 composite distinct role proof가 아니다.

기존 physical prefix register의 SYS configuration/insights/public 행은 역사·현행 입력으로 보존했다. 새 private4 schema의 exact table prefix/owner/DS/SQL qualification과 canonical successor route는 독립 승인 후 함께 게시해야 한다. legacy platform public slice 후보12개는 재분류 OPEN이며 schema-touch 필요 자체도 검토한다. Audit/workflow/templates/provider/tenant 등 owner shared family에 불필요한 HRIS 복제 table을 만들면 안 된다. config sets/versions/evaluations·job/connector metadata·listening/analytics/AI private 데이터를 historical public glob만으로 materialize하면 안 된다. 모듈별 실제 table grouping/restoration/FK/ACL는 이 filename 구조 도구가 인증하지 않는다.

## PAY 기본 target을 public/payroll-main으로 유지

현재 committed ControlPlan과 PFX-PAY-PAYROLL은 `public`, `pay_`, `payroll-main`, `classpath:db/migration`, `flyway_schema_history`에 일치한다. Payroll은 이미 별도 catalog와 dedicated runtime/migration authority를 가진다. 단순 schema명 변경은 별도 신뢰 경계를 만들지 않으며 history/resource stage/receipt/role/bootstrap/cutover를 추가한다. G3 준비에 불필요한 새 service/schema를 요구하지 않는다.

국가팩·회사별 정책은 typed versioned configuration/refetch 계약으로 분리한다. `payroll` 전용 schema가 실제 배포·보안 요구를 충족할 때만 별도 reviewed architecture successor로 처리한다. public라는 이유로 다른 domain DB join/owner credential/일반 runtime DDL을 허가하지 않는다. PAY88table/119op author draft의 exact source/restoration/DDL grouping은 별도 OPEN이고 실제 business CREATE/CRUD 수용은 G4다.

## 정본 게시와 검사 경계

공통 owner 예약 review → 실제 common CREATE/commit → committed exact inventory 재고정 → G0 migration/file ownership + G3 file/slice/checkpoint + schema/prefix/stream/test paths + generator/validator/session instructions + paired baseline를 함께 successor 게시 → exact module owner CREATE token → Control 동일 blob merge+실제 shared/current runtime proof → 독립 Gate 판정 순서다. 역사적 count/range validator를 완화하지 않는다.

실행 명령(cwd `/Users/a10697/Work/DWP`, bundled Python):

```sh
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_common_allocation_successor.py
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B -m unittest discover -s output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation -p test_common_allocation_successor.py -v
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -B output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_common_allocation_successor.py --require-g3
```

Author20 unit tests와15 machine-readable mutation cases는 exact slice/filename/test-string/owner/slot/common-private 충돌, PAY default, private history/role/query purpose, native UUID relabel, pin 누락/mixed graph와 false readiness를 검사한다. G3 register102행 중 retired2를 제외한100개 exact schema-touch IDs와 직접 비교하며 tentative100 슬롯만 서로 세는 검사가 아니다. Git521개/503immutable/18ADDED는 별도 정상 CLI에서 실제 blob oracle로 재현한다. 정상 exit0도 `readinessPass=false/G3_AUTHORIZATION_NONE`이고 `--require-g3`는 exit1이다.

도구는 SQL AST/업무 grouping·전체 semantic lineage·실제 foreign key/table prefix·bootstrap permissions·signed authority/runtime/native replay 또는 full-module readiness를 검증하지 않는다. declarations의 허용 metadata prose 전체를 인증하는 도구도 아니다. 전수 exact G3 설계·공유 DTO/SPI/adapter/guard/scaffold와 현재 common+pilot runtime은 G3 요구사항이다. domain CRUD/full journey 실행은 G4, customer/live authority/country/adoption/production activation은 G6다. 어느 작성자 count/test도 이 OPEN을 닫지 않는다.
