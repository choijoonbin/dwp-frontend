# SYS 공통 저장·권한 경계 결정안

상태: ROOT_ARCHITECTURE_DECISION_PROPOSED / G3_CLOSED. 독립 권고를 채택한 설계 입력이며, 아직 Control·runtime 구현 또는 정본 승인 증거가 아니다. 기존 8 service / 9 stream 실행 증거는 아래 추가 경계를 입증하지 않는다.

## 배포·모듈 책임

다섯 개발 책임 세션 HRM/PER/PAY/TIM/SYS를 유지한다. SYS의 새 capability 때문에 다섯 microservice를 신설하지 않는다. 기본 제품 경로는 기존 Platform 내부의 명시적인 supplemental datasource·별도 schema·LOGIN role·stream과 Auth 소유 참여 신원 발급 경계다. 이를 configuration/response/analysis repository가 서로의 DB를 조회하는 허가로 해석하지 않는다.

이 기본 경로는 SQL least privilege와 계약·업무 목적의 분리다. 같은 Platform JVM이 침해되면 private credential까지 노출될 수 있으므로 process compromise 격리나 절대적 익명성을 주장하지 않는다. 그러한 격리가 필요한 규제/배포에는 계약을 유지한 dedicated Insights extraction profile을 필수로 한다. 기능이 optional이어도 활성화된 기능의 경계를 primary DB로 완화하지 않는다.

## 추가 stream의 정확한 소유권

| service / stream key | catalog 경계 | schema / history | runtime purpose 및 소유 패키지 |
| --- | --- | --- | --- |
| platform / platform-main | 기존 Platform catalog | 기존 public / flyway_schema_history | 기존 primary runtime; 새로운 protected/issuer/insights DB 접근 없음 |
| platform / platform-hris-configuration | 같은 Platform catalog | hris_configuration / flyway_hris_configuration_history | 별도 configuration DS·role; hrisconfiguration; 새 HRIS 설정, 폼, metric/AI 정의·version, 승인·job/connector 메타 |
| platform / platform-hris-protected | 같은 Platform catalog | hris_listening_protected / flyway_hris_listening_protected_history | 별도 admission DS·role; hrisinsights.listening.admission; 응답·답변·token consumption·protected receipt 및 자기 admission snapshot |
| platform / platform-hris-insights | 같은 Platform catalog | hris_insights / flyway_hris_insights_history | 서로 다른 INSIGHTS_QUERY(readOnly·SELECT-only)와 INSIGHTS_EXECUTION_WRITE(정확한 owner DML) DS·LOGIN role; hrisinsights; 허용 cohort·metric projection·lineage·export/AI assistance provenance |
| auth / auth-hris-participation-issuer | 기존 Auth catalog, Platform과 별도 | hris_participation_issuer / flyway_hris_participation_issuer_history | 별도 issuer DS·role; productaccess.listeningissuer; 인증된 eligibility·신원→무작위 token의 최소 발급 기록, 응답 접근 없음 |

기존 9 stream에 4개가 추가되므로 이 경로의 현재 설계 topology는 8 service / 13 stream이다. performance는 기존 People 독립 stream 그대로다. 새 schema는 아직 존재한다고 가정하지 않는다. 테이블 CREATE는 G4 owner 작업이며, 빈 승인 schema/role/stream·receipt·guard 및 공유 포트 pilot은 G3 공통 작업이다.

role의 문자열은 tenant 업무 설정이 아니라 Control 배포 manifest의 별도 deployment identifier다. 각 stream에 서로 다른 migration authority와 purpose-bound runtime LOGIN principal을 선언한다. 13 stream은 13 runtime role을 뜻하지 않는다. Insights의 조회와 projection/export/AI worker 쓰기는 별도 principal·qualifier·readOnly·object allowlist로 검증한다. 현재 exact topology는 14 runtime purpose를 선언하며 query를 writer로 바꾸는 권한 완화는 금지한다. role attribute는 NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS이고 elevated role membership은 없다. app는 schema/role/extension을 생성하거나 SET ROLE하지 않는다. runtime이 owner·migration principal·foreign protected principal과 같으면 시작을 거부한다. 기존 People public/performance의 shared principal 실행 증거는 보존하지만 이 distinct-principal composite의 증거로 재사용하지 않는다. 새 role 분리 bootstrap는 G3 공통 작업이다.

capability dependency는 별도로 명시한다. PEOPLE_ANALYTICS와 GOVERNED_AI는 configuration+insights만 요구하며 listening/issuer 설치를 강제하지 않는다. EMPLOYEE_LISTENING을 활성화할 때 configuration+protected+issuer+insights가 함께 필요하고 protected/issuer는 pair다. configuration만 사용하는 배포도 허용한다. 서로 무관한 optional capability를 강제 설치하도록 만드는 stream 의존성은 금지한다.

schema owner/CREATE/DDL/history DML은 external Control migration authority만 가진다. production app에는 migration DS/credential을 배선하지 않는다. 외부 Control native authority inspection과 app runtime-only startup proof/guard를 분리하며 [startup 권한 경계 보완안](runtime-only-startup-authority-boundary.proposal.v1.md)의 아직 미구현된 seal/freshness/deployment fence를 G3 OPEN으로 관리한다. 필요한 runtime DML/SELECT 또는 정확한 routine EXECUTE만 승인한다. blanket ALL TABLES/ALL FUNCTIONS, PUBLIC EXECUTE, primary-to-private role membership, 사용자 임의 SQL 및 원천 서비스 DB join은 금지한다. retention/erase는 원자 duty·legal hold·정책 version이 결합된 정확한 owner command이며 일반 감사 append-only guard를 우회하지 않는다.

## 기존 scalar receipt와의 호환

기존 migration-control-run-receipt-v2와 8/9 guard는 역사적·현행 scalar 서비스 검증으로 보존한다. 새 stream authority를 그 receipt에 이름만 덧붙이지 않는다. versioned composite manifest/receipt는 다음 필드를 stream별 exact binding한다.

- service, streamKey, catalog, schemas, historyTable, migrationLocations, migrationPrincipal, runtimePrincipals와 각 purpose/allowlist, topologyVersion 및 Control reference.
- migration history rank/count/digest, definition/ACL/ownership inventory digest, native/adoption provenance, bootstrap ordering 및 이전 composite receipt digest.
- 외부 deployment의 기대 digest와 실제 DS의 current_database/current_user/session_user, connection qualifier·schema/search_path/readOnly 설정 및 runtime ACL/ownership.

primary receipt가 있어도 enabled supplemental DS의 receipt가 없거나 다른 stream/role/catalog/source/Control revision이면 전체 capability 시작을 거부한다. disabled capability는 supplemental DS를 열지 않으며 UI/API가 configuration-required/unavailable로 닫힌다. scalar primary credential이나 DB_USERNAME을 private DS의 fallback으로 사용하지 않는다. feature 활성화 상태는 DB 경계를 우회하는 런타임 스위치가 아니다.

## 익명 수집에서 local FK가 참조하는 실제 객체

configuration의 survey local BIGINT를 protected response에 복사하거나 cross-schema FK로 참조하지 않는다. protected schema는 자기 `sys_hris_listening_admission_versions`를 소유한다. 이 객체는 공개 survey UUID와 명시적인 survey/form/privacy/retention revision·digest, typed 질문 정의·허용 answer kind/bounds, 고정 opensAt/closesAt 및 admission fence만 포함하는 검증된 immutable owner snapshot이다. audience의 실제 principal/worker 명단·issuer trace/IP는 포함하지 않는다.

protected response/token/receipt의 tenant-bound local FK는 이 admission version의 local BIGINT를 참조한다. version된 공개 survey ID는 configuration port로 검증하고 서로 다른 stream의 local ID를 공유하지 않는다. analysis에도 response local ID/token/alias를 보내지 않는다. 기존 proposal의 response→configuration survey FK는 이 경계에 맞춰 successor에서 교체해야 하며 현재 정본을 승인한 것으로 처리하지 않는다.

## 게시·조기 종료와 수집의 원자성

실제 참여 admission의 원천은 protected admission owner다. configuration의 publish/close는 서명된 내부 control port에 정확한 survey/form/version/digest/idempotency를 보내며, 원자 admission 설치/종료 결과를 refetch한 후에만 metadata의 완료 상태를 확정한다. 네트워크 결과 불명은 RESULT_UNKNOWN receipt와 재조회·동일 key 재시도로 복구한다. configuration 상태만 먼저 CLOSED로 쓰고 늦게 응답 수집을 막는 방식은 금지한다.

submit과 early-close는 같은 protected admission lock/fence에서 직렬화한다. submit은 승인된 admission version, owner clock의 window, token/form/consent 및 revocation을 재검증하고 답변·token 소비·protected receipt를 같은 transaction에 commit한다. close의 fence commit 뒤에는 새 제출이 불가하다. erasure 전 동일 token·동일 payload는 frozen replay window까지 같은 ACCEPTED receipt를 돌려주고 다른 payload는 거부한다. governed erasure 후에는 payload HMAC과 답변 content key까지 제거하므로 같은 consumed token에 대한 모든 payload는 동일 ERASED receipt만 돌려주며 답변 비교 oracle이나 새 응답을 생성하지 않는다. 일반 principal-bound command receipt는 이 anonymous route에 적용하지 않는다.

ingestion에서 analysis로는 allowlisted cohort 계산 port의 privacy-safe aggregate 결과만 전달한다. ingestion의 batch가 raw response를 public event/topic에 내보내거나 analysis runtime에 protected schema SELECT를 주지 않는다. cohort threshold·차분 재식별 방지·허용 dimension·suppression/adequacy category는 version된 정책과 fixed query/epoch budget으로 적용한다. DBA·역할 공모·network timing·식별 free text의 잔여 위험을 명시한다.

## G3에서 실제 닫을 공통 작업

1. machine-readable composite authority/receipt successor와 기존 scalar 호환·거부 조건, deployment manifest 및 Control bootstrap를 작성·독립 검토한다.
2. qualifier별 DS/guard/receipt/startup 배선과 빈 schema/role/stream pilot을 구현한다. private role reuse·missing/tampered receipt·primary private SELECT/DDL·foreign history 접근 거부를 실제 테스트한다.
3. signed issuer envelope(신원/trace 없음), immutable admission control/refetch, protected replay/erase 및 cohort aggregate DTO/SPI를 게시하고 producer/consumer compile·fail-closed adapter를 검증한다.
4. 새 stream의 V1..N 예약과 공통 scaffold 소비를 기존 public 예약과 분리하고, 현재 5개 paired worktree·instruction·baseline·runtime evidence를 새 topology로 다시 검증한다.

새 schema/domain migration의 전체 업무 CRUD와 survey/analytics/AI 사용자 여정 실제 수용은 G4다. 고객의 실제 신원 authority/bootstrap, country/provider 법정/계약 및 process-isolation 배포 승인은 G6다. G3 공통 경계와 exact 설계의 누락을 G4/G6로 미루지 않는다.
