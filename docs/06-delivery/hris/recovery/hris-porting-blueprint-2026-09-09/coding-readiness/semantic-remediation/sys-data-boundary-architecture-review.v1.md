# SYS 데이터 경계 아키텍처 독립 판단 v1

상태: ARCHITECTURE_RECOMMENDATION / DESIGN_PROPOSED / G3_CLOSED. ROOT가 결정·정본 통합한다. 코드·기존 계약·예약은 변경하지 않으며 작성자 PER 제안의 독립 승인도 아니다.

## 권고와 대안

5개 책임 세션 HRM/PER/PAY/TIM/SYS는 유지한다. HRM/PER는 People의 분리된 bounded context/stream, TIM·PAY는 Time/Payroll, SYS는 Auth/Platform 및 필요한 shared capabilities를 담당한다. 세션 수를 서비스 수로 변환하지 않는다.

현재 최소 robust 경로는 **A: Platform 내부 supplemental datasource/role/stream scaffold로 configuration, insights, protected ingestion을 엄격히 분리**하는 것이다. ordinary primary Platform runtime은 기존 public/configuration만 가지며 protected table/routine 접근은 없다. 별도 DS를 임의 SQL API/primary repository에 노출하지 않고 exact owner SPI·목적 검증 adapter에만 배선한다. membership/SET ROLE로 DS 구분을 대신하지 않는다.

**B: dedicated Insights service**는 선택적 extraction 경계다. 규제·부하·장애격리 또는 Platform process compromise까지 private credential 격리가 필요한 threat model이면 B를 선행한다. A는 SQL/역할/코드 책임 least privilege이며 같은 JVM에 supplemental credential이 있다는 이유로 process-compromise 격리를 제공한다고 주장하지 않는다. 이 한계를 수용하지 않는 배포는 A로 승인하지 않는다.

| 항목 | A: supplemental DS/roles/streams | B: dedicated Insights service |
| --- | --- | --- |
| 착수 비용 | 새 배포 단위 없음. single-primary receipt/Control API 확장과 빈 schema 실제 scaffold proof 필요 | 서비스·Control target·identity·routing·budget·artifact/deploy/observability 추가 |
| primary SQL | protected 전체 deny, exact adapter 별도 역할도 자신 schema/purpose만 | Platform process에 Insights owner credential 없음, owner API만 |
| 개인정보 | issuer/protected/analysis schema·DS·role·interceptor 분리. JVM compromise/collusion 한계 | process isolation 강화. Insights ingest/analysis co-location 한계는 별도 명시 |
| 책임 | Auth/Platform SYS 소유, 5세션 불변 | SYS가 추가 서비스 소유, 5세션 불변 |
| 전방 호환 | typed owner SPI/event/refetch 그대로 B extraction | A와 동일 DTO/version/purpose/retention, 서비스간 DB join 없음 |

어느 안도 기본 Platform primary에 protected 전체 접근을 주거나 ordinary RLS session 변수/SET ROLE로 신원·목적 검사를 우회하지 않는다. owner/migration privilege는 Control-only다.

## 제안 데이터·권한 경계

아래는 승인된 physical registry가 아니라 설계 경계다. configuration/public은 실제 baseline으로 보존하며 추가 configuration private schema는 별도 결정한다.

| 경계 | 위치/책임 | 허용·금지 |
| --- | --- | --- |
| configuration/control | 기존 Platform/public + primary runtime | 설정·job/connector·survey form/lifecycle metadata의 명시 범위. HR 원본 계산·protected payload 직접조회 금지 |
| participation identity issuer | Auth 소유 proposed protected purpose schema/dedicated DS | principal/eligibility/issued decision 최소정보+frozen survey owner snapshot. 응답/answer/protected receipt/analysis 접근 금지 |
| anonymous ingestion | proposed Platform protected schema/dedicated DS-role | no-principal verified envelope·survey/token/form·keyed HMAC·원자 token/answer/receipt. principal/worker/trace/IP join 저장 및 일반 caller-bound audit/idempotency 제외 |
| analysis/cohort | 전용 hris_insights schema/분석 SPI | privacy-audited cohort boundary만; protected table 직접조회 금지. 최소인원·정밀 count/차분 재식별·field/retention 적용 |
| Control owner | external bounded native Flyway/approved adoption | 각 stream exact SQL/ACL/RLS/fingerprint/receipt. runtime owner membership/CREATE/DDL/history DML 없음 |

정본01:73/03:59의 configuration-insights repository import/cross-schema FK 금지를 유지한다. tenant-bound public UUID를 exact owner port로 검증하며 DS 분리가 cross-repository join 허가는 아니다. survey/form/retention 버전은 typed immutable owner artifact로 refetch 가능해야 한다.

익명성은 response 경계에 직접 principal을 넣지 않음을 뜻한다. issuer/response 역할 공모, privileged DBA, token/network timing, 식별 free text는 재식별 위험이다. HMAC/key 분리·purpose·DLP·retention·로그 금지·기관 승인으로 줄이되 절대 익명/zero correlation이라고 표현하지 않는다. issuer envelope도 principal/trace를 response 경계에 전달하지 않는다.

## 현재8서비스/9stream scaffold 제약 — P0

Committed common inventory의 ControlPlan은 Platform public1, Auth public1, People public+performance2 및 나머지5로 **8서비스/9stream**이다. platform-main public-only에 insights SQL을 넣거나 문서에 schema 이름만 추가하는 것은 분리 구현이 아니다.

generic app receipt/DB guard와 Control env/fence는 service당 single runtime/migration principal·DS 가정을 가진다. supplemental DS/서로 다른 stream owner를 single-primary receipt로 검증한다고 과장하면 protected ACL/owner/source 및 stream identity가 누락된다. 다음 공통 scaffold를 exact API로 설계·구현·독립 증명한다.

1. **StreamAuthority/receipt successor**: service+stream key+catalog+schema set+history+exact migration principal+allowed runtime/read-only principals+purpose+Control reference. scalar와 composite authority를 version으로 구분한다. external expected digest/reference/current attestation를 stream별 봉인하고 다른 DB/service/stream/role reuse를 거부한다.
2. **DS composition**: bean/qualifier/URL/catalog/principal/readOnly/autocommit exact 등록. primary fallback/generic DB_USERNAME을 private DS에 재사용하지 않는다. SET ROLE 없이 supplemental elevated membership/unknown ACL/history/ownership/definition fingerprint guard·startup ordering을 제공한다.
3. **Role/stream bootstrap**: Control missing-schema exact owner 선프로비저닝, app createSchemas(false), wrong/missing owner fail-closed. issuer/protected/analysis table/routine/cross-DB CONNECT 최소화. immutable SQL/history provenance 및 multi-history seal keys 보존.
4. **Actual shared ports**: issuer eligibility/frozen survey form snapshot, no-principal verified envelope, typed admission/replay result, cohort/privacy result, metric/taxonomy/retention refetch. exact schema→generated DTO/SPI→fail-closed adapter→producer/consumer compile/evidence로 게시한다. Owner.TypedArtifact 이름만으로 통과하지 않는다.
5. **Routing/PEP/privacy**: anonymous 별도 interceptor/telemetry 및 issuer/analysis/config duty·purpose/SoD·retention/DLP allocation. 일반33 command G2 receipt와 anonymous protected receipt 분리; primary/private 직접조회와 response 정보누출 거부.
6. **Current common pilot**: 빈 approved schema/roles/streams와 shared adapters로 startup·foreign role/source·receipt missing/tamper/wrong stream/direct-boot·primary private SELECT/DDL denial을 실제 증명한다. 전체 module CRUD 없어도 common scaffold를 검증할 수 있다.

A에서 Auth issuer1+Platform protected/cohort2 별도 stream을 선택하면 기존9→**12stream/8service**다. schema와 history 수는 반드시 같지 않아 실제 owner/transaction/backup/ordering으로 확정한다. B의 Insights1 stream 추가는 최소10stream/9service지만 issuer/protected 분리에 따라 증가한다. 과거8/9 PASS를 새 topology PASS로 재사용하지 않는다.

## Migration allocation과 공급

People49–71/Auth213–241/Platform238–266은 committed70c996f 뒤 **잠정 public range**다. common bootstrap이 소비하면 실제 commit high-water 뒤에서 재계산한다. module 첫 예약을 Control 공통 변경이 묵시 소비하면 충돌이 반복된다.

private insights/issuer 별도 dir/history이면 자체 V1..N allocation/schema owner를 신규 검토한다. public과 같은 번호라도 다른 history면 version 충돌은 아니지만 checkpoint path/receipt/source가 혼동되면 차단한다. 기존 migration 재번호/installed_by/checksum 편집은 금지다.

승인 common scaffold는 CONTROL_BASELINE_SYNC exact central paths/artifacts로 diverged module worktree에 공급하며 타 모듈 business commits를 유입하지 않는다. 모듈은 G4 business migration을 신규 exact reservation에 CREATE하고 Control은 같은 blob을 통합/replay한다.

## 단계와 아직 열린 결정

**G3**: complete planned payload/object-state/readwrite/source/API/event/SQL design, machine-readable config fixtures+test allocation, 실제 shared DTO/SPI/strict generated binding/fail-closed adapters/guard/scaffold, independent consumer compile, committed current common+pilot runtime/capacity 및 authoritative Gate. SYS role/stream/receipt/DS/envelope/PEP bootstrap은 여기서 OPEN이다.

**G4**: 실제46 SYS/TIM operation 및 HRM/PER/PAY CRUD/business SQL/전체 상태여정/happy·denied·duplicate·correction acceptance 실행. 그 뒤 전체 화면·메뉴·예외 Design AI handoff/G5 교체·회귀. G3를 위해 전체 G4 구현을 선행 요구하지 않는다.

**G6**: customer authority/data/adoption/cutover/live country/provider/legal integration/production privilege 승인. runtime artifact/process의 migration credential/owner DS를 제거하고 external Control/Flyway 후 runtime/read-only seal 검증만 한다. A의 JVM compromise 한계 수용 또는 B process 분리는 threat/regulatory 기준으로 재평가한다. shared dev bootstrap을 production-ready로 과장하지 않는다.

ROOT 결정 필요: A/B threat model, exact schemas/roles/stream 수, composite receipt API successor, issuer envelope/HMAC/replay/erasure/retention source, fresh/native/adopted ordering, current5-session budget. 이 note만으로 P0 CLOSED/G3 OPEN을 선언하지 않는다.

