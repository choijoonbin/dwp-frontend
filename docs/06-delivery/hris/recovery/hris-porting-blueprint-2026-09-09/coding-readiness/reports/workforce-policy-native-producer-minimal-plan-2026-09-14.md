# 기존 Workforce 정책을 재사용하는 최소 HRIS READ 연결 계획

상태: SOURCE_BASED_PLAN / 미게시 / G3_CLOSED. 신규 RBAC·신원 원장·전체 G4 CRUD 선행을 요구하지 않는다. 현재 v3와 V50은 작성·회귀 검증 중이며, 이 문서는 배선 또는 업무 승인 증거가 아니다.

## 현행 소유권과 보존할 의미

- Auth가 principal·tenant·current 권한/역할 및 opaque `auth-*`, `policy-*` 권위를 소유한다. People가 실제 person/worker/relationship/assignment 및 각각의 native version을 소유한다. actor Auth rowVersion/accessRevision 2개와 target People version 4개를 합치거나 해시→long으로 변환하지 않는다.
- `WorkforceAccessPolicyService.java:135–146`: 현재 활성 USER 정책이 하나라도 있으면 ROLE 정책을 전부 제외한다. 이 우선순위는 개인별 제한 의도일 수 있으므로 삭제하면 안 된다. READ 필터보다 USER 우선순위를 먼저 적용하는 의미도 보존한다(활성 USER EXPORT만 있어도 broad ROLE READ로 우회 금지).
- 같은 파일 `:63–65`: 기존 생성 API의 DIRECTORY 필수 요건을 보존한다. JOB_GRADE-only native fixture는 DB 관계 검사 예시이지 실제 API 생성 지원 증거가 아니다. 실제 생산자 회귀는 DIRECTORY+JOB_GRADE를 사용한다.
- 같은 파일 `:147–163`, `Decision:293–315`: 모든 정책의 조직 집합과 필드 집합을 독립적으로 합치는 기존 결과는 target별 조직∧필드를 나타내지 못한다. 이 `Decision.field()`를 새 HRIS 데이터 투영 권위로 재사용하지 않는다. 기존 Decision API/기존 소비자는 이번 준비 단계에서 변경하지 않는다.
- `WorkforceAccessPolicyRepository.java:66–94`의 tenant/subject/window 필터와 `resolveForShare`의 네이티브 policy row 잠금·기존 version을 재사용한다. 새로운 policy ledger/counter를 만들지 않는다.

## 코드 호환성

- People 역사 `V34__add_workforce_access_boundaries.sql:24–26`는 ROLE 2–80자 대문자/밑줄만 허용한다. Auth `IdentityAdminDtos.ReplaceUserRolesRequest:73`는 한 글자·점·하이픈 포함 1–50자를 허용하고 `IdentityAdminService:429–430`에서 ROOT 대문자 정규화한다.
- 신규 People V50은 기존 ROLE80 문법 OR native ROLE50 문법만 확장한다. 기존 USER·타입·길이·정책행·window/version·인덱스·FK·ACL은 바꾸지 않는다. 기존 legacy80이 현재 native Auth 역할로 존재한다고 추정하지 않는다.
- 새 native owner 쓰기는 1–50자 current Auth vocabulary 및 해당 tenant의 실제 TENANT role/state/version owner 증거를 검사한다. storage의 legacy80 호환은 신규 grant 허가가 아니다. 기존 legacy 행은 조회/철회 가능하게 보존한다.

## 최소 순서와 예상 코드 경계(별도 승인 전 미구현)

1. 완료 중인 native 호환 회귀: 실제49→50, 기존 행 JSON 전체/versions/windows·다른 제약/인덱스 불변, native 문법 신규 쓰기, 잘못된 civil role 문법/USER0 거부, owned DB rollback 제약 복귀 검증. V34를 다시 쓰거나 fixture ALTER로 healthy를 만들지 않는다.
2. 신규 v3 raw READ 관계 검사: current USERoverride를 먼저 적용하고 각 남은 policy마다 target tenant/organization∧action∧field를 검사한 뒤 그 target에 맞는 필드만 합친다. 모든 native ROLE source를 검사하고 missing/incomplete/foreign/stale ROLE 증거를 broad USER로 회피하지 않는다. ROLE-only direct/group/privileged carrier fixture는 explicit MOCK이며 Auth native producer PASS가 아니다.
3. 기존 정책 생성 서비스의 최소 개선 경계: `WorkforceAccessPolicyService` 생성/철회 경로에 current governance 검증과 target subject owner 검증을 연결한다. 외부 요청 boolean/roles/permission 문자열을 새 권위로 민트하지 않는다. 새 target-role catalog owner port는 actor가 현재 보유한 역할 집합과 별개다(관리자는 자신이 보유하지 않은 관리 대상 역할을 설정할 수도 있다). Auth DB를 People에 읽게 하지 않는다. 기존 REST DTO/route·DIRECTORY·self grant 금지·tenant-local 조직검사·CAS·AuditOutbox는 보존한다.
4. 신규 target-first 조회 연결: 기존 service/repository를 사용하는 작은 원자 READ 메서드를 추가하되 `find/Decision`의 이전 소비자는 유지한다. People private `PeopleLookup`은 current trusted guard만 발급하고 server-owned operation requirements/selectedScope/purpose/audience/fieldPaths를 비교한다. person-only/prehire target에 worker/Auth 계정을 강제하지 않는다. 필요한 current Gateway/Auth-role/date adapter가 없으면 provider/SQL0 또는 typed UNAVAILABLE로 끝낸다.
5. 등록/배선은 위 actual producer+consumer 회귀 및 root 독립 검증 뒤에만 한다. 현재 shared registry/route/메뉴/Gate는 변경하지 않는다. 원자 READ 성공을 EXPORT/command/dynamic SoD 또는 whole current PEP 승인으로 확대하지 않는다.

## 기존 권한 그룹과 실제 검사 경계

- `ADMIN.WORKFORCE_ACCESS`는 Auth V37/V49에서 이미 존재하며 HR_ADMIN에 MANAGE가 부여되는 기존 리소스다. HRIS 앱 권한→권한그룹→원자 업무권한을 이 소유 체계에 연결하고 별도 HRIS RBAC를 만들지 않는다.
- 현재 `requireGovernor:210–216`는 permission이 비었을 때 ADMIN/TENANT_ADMIN role fallback을 허용한다. 이 legacy fallback을 새 native HRIS mutation의 current app/duty/SoD 증거로 쓰지 않는다. 실제 source-owned current 권한 검증 없이 `true`/빈 required duties/default grant를 채워 넣어 닫지 않는다.
- Gateway `VerifiedIdentityFilter`는 외부 identity/roles/permissions headers를 제거하고 검증한 세션으로 다시 민트한다. 따라서 'DWP 신원 연결 없음'이 아니라 기존 연결의 재사용이 맞다. 다만 세션 header를 native current source Role/auth revision proof와 동일시하지 않는다.
- 실제 current route/scope proof는 `ProductSurfaceDecisionContextFilter` 및 `ProductSurfaceContextAggregationSupport`의 server-authoritative psr/context 결속을 재사용해야 한다. caller expected revision/selector는 검증 입력일 뿐 grant가 아니다.

## 필요한 실제 회귀(예상 수를 결과로 사용하지 않음)

- USER FIELD_LIMIT + broad ROLE JOB_GRADE, USER OrgA + broad ROLE OrgB/TENANT, USER EXPORT + ROLE READ 모두 POLICY_DENIED.
- USER와 ROLE의 동일 target에서도 override 결과에는 USER contribution만 남고, ROLE-only인 경우에만 native role contributions가 유효하다.
- 실제 기존 `service.create`→`repository`로 DIRECTORY+JOB_GRADE OrgA 및 DIRECTORY OrgB 생성 후 OrgB JOB_GRADE 거부/DIRECTORY 허용; USER 우선 제한도 실제 native row 재조회에서 유지한다.
- missing current governance/subject/catalog/role/Gateway adapter 0DML; foreign tenant target user/role/org·PROVIDER family·revoked role·변경된 Auth 문자열/native version·person linkage·expired window 거부.
- 실제 service.revoke의 native version CAS 및 AuditOutbox 같은 트랜잭션 기록을 검증하고, 직전 조회 snapshot은 재사용할 수 없게 한다. 이 회귀가 실제 HTTP/Gateway/SoD integration을 대신하지 않는다.

## 남은 OPEN

현재 trusted Gateway/current policy producer transport, target-role catalog owner publication, 실제 HRIS atomic duty 등록, purpose-bound date owner publication, runtime-only startup13stream 배선은 미완료다. 신규 raw admission이나 작성자 unit/native subset 결과만으로 5개 모듈 전체 코딩 Gate를 열지 않는다.
