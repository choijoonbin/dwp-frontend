# Native People target / USER 정책 조회 준비 검증

상태: AUTHOR_ONLY / UNWIRED / G3_CLOSED / COMMON_P0_OPEN. 전체 HRIS·Auth→Gateway→People PEP 완료 보고가 아니다. 기존 frozen v2 5+1·리더·SQL·build·권한등록·Gate는 수정하지 않았고, 신규 승인된 7파일만 작성했다. commit/정본 전파는 하지 않았다.

## 실제 완료 범위

People의 실제 Person/Worker/WorkRelationship/Assignment 공인 UUID·독립 4개 version과 기존 USER 조회범위 정책을 읽는 SELECT-only 준비 코드를 추가했다. 새 RBAC·principal/worker 신원 원장을 만들지 않았다. Auth string auth-* / policy-* / Gateway psc-* / psr-*는 수치로 변환하지 않는다.

- PERSON은 native tenant/person UUID/version/state만 필요하며 worker·고용·근무지·TIM·대상 Auth 계정은 필요 없다.
- EMPLOYMENT는 4개 public UUID를 명시 선택하고 실제 tenant+internal FK JOIN으로 부모를 검증한다. primary/LIMIT1·UUID equality·이메일·이름 fallback을 사용하지 않는다.
- EMPLOYMENT 날짜는 목적·operation·audience에 결속된 별도 owner date SPI가 필수다. 미설치면 조회 전 거부한다. CURRENT_DATE/UTC/개인 display zone/근무지 zone으로 대체하지 않는다. 이 SPI의 실제 회사별 날짜정책·배포는 미구현이다.
- 기존 ppl_workforce_access_policies 행의 UUID/version/window/action/field group/population을 읽는다. 대상 조직·조직 조상에 해당하는 정책 행을 먼저 선택하고 그 행의 field groups만 결합한다.
- 현재 역할 증거는 항상 별도 신뢰 Auth SPI가 필요하다. 미설치면 다른 제공자·Clock·SQL 호출 0이다. USER-only pilot에서 현재 매칭 ROLE 정책이 발견되면 UNSUPPORTED_POLICY로 거부한다. ROLE을 누락시켜 broad USER 권한으로 허용하지 않는다.
- native read는 repeatable-read/read-only 트랜잭션이며 재조회 결과를 비교한다. 초기/현재 Gateway·role·date 증거, native role/policy validTo, actor expiry를 최종 발급 시각에 재검사하고 가장 이른 expiry만 반환한다.

ReadAdmission은 현재 signed/verified PEP 권위가 아닌 로컬 raw READ 결과다. 요청 field path의 native field-group 허용 판정만 하며 급여·직급 등 실제 업무 필드 payload를 조회·투영한 기능 구현은 아니다. CurrentPeopleAuthoritySnapshot의 purpose/SoD 값을 true로 채우지 않는다.

## 실제 실행

| 단계 | 실제 case | failure / error / skip | exit | 초 |
|---|---:|---:|---:|---:|
| 최종 typed unit | 51 | 0 / 0 / 0 | 0 | 9.338066 |
| 최종 PostgreSQL 16 native | 19 | 0 / 0 / 0 | 0 | 15.125948 |
| 최종 PostgreSQL 18.4 native | 19 | 0 / 0 / 0 | 0 | 13.437451 |

고유 case는 70개(51 unit + 19 native), DB별 반복을 포함한 실행은 89회다. 각 최종 실행은 host semaphore를 독점하고 test-local --rerun / --no-daemon / --max-workers=1로 수행했다. 매 실행 370개 관련 소스의 SHA·decimal-string ns·pre/post를 대조했으며 최종 3회는 같은 전체 manifest다. 모든 실제 class/case ID, argv, UTC, exit, task outcome, gzip 원본 XML과 SHA는 [JSON 증거](./native-people-target-user-policy-pilot-author-verification-2026-09-14.json)에 있다. Python 3.12 SyntaxWarning-as-error 실행이다. Docker 미설치 skip-as-PASS는 사용하지 않았다.

실행 UTC:

- unit: 2026-09-14T08:11:38.015350+00:00 → 2026-09-14T08:11:47.354324+00:00
- PG16: 2026-09-14T08:12:43.540702+00:00 → 2026-09-14T08:12:58.667276+00:00
- PG18.4: 2026-09-14T08:13:36.370712+00:00 → 2026-09-14T08:13:49.808664+00:00

## 실패를 보존한 후 보완

첫 PG16 19/19 실패는 admission 실행 전 tenant41/DEPARTMENT 조직종류 catalog 등록 누락이었다. 실제 후속 V22 FK를 지켜 기존 설정 테이블에 정상 종류 행을 넣었다. FK·guard·DDL 완화와 fake column 추가는 없다. [최초 실패](./native-people-target-user-policy-pilot-initial-failure-2026-09-14.json)를 그대로 보존했다. 도구 출력이 preSources 중간만 잘려 수정 전 전체 현재 manifest를 재구성했고, 기록된 pre/post SHA와 동일함을 검증한 복원 내역을 명시했다.

Root 독립 source review 뒤 current refetch의 짧은 lease 3건·GROUP/PRIVILEGED native validTo 2건과 추가 role source ID/code 재사용·DIRECT nonexistent window 3건을 실제 unit에서 재현했다. 전체 51 중 8개는 expected reject 없이 반환되어 FAIL했다. [수리 전 8 FAIL](./native-people-target-user-policy-pilot-before-hardening-2026-09-14.json)을 보존한 뒤 같은 fixture/expected code를 유지하고 pilot의 최종 lease/원천 identity 검사만 보완했다. 동일 51개가 이후 통과했다.

실제 native PG의 핵심 반례는 OrgA JOB_GRADE + OrgB DIRECTORY가 OrgB JOB_GRADE를 허용하지 않는 것이다. 같은 fixture의 OrgB DIRECTORY는 허용된다. native 정책 CAS version 변경·철회·만료/미래 window, 외국 tenant 조직 참조, native target 변경/병합, 명시 날짜 inclusive end, same-day correction/overlap, 실제 조직 조상 version 및 runtime DDL/WRITE/history/private payload 접근 거부도 실행했다.

## 기존 권한체계 재사용 경계

[현재 Auth identity evidence](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationIdentityEvidenceService.java:33)의 native 서비스가 실제 auth-* truth를 소유한다. [native policy pointer](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ProductAuthorizationAuthorityAdapter.java:73)는 문자열 policy revision을 발급한다. 새 역할 증거 원천은 RoleMemberRepository의 DIRECT/GROUP/PRIVILEGED 3종을 빠뜨리지 않도록 타입을 구분하며 없는 membership/grant version은 만들지 않는다.

기존 Auth sys_admin_scoped_duty_catalog/capabilities/conflicts, com_admin_scoped_duty_assignments와 auth_effective_scoped_duties, 앱 자원집합/책임·기존 권한그룹을 재사용할 수 있다. 그러나 [ScopedAdminDutyPolicy](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-auth-server/src/main/java/com/dwp/services/auth/service/ScopedAdminDutyPolicy.java:23)의 적용은 현재 approvals.admin 중심이다. 새 HRIS duty/SoD·resource-member 등록은 별도 정확한 배포/검증을 거쳐야 하며 ADMIN/default/전체 권한 오픈으로 대신하지 않는다.

기존 [People 정책 결합](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/dwp-people-server/src/main/java/com/dwp/services/people/workforce/WorkforceAccessPolicyService.java:151)은 정책 간 조직과 필드 union을 분리한다. 새 pilot은 이를 그대로 복사하지 않고 target별 conjunction을 실행한다. 기존 서비스 코드는 이 범위에서 변경하지 않았다. People 조직/assignment tenant-composite FK는 실제 존재하며 없는 FK라고 주장하지 않는다. V34 policy→organization FK는 global UUID FK라 tenant-local 조회·반례가 추가로 필요하다.

Auth approved/active bundle와 pointer 및 기존 Gateway/People compiled PEP registry가 운영 등록 권위다. 이 pilot의 owner-config ReadOperation은 작성자 로컬 설정이며 ACTIVE bundle 승인·전체 HRIS operation 등록을 의미하지 않는다.

## 다음 최소 작업 / 아직 열린 부분

1. 실제 Auth native role SELECT-only provider + 기존 IdentityEvidenceService auth-* truth 재사용/비교. missing truth adapter는 SQL 0 거부; Auth native row/person/version/access refetch 필요. People은 com_users에 접근하지 않는다.
2. 현재 Gateway route/scope/psr·role evidence를 authenticated server invocation에 결속하는 검증 transport. X-DWP-Roles 단독·client actor/duty/purpose/field 주장·수작업 psr는 금지한다.
3. 현재 ROLE subject 정책의 exact native 평가와 owner registry의 operation/duty/field/purpose/schema/version 발행·컴파일. 기존 approvals-only duty/SoD를 HRIS operation별 명시 확장하고 미지원은 거부한다.
4. 실제 requested data projection/필드마스킹 및 command의 target refetch/CAS·동적 maker/approver SoD·원자적 재검증·분산 revoke ordering. 새 전체 G4 CRUD를 이 단계의 선행조건으로 확대하지 않는다.

위 항목은 내부 COMMON P0/개발 Gate 준비 작업이며 고객 자료/승인 G6로 돌리지 않는다. 현재 5모듈 전체 개발 Gate를 열었다고 보고하지 않는다. root의 독립 재실행/리뷰는 작성자 실행과 별도다.

## 환경 보존

테스트가 로그로 소유 확인한 PostgreSQL/Ryuk 8개 ID는 08:15:34 UTC readonly docker inspect로 모두 없어졌음을 확인했다. 제거 명령은 실행하지 않았다. 기존 dwp-postgres/redis/kafka ID·상태는 보존했고, 소유불명 다른 컨테이너를 중단·삭제하지 않았다. credential은 테스트 프로세스 메모리/JDBC 설정에만 두었고 raw password를 보고서에 저장하지 않았다.

