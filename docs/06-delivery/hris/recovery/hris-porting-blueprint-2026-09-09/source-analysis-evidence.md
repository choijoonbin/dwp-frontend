# 소스 분석 근거 및 제약

## 1. 분석 방법

이번 결과는 저장소 정적 분석, route/controller/entity 기계 추출, DWP 현행 schema·권한·페이지 구조 대조, 대표 화면 이미지 확인을 결합했다. BENSK와 ADDSK는 제품 이관 범위에서 제외했다. 다만 raw route 대장에 혼입된 BENSK 2행과 공통 모듈 내부 고객 표식은 누락·오염 증거를 보존하기 위해 삭제하지 않고 격리 판정한다.

### 신뢰도 표기

| 등급 | 의미 |
|---|---|
| 높음 | 코드/DDL에 명시돼 있고 복수 방식으로 확인 |
| 중간 | 이름·구조·호출관계에서 강하게 추론되나 실행 확인 필요 |
| 낮음/미확정 | 운영 DB, 사설 JAR, 외부 시스템 또는 업무 담당자 확인 필요 |

## 2. 산출물 재현 범위

| 인벤토리 | 행 수 | 포함 | 주의 |
|---|---:|---|---|
| `skkf-route-inventory.csv` | 886 | HRM/PER/PAY/TIM/SYS/YEA raw route 선언 | 실제 표시 메뉴 수가 아니며 HRM BENSK route 2건 포함 |
| `skkf-backend-controller-inventory.csv` | 825 | HRM/PER/PAY/TIM/SYS `*Controller.java` 후보 | 표준 controller annotation 후보 820; runtime bean 수는 사설 annotation/JAR 확인 필요 |
| `skkf-entity-table-inventory.csv` | 558 | JPA entity row와 명시 table | 모듈 간 중복 제거 후 고유 table name 536; 모듈별 고유 합계 556 |

라우트 분포는 HRM raw 193(이 중 BENSK benefit 2건 선제외), PER 121, PAY 189, TIM 196, SYS 153, YEA 34다. `*Controller.java` 후보 분포는 HRM 246, PER 126, PAY 199, TIM 232, SYS 22다. 이 중 표준 `@Controller/@RestController` 후보는 HRM 246, PER 124, PAY 196, TIM 232, SYS 22로 820개, PAY에서 사설 `@RestInitController`만 확인되는 후보는 2개, class-level controller annotation이 없는 후보는 3개다. 사설 JAR 확인 전 runtime controller 수는 미확정이다. 엔티티 분포는 HRM 144, PER 102, PAY 158, TIM 140, SYS 14다.

기계 추출에는 다음이 포함될 수 있다.

- 상세/등록/팝업 route
- 동적 segment와 alias
- 퍼블리싱/예제 route
- 서비스별 복제된 공통 controller/entity
- 이름은 다르지만 같은 업무를 처리하는 항목

따라서 수량은 규모 파악과 누락 방지용이지 목표 화면/API/테이블 개수가 아니다.

## 3. SKKF 프론트엔드 근거

### 기술 구조 — 신뢰도 높음

- monorepo는 Lerna/Yarn script를 사용한다. 근거 파일의 위치·해시는 [정적 manifest inventory](./g0/source-security-evidence/manifest-inventory.csv)에 값 비노출 형태로 고정했다.
- Vue 2.6.11과 Vue CLI 4.5.x를 사용한다. 직접 의존성 선언은 정적 inventory이며 DWP 반입 승인이 아니다.
- root는 `single-spa`와 `single-spa-layout`으로 HRM/PER/PAY/TIM/SYS/YEA를 조합한다: `packages/root/package.json`, `packages/root/src/peopleworx-root.js`, `packages/root/src/microfrontend-layout.html`
- 핵심 package에서 `*.spec.js`, `*.test.js`가 확인되지 않았다. 이것은 정적 source tree 기준이며 외부 테스트 저장소 존재 가능성은 남는다.

### 메뉴 구조 — 신뢰도 중간

SYS router와 portal router에는 테넌트/회사, 사용자, 메뉴, 프로그램, 역할, 다국어, 사전, 모듈, URI, 로그인/API/메뉴/파일/메일/알림/반출 로그, notice/board/guide, template, job 이력, 공통코드, business unit, workplace, calendar, 조직/직원, 결재선, 양식, 대량업로드, FTP, 예외 이력 등이 보인다.

그러나 앱은 `/sys/auth/menu` 호출로 메뉴를 동적으로 받아 store에 적재한다. 소스의 route 목록은 가능한 화면을 보여주지만 아래는 운영 DB 없이는 확정할 수 없다.

- 역할별 실제 1·2·3차 메뉴 계층과 순서
- 메뉴가 참조하는 program/URI와 숨김 여부
- 회사별 메뉴 override
- 현재 사용 중인 route와 orphan route
- 사용자별 즐겨찾기/개인메뉴

**필수 추가 자료:** `menu`, `program`, `role-menu`, `user-role`, `user-menu`, `URI/resource`의 운영 export와 최근 90일 사용 로그. 개인정보를 제거한 ID/관계/상태/순서만으로 충분하다.

### 프론트 보안·품질 이관 금지 패턴 — 신뢰도 높음(정적 존재)

| 패턴 | 정적 근거 요약 | 목표 처리 |
|---|---|---|
| URL/query의 token 처리와 로그 | SYS router와 HRM sub-main 경로 | OIDC code+PKCE/secure cookie, URL 즉시 정리, log redaction |
| 같은 path/query 또는 비운영 조건에서 guard 우회 가능 분기 | SYS 공통 router | 프론트 guard는 UX만 담당, 서버 PEP 항상 강제 |
| sanitizer 확인 없이 다수 `v-html` | HRM/PAY/PER/TIM/SYS/common에 존재 | React 기본 escaping, allowlist sanitizer와 CSP, rich-text trust boundary |
| i18n 갱신 시 전체 session/local storage clear | 모듈별 i18n store | 제품 namespace key만 versioned invalidation |
| 고정 최소폭/팝업 grid | TIM calendar, PAY popup 등 | DWP 반응형 archetype으로 재설계 |
| route name/path 중복과 old/copy/deprecated 화면 | 전 모듈 | trace register에서 `RETIRE`, canonical route 계약만 유지 |

이는 Vue 화면을 장기 wrapper로 재호스팅하지 않고 업무 흐름만 재구현해야 하는 추가 근거다.

### 업무 범위 — 신뢰도 중간~높음

| 모듈 | 코드로 확인된 주 기능군 |
|---|---|
| HRM | 사람/직원, 조직/사업장, 발령, 계약, 증명, 가족/급여계약 변경요청, 비용센터, 서약, 퇴직/복직 |
| TIM | 기준/근무계획, 출퇴근, 일/월마감, 연장근무 신청·승인, 지각/조퇴, 유연근무, 연차발생/사용, 휴가/모성, 추천휴가, 출입기록 |
| PAY | 급여그룹/일정/항목/산식/계약/세율, 대상/입력/계산/마감/결과, 소급, 계좌이체, 보험, 퇴직, 명세, 연말정산 |
| PER | MBO/목표, 주기/일정, 평가기준/표/군/대상/평가자, 다면, 자기·평가자 수행, 피드백, 보정, 면담, 모니터링/결과, 설문 |
| SYS | tenant/user/menu/role/code/i18n/template/job/log/file/form/integration/approval 공통기능 |

이 기능명은 route/component/package 명칭으로 분류한 1차 taxonomy다. 실제 계산식과 승인 전이의 정답 여부는 실행 및 SME 검증이 필요하다.

## 4. SKKF 백엔드 근거

### 기술 구조 — 신뢰도 높음

- HRM/PER/PAY/TIM/SYS는 Spring Boot `2.2.5.RELEASE`, Java source compatibility `1.8`을 사용한다.
- JPA, Redis, QueryDSL, Spring Security, OpenFeign/Config, Springfox 2.9.2, POI 4.1.2 등이 반복 선언돼 있다.
- 일부에는 CXF 3.1.6, JSch 0.1.55, SOAP/SFTP와 Azure 관련 설정이 있다.
- `hr-common-*`, `worx-common-*`, `worx-system-*` 등 repository 밖의 사설 JAR에 의존하며 모듈별 버전도 다르다.
- Java 파일 수는 HRM 1,867, PER 1,544, PAY 2,211, TIM 2,394, SYS 243으로 총 8,259개다.
- source tree의 테스트는 HRM/PER/PAY/TIM 각각 Java 파일 1개 수준이고 모두 활성 `@Test`가 주석 처리돼 있다. SYS 4개 test Java에도 활성 `@Test`는 확인되지 않았다.

### 중복 공통 구현 — 신뢰도 높음

`app/com` 아래 Java 파일만 HRM 542, PER 181, PAY 216, TIM 222개가 있고, module code·메일·조직·인물 관련 동명/유사 클래스가 반복된다. 명시 테이블 중 `com_employee`, `com_employee_state`, `com_organization`, `com_organization_all`은 5개 모듈에, `com_appointment`는 4개 모듈에 나타난다.

이는 SKKF 배포 경계를 DWP의 domain 경계로 그대로 사용할 수 없다는 근거다. DWP에서는 사람/조직 SoR과 공통 플랫폼 서비스를 한 번만 사용해야 한다.

### Persistence·API 결합도 — 신뢰도 높음

| 항목 | 정적 결과 | 해석 |
|---|---:|---|
| 단일 `@Id` entity | 558/558 | composite tenant key와 낙관잠금이 모델에 없음 |
| `@EmbeddedId`, `@IdClass`, `@Version` | 각 0 | tenant ownership과 lost-update 방어를 별도 입증할 수 없음 |
| 실 `ManyToOne` | 203 | 일부 관계만 ORM FK로 표현 |
| entity 내 `private Long *Id` 선언 후보 | 약 1,951 | PK와 단순 값도 포함하므로 전부 논리 참조로 단정하지 않음; association/FK 재분류 필요 |
| `findById` 호출 | HRM 403, PER 260, PAY 219, TIM 247, SYS 7 | tenant/company 소유 검증 누락 가능성 검토 필요 |
| `deleteById` 호출 | HRM 11, PER 42, PAY 50, TIM 36, SYS 1 | 이력/원장 데이터 물리삭제 여부 검토 필요 |
| InitController | HRM 115, PER 52, PAY 67, TIM 94, SYS 6 | 화면별 콤보·코드·권한 조립 API가 과도함 |
| native query 탐지 파일 | PAY 5, TIM 11, SYS 1 | tenant predicate/parameter binding 집중 검토 |
| 운영 schema migration | Flyway/Liquibase 미확인 | 실제 DDL/FK/index/trigger는 운영 export 필요 |

PAY가 TIM의 `tim_wocr_m`을 직접 매핑·CRUD하고, TIM 등 각 모듈이 HRM의 공통 사원/조직을 전체삭제 후 재적재하는 경로가 확인된다. 목표 DWP에서는 다른 context의 entity/repository/table 직접 쓰기를 CI와 DB 권한으로 차단하고 outbox/inbox projection을 사용한다.

### 시간 표현과 동시성 — 신뢰도 높음

- entity의 `String` 날짜 필드가 약 800개이고 `LocalDate`는 확인되지 않았다.
- `99991231` 센티널 종료일이 HRM/PAY/TIM에 반복된다.
- 같은 업무키의 유효기간 겹침을 막는 exclusion constraint는 source에서 확인되지 않았다.
- PAY에서 parallel stream 96건, `ThreadLocalUtil` 참조 392건이 탐지됐고 공유 `ArrayList`에 병렬 add하는 대표 경로가 있다.
- 주요 서비스는 `@Transactional`을 다수 사용하지만 명시 isolation/`rollbackFor`, entity `@Version`은 확인되지 않았다.
- 개인정보 분리보관에는 다중 DB chained transaction 경로가 있어 부분 commit 가능성을 검증해야 한다.

DWP에서는 문자열 날짜를 `DATE/TIMESTAMPTZ`로 정규화하고 `[valid_from, valid_to)`, 필요 시 `effective_sequence`, 기록시각을 가진 bitemporal 모델과 기간중복 constraint를 사용한다. 계산은 worker/pay-group 단위의 결정적 partition, bounded executor, 고정 반올림으로 수행하고 같은 input/rule/engine version은 동일 결과를 내야 한다.

### Tenant와 유효일 — 신뢰도 중간

다수 entity에서 `co_id`, `bu_id`, `bizplc_id`, `begin_dt`, `end_dt`가 확인돼 회사 계층과 유효일 개념이 존재한다. 동시에 명시적인 tenant/company 식별자가 source에 바로 보이지 않는 entity도 상당수 있다. BaseEntity 상속이나 관계를 통해 제공될 수 있어 정적 검색만으로 격리 결함을 단정하지 않는다.

다만 DWP 이관 시에는 모든 query가 tenant context를 암묵적으로 믿지 않도록 composite tenant FK, repository guard, negative test, 필요 시 DB RLS를 적용해야 한다.

### 보안·정합성 P0 — 정적 발견, 실행 검증 필요

| 발견 | 대표 위치/형태 | 위험 | DWP 처리 |
|---|---|---|---|
| 환경설정 파일에 literal credential-like 값 존재 | [값 비노출 현재-tree finding 대장](./g0/source-security-evidence/current-findings.csv)에 위치·규칙 ID만 기록; 값과 유효성은 저장하지 않았고 미확인 | 유효한 값이면 저장소 유출과 재사용 | Security가 원 시스템에서 유효성을 확인하고 필요 시 회전·폐기; DWP는 Vault/KMS ref만 허용 |
| 안전하지 않은 암호모드 설정 | 정제 분석 뷰에서 legacy cipher mode와 사설 converter 결합이 확인됨; [artifact 접근 판정](./g0/source-security-evidence/coverage-sanitized-access-register.csv)으로 출처를 추적 | 결정적 패턴 노출·무결성 부재 가능성; converter 구현은 사설 JAR 확인 필요 | DWP envelope encryption/AEAD와 key version으로 재암호화 |
| 저장된 급여식의 동적 표현식 평가 | 정제 분석 뷰의 급여 계산 흐름에서 동적 expression 평가가 확인됨; 직접 raw source link는 배포하지 않음 | 입력 도달성에 따라 메서드·타입 접근이 가능한 코드실행 위험 | whitelist AST/typed DSL, sandbox, 시간·메모리 제한, 승인된 함수만 |
| SYS dictionary의 동적/native SQL | 해당 controller coverage는 `SECURITY_BLOCKED_UNKNOWN`; [접근 판정 대장](./g0/source-security-evidence/coverage-sanitized-access-register.csv)과 값 비노출 finding만 G1에 제공 | 권한우회/주입/임의 데이터 접근 | 원 구현을 이식하지 않고 허용 dataset/query template registry, parameter binding, 강제 tenant predicate, read replica/timeout으로 대체 |
| method 권한 annotation 미확인 | 대상 source에서 `@PreAuthorize/@Secured/@RolesAllowed` 0건 | 사설 JAR/filter 의존, endpoint 권한 불투명 | DWP Gateway+service PEP, resource/action/scope/field fail-closed |
| JPA optimistic `@Version` 미확인 | 대상 source 정적 검색 0건 | lost update, 마감/승인 경합 | aggregate version/expected version, 상태전이 CAS |
| 물리 삭제 후 계산결과 재생성 경로 | PAY/TIM 정제 분석 뷰에서 delete→recalculate→save와 별도 batch 분기가 확인됨; 정확한 허용 경로는 [artifact 접근 판정](./g0/source-security-evidence/coverage-sanitized-access-register.csv)을 따른다 | 결과 계보·감사 증적 손실 가능성; batch 분기의 별도 통제는 미확인 | append-only run/attempt/result, reversal/correction |
| tenant 조건 없는 ID 조회 가능성 | 여러 repository/service의 단일 `findById` 패턴 | ID 추측 시 교차 tenant 접근 | `(tenant_id, public_id)` 조회를 표준화, raw repository 제한 |
| runtime route가 auth/data-auth false로 등록될 수 있음 | PAY 정제 분석 뷰의 batch route 등록 흐름에서 확인; raw source는 G1에 직접 노출하지 않음 | 누락된 `/pay` route의 가변·불명확한 권한 강제 | 빌드타임 immutable PEP registry와 default deny |
| 타입 안전하지 않은 job/프로그램 실행 모델 | PAY 정제 분석 뷰에서 metadata 기반 Spring bean/public method 선택 흐름이 확인됨 | 작업 catalog가 지정한 메서드 실행과 비활성 job 실행 위험; catalog 변경권한의 도달성은 미확인 | 등록된 job type/handler ID만 실행, schema와 권한·서명 검증 |
| 운영 profile의 SQL 원문 로깅 가능성 | HRM 정제 분석 뷰에서 SQL formatter/logging 구성이 확인됨 | 인사·급여 PII가 로그에 포함될 가능성 | production SQL parameter log 금지와 field-aware redaction |

배치는 5개 모듈 모두 `@Scheduled`가 0건이며, 외부 agent가 module batch endpoint를 호출하고 SYS 작업 메타데이터가 지정한 Spring bean/public method를 reflection으로 실행하는 구조다. 실제 metadata 저장소, 일정·파라미터·활성상태는 운영환경 확인 전 확정할 수 없다. 목표 job은 allowlist handler registry, lease, checkpoint, idempotency key, bounded retry, DLQ, execution receipt를 가져야 한다.

위 발견은 레거시 시스템이 현재 침해됐다는 뜻이 아니다. **동일 구현을 DWP로 가져오면 안 된다는 설계 입력**이다. 특히 비밀값 내용은 이 문서에 기록하지 않았다. method annotation 0건, `findById` 후보, `@Version` 0건은 사설 filter/JAR와 운영 DDL이 없어 실제 노출을 확정한 취약점이 아니라 완전 이관 전 P0 검증 게이트다.

### 라이선스/권리 — 신뢰도 높음(헤더), 법적 결론 미확정

다수 source header에 Kolon Benit의 권리 표기와 사전 승인 없는 복사·배포·사용 금지 문구가 있다. 각 서비스에 OSS notice PDF는 있으나 분석 범위의 최상위에서 SKKF 전체 소스 재사용을 허용하는 라이선스 문서는 확인하지 못했다.

이는 권리가 없다는 법적 판단이 아니다. 계약·양도·프로젝트 산출물 조항이 별도로 있을 수 있다. 다만 확인 전에는 다음 경계를 적용해야 한다.

1. 접근 가능한 분석팀과 구현팀을 필요에 따라 분리
2. route/API/입출력/결정표/테스트로 행위를 명세
3. 코드와 주석을 직접 복사하지 않고 DWP 표준으로 독립 구현
4. 도입 라이브러리의 SBOM과 notice 의무 검토
5. 승인 문서가 확보되면 허용 범위만 추적 가능하게 사용

## 5. DWP 현행 근거

### 재사용할 기반 — 신뢰도 높음

| 기반 | 대표 근거 |
|---|---|
| 제품 surface | `apps/dwp/src/features/hcm/hcm-product-manifest.ts`의 personal/team/operations/management |
| 메뉴 권한 | `hcm-navigation.ts`의 audience/resource/permission/scope |
| Core HR schema | People V1의 person/name/private/identifier/legal employer/org/job/location/position/worker/work relationship/assignment |
| 조직 유효일 | V6, V9, V13 등 org graph/scenario/position 관계 |
| 연계 | V2/V31 connector, mapping, receipt, cursor, reconciliation |
| 접근/반출 | workforce access와 controlled export migration |
| 근태/휴가 기초 | V38 schedule/time card/entry/exception, leave plan/enrollment/balance/request |
| 급여/성과 기초 | V38 pay cycle/statement reference, journey/goal/learning |

### 중요한 공백/충돌 — 신뢰도 높음

1. DWP 공식 현행 설계는 외부 HRIS/Payroll을 원장으로 두는 projection 성격이 강하다. 사용자가 요청한 `완전 이관`에서 DWP가 자체 급여 SoR이 되려면 별도 ADR과 운영 책임 승인이 필요하다.
2. `POOL/BRIDGE/SILO` tenant 메타모델은 있으나 현재 People runtime에서 schema/DB routing과 RLS 구현은 확인되지 않았다. 엔터프라이즈 격리는 단순 `tenant_id` query 이상으로 강화해야 한다.
3. People 내부 근태·휴가 승인 상태와 DWP Approval 서비스가 아직 단일 계약으로 연결되지 않았다. SKKF 승인모델을 추가 복제하면 삼중 모델이 된다.
4. 공통 domain-event outbox가 있어도 핵심 HR 변경 event producer와 소비자 계약을 완성해야 한다.
5. 일부 개인 HCM query cache key는 tenant/actor/scope/decision revision이 들어간 governed key로 통일되지 않았다. 급여/민감정보 이관 전 수정이 필요하다.
6. runtime connector adapter와 secret resolver가 제한적이므로 실제 ERP/은행/세무/타각 연계의 실행 기반을 보강해야 한다.
7. 현행 감사 sanitizer만으로는 휴가 사유, 급여, 계좌, 세무 등 HR PII payload의 안전한 projection을 보장하기 어렵다.
8. DWP Auth에는 기술 canonical `APP.HCM`과 compatibility alias `APP.HRIS`, 디렉터리 그룹, 그룹-역할 할당, resource/permission, grant와 역할 충돌 기반이 있다. 현행 대상집단·필드 접근정책은 People가 소유한다. 목표에서는 People가 workforce 정책을 확장하고 분리될 Time/Payroll owner가 자기 도메인 scope를 최종 검증한다. 따라서 SKKF 권한 테이블은 이관하지 않는다.
9. 기존 `TIME_ADMIN`, `ABSENCE_ADMIN`, `PAYROLL_ADMIN`, `TALENT_ADMIN`은 한 도메인 안에서 `VIEW/CREATE/UPDATE/APPROVE/MANAGE`가 넓게 묶여 있고 group assignable이 꺼져 있다. 반면 앱 관리자 preset은 group principal, resource set, 승인, 만료, review, SoD를 지원한다.
10. `HCM_PRESET_CATALOG_PENDING`이 DRAFT 상태로 남아 있어 HRIS 대상집단·필드 결합형 권한이 아직 완성되지 않았음이 확인된다. app-admin preset의 lifecycle 패턴은 재사용하되, 업무권한은 제품 중립 access-package aggregate로 일반화하는 것이 명확한 고도화 항목이다.
11. 현재 HRIS 앱 resource는 workspace member 전체에 초기 grant되고, HCM operations/management capability는 `requiresProductEntitlement=false`인 경로가 있다. 목표에서는 모든 HRIS surface에 앱 entitlement 교집합을 강제하고 `전체 활성 직원/지정 그룹` 정책을 선택하게 한다.
12. `com_group_role_assignments`에는 scope 컬럼이 있지만 세션 권한 산출은 `TENANT` scope만 포함하는 경로가 있어, 관리자 화면의 effective 권한과 런타임 의미가 달라질 수 있다. 법인·급여그룹·조직범위는 owner-service의 opaque scope policy까지 보존하도록 고도화해야 한다.
13. 과거 `com_role_hierarchy`와 범용 SoD 테이블은 후속 migration에서 제거됐다. HRIS는 순환 가능한 역할 상속을 되살리지 않고 평면 atomic duty를 versioned access package로 조합해야 한다.

## 6. 운영 자료를 확보해야 확정할 항목

| 자료 | 목적 | 최소 형태 |
|---|---|---|
| 메뉴/프로그램/역할 DB export | 실제 사용자·관리자 메뉴와 권한 확정 | ID, parent, 순서, route, role, active; PII 제거 |
| 배치/job catalog와 최근 실행 이력 | 마감·급여·연계 숨은 기능 식별 | job type, schedule, input/output, SLA, 실패율 |
| 외부 interface 목록 | ERP/은행/세무/보험/타각 계약 | endpoint/file schema, direction, cadence, owner |
| 데이터 사전·DDL·index/constraint | JPA 밖 실제 schema와 native SQL 확인 | schema-only dump 가능 |
| 대표 익명 golden data | 급여/근태/휴가 결과 검증 | 최소 3개 회사/급여군/근무제, edge case 포함 |
| 운영 사용 로그 | dead route와 핵심 경로 구분 | route/program, role, 빈도; 사용자 ID 해시 |
| 규정/사규와 계산 근거 | 국가팩/테넌트 설정 분류 | 문서 ID, 시행일, owner, 승인본 |
| 소스 사용권/OSS 자료 | 구현 방식 확정 | 계약 조항, 승인서, SBOM/notice |

## 7. 분석 한계

- 운영 DB와 외부 서비스가 없으므로 실제 메뉴 권한, batch 결과, 데이터 품질은 실행 검증하지 않았다.
- 사설 JAR 안의 인증/tenant 처리/공통 예외는 역추출 범위 밖이다.
- 파일명·클래스명 기반 기능 분류는 업무용어가 잘못 쓰인 부분을 포함할 수 있다.
- entity 수는 persistence 구조를 보여주지만 view, procedure, trigger, DB job은 DDL 없이는 누락될 수 있다.
- 법정 정확성은 코드 리뷰만으로 검증할 수 없다. 효력일별 규정과 실제 신고/지급 결과를 HR·노무·세무 전문가가 대사해야 한다.

따라서 이번 산출물은 구현을 시작할 수 있는 목표 설계와 누락 방지 기준이며, 운영 DB/행위 테스트가 결합될 때 최종 scope baseline이 된다.
