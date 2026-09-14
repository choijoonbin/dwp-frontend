# P09 — 관리콘솔: ID·접근 권한 및 플랫폼 전체 디자인 AI 프롬프트

[P00 공통 계약](00-common-contract.md)과 [메뉴·권위 계약](../contracts/account-admin-menu-inventory.md)을 함께 전달하세요. 중앙 관리콘솔의 **현행 ID/접근 8메뉴 + 플랫폼 4메뉴** 모두를 개별 작업으로 디자인합니다. 테이블에 항목 이름만 바꾼 같은 CRUD template를 적용하지 마세요. 각 화면의 사용자, 질문, 주 행동, 화면 유형, 작업 흐름과 실행 결과가 다릅니다. 개인정보·보안·인력 예시는 가상 데이터만 사용합니다.

## 공통 shell과 운영 계약 · `P09-S00`

조직 scope, 로그인 역할/지원 context의 권한 범위, 현재 페이지와 담당 책임이 명확합니다. 운영 테이블에는 filter/saved state/selection/inspector, 로딩·빈값·오류·부분 실패·권한 없음이 필요합니다. URL에 scope/filter/tab/selection/detail을 보존하는 새 설계를 요청하고 **현재 local state인 구현은 추가 개선**으로 annotation 합니다. 앱 배치/카탈로그 등록/운영 책임/접근 권한/최종 effective permission은 별도 권위입니다.

권한 변경에는 변경 대상·범위·기간·근거·승인/실행 권위·미리보기·진행·복구·감사증거를 디자인하세요. 실제 API에 없는 승인 단계/일괄처리/자동 rollback은 제안으로 표시합니다. 원천 조회 실패를 `권한 없음`이나 `0명`으로 축약하지 마세요. 모바일의 조사/판정은 가로로 끝없이 이어진 테이블보다 목록→detail→action의 명확한 흐름을 제공합니다.

## 1. 접근 제어 · `P09-I01` · `/admin/identity/access`

- **사용자 / 질문 / action / 유형:** ID 운영자 / “이 사용자에게 직접 부여한 역할과 최종 접근은 어떻게 다른가?” / 직접 역할의 근거 있는 변경 / user list-detail.
- **구조:** 사용자 검색·필터·선택 목록(가상 이름/소속/직접 역할/상속·일시 권한 요약), 선택 사용자 inspector(직접/그룹 상속/일시 특권 구분), `직접 역할 수정` form. 현행 listIdentityUsers/listIdentityRoles/replaceIdentityUserRoles를 반영합니다.
- **필드:** 사용자 고정, 직접 assigned role 다중선택, 추가 역할, 변경 근거. inherited count와 privileged 상태는 읽기 전용이고 `역할 및 권한 → 최종 권한`으로 연결합니다. 직접 역할 replace의 전체 전후 diff를 표시해 추가 한 개만 저장하는 동작으로 오인하지 않게 합니다.
- **flow:** 검색→사용자 선택→직접 역할 전후 비교→근거→impact/confirmation→replace→진행→서버 재조회→감사 link. `ADMIN.IDENTITY_DIRECTORY VIEW`는 열람 경계이며 변경 action에는 실제 mutation 권한을 적용합니다. 상속 역할은 여기서 삭제되지 않습니다.
- **상태/프레임:** no search results, 사용자 조회 부분 실패, role lookup 실패로 편집잠금, 권한 부족, 직접 역할없음·상속존재, 동시 변경/실행 실패/재조회 실패, mobile inspector.

## 2. 앱 책임 관리 · `P09-I02` · `/admin/identity/app-governance`

- **사용자 / 질문 / action / 유형:** 앱 소유자·카탈로그 운영자·위임 책임자 / “누가 어느 앱·자원에 어떤 운영 책임을 언제까지 가지는가?” / 명시된 책임·경계·preset duty 부여와 검토 / responsibility matrix + scope dossier.
- **구조:** responsibilities/assignments, boundaries(resource sets), 운영 preset 작업공간. 행은 사람×앱/자원범위×책임×기간×판정/실행 상태입니다. 선택하면 responsible app/resource set, justification, validTo/reviewDue, approval evidence, 실제 사용가능한 workbench deep link를 보여줍니다.
- **필드·controls:** principal, responsibility(APP_OWNER/APP_ACCESS_MANAGER/APP_ACCESS_APPROVER/APP_ACCESS_REVIEWER 등 서버 정의), scope, validTo, justification. resource boundary는 이름·member resource refs·근거·정확한 범위. preset에는 지원되는 duty 목록·신청 가능 여부·적용 scope·유효기간·reviewDueAt, 요청→승인/반려→활성화→검토→철회. bootstrap assignment는 별도 배지/설명이며 포괄 관리 권한으로 표현하지 않습니다.
- **flow:** 앱/범위 선택→담당자/책임 분리 확인→기간·근거→검토→authorized decision→실행/활성 상태 확인→정해진 앱 운영화면. preset review는 evidence와 RESOLVED/DISMISSED 판단을 보여줍니다. 승인 책임과 실행 책임을 한 명의 `관리자` badge로 묶지 마세요.
- **권한·상태/프레임:** 중앙 permission 또는 앱 responsibility가 허용하는 제한 범위를 유지. 다른 app scope 접근거부·기간 만료·self-review 제약·검토 기한 오류·지원되지 않는 preset·조회 실패/409/activation 실패·revocation impact. table-selection→scope dossier→workflow를 prototype으로 연결합니다.

## 3. 앱 접근 요청 · `P09-I03` · `/admin/identity/app-access-requests`

- **사용자 / 질문 / action / 유형:** 접근 승인자·IAM 실행자 / “이 신청은 타당하며 승인된 접근이 실제 제공됐는가?” / approve/reject, fulfillment, revoke / decision queue + fulfillment workflow.
- **구조:** 요청상태 필터, 업무 질문이 보이는 queue, 신청 detail와 책임·권한 context, 판정 action rail, IAM 실행 evidence. 승인과 provisioned 상태를 독립적으로 보여줍니다.
- **필드:** 요청자·소속·앱·요청권한/역할·업무 근거·신청시각·담당 scope, decision.note, fulfillment.note, 상태·버전·추적참조. 앱 배치가 없다고 접근 권한도 없다고 판단하지 않습니다.
- **flow:** 요청선택→근거/기존접근/담당범위 확인→decision→승인대기 실행큐→fulfill→진행→실제접근/evidence→필요시 revoke. 현행 decideAppAccessRequest/fulfillAppAccessRequest/revokeAppAccessRequest를 반영하고 미지원 자동 IAM 재실행 버튼은 만들지 않습니다.
- **상태/프레임:** pending/approved awaiting fulfillment/fulfilled/rejected/revoked, 조회 중인 요청자 fallback, 권한·책임 scope 불일치, 이미처리·409, execution failed/uncertain·재조회/recovery, 반려사유와 신청자 안내.

## 4. 접근 권한 검토 · `P09-I04` · `/admin/identity/access-reviews`

- **사용자 / 질문 / action / 유형:** 검토 캠페인 책임자·업무 인증자 / “이 접근을 유지할 근거가 있으며 판단 이후 조치가 완료됐는가?” / 캠페인 생성/활성화, item 인증, 완료 / certification campaign workspace.
- **구조:** campaign 목록(대상/기간/담당/상태/판정진행), 선택 campaign의 직접·그룹 상속 item 큐, 선택 evidence dossier, 판정/후속 조치. 상단 진행률에는 분모·대상·평가기준을 표시합니다.
- **필드:** campaign 생성 form은 name/description, scopeType(TENANT/ROLE/GROUP)/scopeRef, reviewerStrategy(TENANT_ADMIN/NAMED_REVIEWER)/reviewerUserId, dueAt입니다. item에는 사용자/권한 원천/role/resource·scope/privileged/근거/판정/사유. 유지/회수 등 실제 decision enum의 의미와 manualRemediation 상태를 설명합니다.
- **flow:** draft campaign→범위 preview→activate→review item→근거 확인→decision(reason)→회수 후속 조치·검증→완료 가능조건→complete→증거. 인증은 즉시 모든 권한회수와 같지 않으며 상속 원천 수정 책임도 드러냅니다.
- **상태/프레임:** 새 캠페인없음, active/완료/기한 초과, evidence partial failure, 권한 없음·self-decision제약, 미판정·manual remediation잔여, complete blocked/진행/실패. 지원되지 않는 bulk approve를 default action으로 만들지 않습니다.

## 5. 역할 및 권한 · `/admin/identity/roles` · 4개 현행 작업공간

### 역할 정의 · `P09-I05-R`

사용자: 접근 모델 책임자. 질문: “이 업무역할은 어느 자원에 어떤 권한을 포함하는가?” 유형: role definition studio. 역할 목록→선택 역할의 code/name/description/roleType/status/version, privileged/assignableToGroups, permission matrix→자원정의·권한편집 form. createGovernanceRole/updateGovernanceRole/replaceGovernanceRolePermissions/createGovernanceResource의 실제 필드를 반영합니다. permission matrix는 resource×action 비교가 목적이며 선택권한의 전체 전후 diff를 제공. resource 검색/등록, supported action code, 대상 scope를 구분합니다. 변경→affected assignments/effective 영향(추가 집계 필요시 제안)→근거/confirmation→진행→재조회. immutable/시스템 역할·자료 조회 부분 fail·permission 전체 교체 실패·409 프레임.

### 그룹 역할 할당 · `P09-I05-A`

사용자: 그룹 접근 운영자. 질문: “어떤 그룹에게 어디까지 언제까지 역할을 할당하는가?” 유형: scoped assignment workflow. listDirectoryGroups 검색→group selection→role selection→scope/scopeRef→validTo→justification→전후 영향 preview→createGroupRoleAssignment→active 확인. 그룹 가입 권한이나 개인 직접 역할을 여기서 같이 편집하지 않습니다. 목록은 source group/role/scope/기간/상태, selection dossier와 revoke 사유. unknown group·조직 scope 필요·만료/중복·조회 부분 fail·revoke 영향·409/진행 실패 프레임.

### 특권 접근 · `P09-I05-P` 및 `-PR/-PE/-PP/-PB`

사용자: 보안/특권 책임자. 질문: “누가 어떤 특권을 언제 왜 활성화하며 비상 접근은 어떤 통제를 받는가?” 유형: just-in-time access operations. 현행 Requests/Eligibilities/Policies/Boundaries 4뷰를 별도로 설계합니다. 요청은 신청 범위/기간/근거/assurance·decision·activation 상태; eligibility는 대상/역할/자원/유효기간·승인 근거; policy는 activationMode/assurance/maximumDuration/emergencyMode 등 지원 필드; boundary는 자원 action·검토 기한·비상 조건/정당화. 요청 승인과 실제 특권 활성화는 다릅니다. 정책이나 경계를 바꿀 때 영향/근거·승인 권위·progress·recovery·audit를 연결합니다. 비상 접근의 사후 검토/만료 상태를 명확히. 대기/활성/만료/철회·assurance 미충족·권한 없음·기한 오류·정책 부분 실패·중복 실행/불확실 결과 프레임.

### 최종 접근 검증 · `P09-I05-E`

사용자: 접근 조사자. 질문: “이 사용자가 이 자원에 접근 가능한 실제 이유는 무엇인가?” 유형: effective permission investigator. 사용자 search→resource/action 선택·검색→getEffectiveAccess→direct/group/role/privileged provenance tree + effective permissions table. 사용자의 과거 권한이나 실시간 source가 없는 경우 현재 판정 시각/자료 scope를 명시합니다. 테이블 행 선택→모든 allow/deny contribution과 source 책임 deep link, denied reason, 유효기간/범위. 권한을 검사하면서 자동 부여하는 버튼은 금지. 데이터 없음·사용자 조회 실패·effective API 실패·부분 source/제한 권한 상태. 검증은 “권한 부여 완료” 영수증이 아닙니다.

### 탭·URL·대표 여정

현행 tab은 local state입니다. 리뉴얼에서는 `?tab=roles|assignments|privileged|effective&user=…&resource=…`의 선택/복귀 보존을 **추가 개선 계약**으로 요구합니다. `역할 정의→그룹 할당→특권 조건→최종 접근 검증` 연결 여정을 하나의 prototype으로 제출하세요. 각 단계의 주 사용자/action이 명확하며 네 개 탭을 같은 table layout으로 복제하지 않습니다.

## 6. 인력 데이터 접근 · `P09-I06` · `/admin/identity/workforce-access`

- **사용자 / 질문 / action / 유형:** HR 접근 정책 책임자 / “누가 어느 인력 집합의 어느 데이터 군을 열람/반출할 수 있는가?” / 제한된 policy 생성·철회 / policy matrix + impact workflow.
- **구조:** 정책 목록과 state/action 필터, selected policy detail, 명료한 `대상자→인력범위→데이터군→행위→기간/근거` 단계 form. 실제 직원의 민감한 인사 내용을 보여주는 화면이 아닙니다.
- **필드:** subject ROLE(HR_ADMIN/PEOPLE_ADMIN) 또는 USER; population TENANT/ORG_UNIT/ORG_TREE와 organization; fieldGroups DIRECTORY/WORKER_IDENTIFIERS/EMPLOYMENT/JOB_GRADE; actions READ/EXPORT; validFrom/validTo; justification. 전사/조직 트리/단일 조직 차이, READ와 EXPORT 독립, identifier/grade의 민감도를 plain language로 설명.
- **flow:** scope 선택→데이터 군/행위 선택→기간/근거→가상 persona 영향 preview→생성→effective lifecycle/버전→감사. 현행 create/revoke만 지원하며 정책 편집이나 승인 단계를 현행이라고 그리지 않습니다. revoke는 scope+사유 확인→실행→server state. future-effective/expired/revoked 상태를 단순 ACTIVE badge로 묶지 않습니다.
- **상태/프레임:** `ADMIN.WORKFORCE_ACCESS MANAGE` 부족, organization/user lookup 각각 부분 실패, 빈 검색/로드 실패 구분, 유효 기간 오류, 전사+EXPORT 영향 confirmation, 실행 실패/409. 사용자 삭제·존재 불명 시 사람 이름을 추정하지 않습니다.

## 7. 저장 뷰 소유권 · `P09-I07` · `/admin/identity/saved-view-custody`

- **사용자 / 질문 / action / 유형:** 인수인계/데이터 관리 책임자 / “퇴직·이동자의 저장 화면을 누가 이어받고 무엇은 보관해야 하는가?” / 미리보기 후 이전/보류/보관 / custody plan workflow.
- **구조:** plan/history 탭, 단계 owner→disposition→evidence→preview→execute, 별도 orphan 큐·action history. 목록 CRUD가 아니라 보존/접근 리스크가 다른 객체를 다루는 작업입니다.
- **필드:** sourceOwner, targetOwner, disposition, retentionUntil, reasonCode, sourceReference, reason. preview는 evaluatedAt/scopeCount/각 view·owner·출처 앱·이전 가능성·이름 충돌·권한 제약·차단 사유를 보여줍니다. 이전은 저장된 query/filter/layout 소유권이며 앱 접근 권한이나 직원 data의 전송이 아닙니다.
- **flow:** owner 선택→대상/보관 계획→근거→preview→충돌 해소·선택 scope 확인→confirmation→transfer→각 항목 결과·history/audit. preview 후 계획을 바꾸면 다시 평가. source/target user 검색과 임의 식별자 입력은 지원 정책대로. orphan별 reassign/extend retention/archive는 현재 API에 맞춰 결과·복구 가능성을 설명.
- **상태/프레임:** no views, inaccessible source, target과 동일 owner, 이름 충돌, stale preview, 409/부분 이전/실패, 권한 조회 실패, 보관 조건 불충족, orphan reassignment/extension/archive·진행 결과. URL/필터/선택 뷰 보존은 추가 개선.

## 8. ID 프로비저닝 · `P09-I08` · `/admin/identity/provisioning`

- **사용자 / 질문 / action / 유형:** IAM 연계 운영자 / “SCIM 계정 수명주기가 정상이며 자격증명/실행 실패를 어떻게 복구하는가?” / connector 생성·secret회전·lifecycle 조정 / connector list-detail + secure setup workflow.
- **구조:** connector 상태·사용자 영향 요약, 선택 connector endpoint/설정 detail, 최근 event·안전한 오류/추적, create/rotate flow. 실패 event를 먼저 노출하고 정상 설정은 압축.
- **필드:** connector key/name, lifecycle, endpoint copy, 생성/회전 후 **일회성 secret**. token은 목록/감사 문서/preview에 평문 표시하지 않습니다. 일회성 dialog에는 복사 완료·재표시 불가·닫기 confirmation. 새 token 노출이 old token취소 시점과 같은지는 실제 계약대로 설명.
- **flow:** create→endpoint+one-time token→안전한 외부 등록 안내→관측 event 확인. rotate→사용 중인 연계 영향·새 credential 작업 계획→confirmation→진행→secret 보관→event/health 검증. suspend/activate는 계정 삭제로 표시하지 않습니다. 자동 outbound 재전송이 없는 경우 retry 버튼 발명 금지.
- **상태/프레임:** no connectors, 열람 권한 부족/rotate, 자격증명 복사 실패·닫힘 후 복원 불가, 토큰 회전 실패·결과 불확실, 수명주기 오류, event 조회 부분 실패, 안전한 오류와 상관관계 추적, 모바일 일회성 입력 화면.

## 9. 카탈로그 탐색 · `P09-P01` · `/admin/platform/catalog`

- **사용자 / 질문 / action / 유형:** 플랫폼·앱 책임자 / “이 자산을 바꾸면 어떤 앱·홈·권한·사용자 경험에 영향이 생기는가?” / 영향조사, 관계선언/철회, assurance 판단 / dependency graph + inventory + assurance workspace.
- **구조:** graph/inventory/assurance 3뷰, scope/search/assetkind/depth, 선택 자산 inspector, operation impact. graph를장식용 nodecloud로 만들지 않고 selected자산과상류/하류·관계유형/중요도를 보여줍니다. 같은관계의 keyboard-accessible tree/table equivalent필수.
- **필드:** relation source/target/type/criticality/evidence, 자산 담당자/lifecycle/permission/dependency, impact operation, assurance finding/evaluation/evidence/disposition. 홈위젯→provider API→registry asset→permission/responsibility→앱 owner의 연결된 조사 예제.
- **flow:** asset 선택→관계 깊이/operation 변경→영향 상세→관계 원천 검증→declare/retire 또는 정합성 평가→위험 신호 상세→근거 있는처분→상태/증거. 선언 관계와 관측 관계를 구분;부족한 관계는 영향 0이아닌 관측 범위 확인 불가. relation수정/운영 API지원 범위유지.
- **상태/프레임:** graph/impact/assurance각 부분 실패, no relations, 접근할 수 없는 자산, 관계 순환/찾을 수 없는 참조, 오래된 영향 평가, 409/처분실패, URL의 view/선택/operation 보존, 모바일관계 tree.

## 10. 기준정보 · `P09-P02` · `/admin/platform/reference-data`

- **사용자 / 질문 / action / 유형:** 기준정보 담당자 / “제품에 쓰이는 코드·다국어표시·계층·유효기간이 정합적인가?” / code set/item 정의·활성·철회 / master-data list-detail + hierarchy focus editor.
- **구조:** 코드 세트 검색/selection, 선택 세트 요약, values/activity 뷰, 계층/유효 기간 검증, 편집 drawer/form. 코드 세트 요약는대상세트 scope와최근 updated 표시. values목록과 audit는 같은 선택에 연동.
- **필드:** setKey/name/description/lifecycle/revision; item code/order/parentCode/validFrom/validTo/labels(locale, label, description). code/set key는 지원 조건에 따라 불변. ko/en누락·중복 code·상위 코드 순환·유효 기간 역전·철회된 상위 코드를검증. 의존 앱의 기존 기록에 어떤 영향이 있는지 API가 지원하지 않으면`영향검토필요`로표시.
- **flow:** set/itemdraft→label/parent/validity입력→preview/validation→save→activate→실제 사용 표시·activity. retirement는 삭제가 아니며 이력 보존/재활성화 조건을 설명. 미래유효 item과 ACTIVElifecycle을 분리.
- **상태/프레임:** no sets/no items/no matches 구분, set목록성공·detail 실패·activity 실패, 긴 한/영 labels, 계층 보기, 잘못된 날짜·중복 코드, activate/철회 확인·409/실패, 모바일 항목 상세.

## 11. 앱 레지스트리 · `P09-P03` · `/admin/platform/registry`

- **사용자 / 질문 / action / 유형:** 플랫폼등록·릴리스 책임자 / “어떤 실행자산 version이 테넌트에 활성인가?” / 정의 draft·새 revision·activate/retire / versioned registry studio.
- **구조:** type/state/search목록, 선택 자산 정의·history/활성 버전, 버전 편집 폼, 릴리스 영향. 카드 catalog나 앱 마켓과 구분하며 registry등록이 홈 배치나 사용자 권한 허용과 다름을 보입니다.
- **필드:** APP/CONNECTOR/AGENT/TOOL/POLICY (현행 dialog), entryKey/name/description/ownerRef/riskTier/artifactVersion/version/lifecycle. API 타입 API/DATA_PRODUCT는 존재하지만 dialog등록 미지원이므로 추가 UI는`제안`으로표시. AGENT 상세 profile은실제 지원 필드만반영.
- **flow:** create draft→validation→save→활성화 확인(자산/범위/이전 version/영향)→진행→active 확인. 활성 자산 편집는새 revision 생성, DRAFTedit와다름. retire는사용 중 provider/홈 widget에 미치는 영향·대체안을 preview하며 영향 집계 API가 없으면 추가 기능이라고 표시.
- **상태/프레임:** draft/active/철회 이력, 미지원 유형, 중복 키/담당자 누락/잘못된 구현 artifact, 참조 조회 부분 실패, activation/철회 실패·409/권한 부족, 활성 버전과 초안 비교, 모바일 이력.

## 12. 내비게이션 · `P09-P04` · `/admin/platform/navigation`

- **사용자 / 질문 / action / 유형:** 탐색 경험 운영자 / “어떤역할이 어떤메뉴를 실제 볼 수 있으며 새 트리가 업무 경로를 깨뜨리는가?” / 검증한 menu tree draft/publish/restore / navigation studio.
- **구조:** 현재 게시본/draft, 좌측 tree(authoring), 우측 nodeform·validation, 런타임 미리보기, diff/history. multilingual labels·re원천 권한·레지스트리 대상를 연결하고 menuorder와앱 배치는 별도입니다.
- **필드:** NavigationDialog의 navigationKey/itemType(GROUP/APP)/parentNavigationItemId/registryEntryKey/route/iconKey/requiredResourceKey/requiredPermissionCode/sortOrder, labels(locale/label/description), lifecycle/version. drag-and-drop + keyboard sensor + 앞뒤/상위/하위명령. source tree와 preview tree를구분하며 가상 사용자 권한 preview는추가 계약 지원 필요.
- **flow:** create draft→nodeedit/reorder→save changeSummary→validation(중복 path/없는 target/상위 코드 순환/역할에 숨겨진 경로)→diff+런타임 미리보기→publish→확인/audit. cancel은내 draft취소, restore는 revision의변경 scope·대상/현재 버전 diff를 보여준 뒤 지원 API실행. publish가 권한 부여 자체라고 표현하지 않습니다.
- **상태/프레임:** draftnone/emptytree/권한으로 접근 불가한 대상, registry/resources부분 실패, 초안 검증으로 게시 차단, 게시본과 초안 비교, 저장되지 않은 탐색 변경, 409/게시 실패/복원 확인, 모바일 트리와 nodeform·초점 복귀. URL 선택 보존을 추가 개선으로 annotation.

## 신규 제안: 위젯 계약 스튜디오 · `P09-N01` · 후보 `/admin/platform/widget-contracts`

미래의 미지위젯 확장을 관리할 필요가 있습니다. **우선 기존 `/admin/experience/home-composition?tab=catalog` 안의 contract/version/validation/detail workspace를 확장**하세요. 별도 플랫폼 담당자가 여러 앱의 provider 계약을 독립적으로 관리해야 할 때만 새로운 route를 검토합니다.

질문: “새 위젯이 구현된 artifact·원천 API·권한·실행·접근성 계약을 충족하는가?” 유형: contract studio. 계약버전/owner/provider·레지스트리 참조/지원 surface/데이터모델/freshness/permission·필드 필터/설정 스키마/width·height/action·실행 영수증/AI evidence·허용 도구 s/로딩·빈값·부분 실패/locale/A11y/실행 검증 결과. 등록 요청→자원/권한 일관성 검증→artifact지원확인→가상 데이터 미리보기→시범 적용 영향→release→deprecated/retired·영향받는 뷰. schema를 편집했다고 동적 코드가 곧 실행되는 것처럼 그리지 마세요. 앱 owner가 source·업무로직·approval을 소유하고 홈 관리는배치·표시 계약을 소유합니다. 중앙 registry와 DWAI agent/도구 레지스트리의 소유 경계도 표시하세요.

## 제출 기준

각 ID별대표정상/로딩/빈값/오류/부분 실패/권한/confirmation/진행/recovery 프레임, 실제 작업 흐름 prototype을 제출하세요. 1440/1280/390/320·200% zoom, ko/en, light/dark/high contrast, reduced motion, keyboard/touch는 P00대로필수. 영향·승인·복원은 현재 지원 vs추가 제안을 반드시 구분합니다. 디자인에서 선택·필터·URL·role·audit 연결이 보여야 합니다.
