# 17. 디자인→코드 매핑과 검증 계획

- 기준일: 2026-09-10
- 사용 주체: Product, Design, Frontend, Approval Backend, Security, QA
- 전제: 01~16 디자인 수용 전에는 전자결재 production code를 변경하지 않는다.
- 원칙: 디자인은 구현 계약의 후보이며 최신 코드·OpenAPI·Product Surface가 권위 원본이다.

## 1. 디자인 수용 Gate

각 프레임은 아래 네 종류 중 하나로 annotation 되어야 한다.

| 분류             | 뜻                                     | 코드 착수 조건                                      |
| ---------------- | -------------------------------------- | --------------------------------------------------- |
| `EXISTING`       | 현재 route/API/permission으로 동작     | 시각·상호작용 회귀 범위 확정                        |
| `REDESIGN_ONLY`  | 데이터 계약 변경 없는 재배치·표현 개선 | 기존 상태 전이를 모두 보존하는 설계 승인            |
| `CONTRACT_FIRST` | 신규 API·DB·원장·권한 필요             | Backend/OpenAPI/Security 설계와 migration 번호 승인 |
| `EXTERNAL_GATE`  | Provider·KMS·보존·법무·운영 증거 필요  | 실제 외부 readiness가 검증될 때까지 fail-closed     |

분류가 없거나, 정상 화면만 있거나, 390px·권한 회수·부분 실패·`409` 상태가 누락된 프레임은
구현 입력으로 수용하지 않는다.

## 2. 화면별 현재 코드 매핑

| Prompt          | Route/위치                                                        | 현재 주요 컴포넌트                                                                                     | 현재 API                                             | 디자인 뒤 예상 작업                                                                                    |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 01 Home         | `/approvals/home`                                                 | `approval-home.tsx`, `approval-home-executive-widgets.tsx`, home model/registry                        | `getApprovalHome`, home preference API               | `REDESIGN_ONLY` 우선. briefing/widget 상태와 개인화 회귀 보존                                          |
| 02 Inbox        | `/approvals/inbox`                                                | `approval-command-center.tsx`, `approval-command-task-list.tsx`, `approval-inbox-queue-navigation.tsx` | `getApprovalTasks`, `getApprovalTask`, 단건 decision | sidebar 하위 큐와 list/detail, client filter·fan-out batch 개선. server search/bulk는 `CONTRACT_FIRST` |
| 03 Detail       | Inbox 우측                                                        | `approval-decision-detail.tsx`, `approval-payload-data.tsx`                                            | detail, claim, decision                              | evidence 위계·sticky action 개선. attachment/comment는 별도 계약                                       |
| 04 Mobile       | 02·03 변형                                                        | 동일 컴포넌트와 responsive shell                                                                       | 동일                                                 | route/state 보존형 drill-in과 focus return 구현                                                        |
| 05 Compose      | `/approvals/requests/new`                                         | `approval-requests.tsx`, `approval-request-form-context.tsx`                                           | published forms/workflows, create/update/submit      | catalog→compose 흐름 재구성. attachment는 `CONTRACT_FIRST`                                             |
| 06 Preflight    | 05 내부                                                           | request form context, payload components                                                               | create/update/submit                                 | existing validation·route summary 우선. 증빙/참조는 별도 계약                                          |
| 07 Drafts       | `/approvals/requests/drafts`                                      | `approval-requests.tsx`, detail drawer                                                                 | requests/detail/update/submit                        | `409`, stale authority, 입력 보존 UX 강화                                                              |
| 08 My requests  | `/approvals/requests/submitted`, `/approvals/requests/needs-info` | `approval-requests.tsx`, `approval-information-response-fields.tsx`, request detail drawer             | requests/detail/info-response/withdraw               | 상태별 next action과 schema-complete 보완 흐름 개선                                                    |
| 09 Completed    | `/approvals/completed`, `/approvals/requests/archive`             | `approval-inbox.tsx`, `approval-requests.tsx`                                                          | task/request list/detail                             | 두 archive 의미 분리. 고급 search/export는 `CONTRACT_FIRST`                                            |
| 10 Delegation   | `/approvals/delegations`                                          | `approval-delegations.tsx`, delegation model                                                           | list/candidates/create/revoke                        | 기간·scope·대표행위 evidence와 partial query 복구 개선                                                 |
| 11 Admin home   | `/approvals/admin/overview`                                       | `approval-admin.tsx`                                                                                   | `getApprovalAdminOverview`                           | 예외 중심 signal·partial source·read-only persona 재구성                                               |
| 12 Form catalog | `/approvals/admin/forms`                                          | `approval-form-studio.tsx`, catalog model/dialogs                                                      | categories/forms/detail/create/update/publish        | 3영역 catalog·inspector 개선. revision lifecycle은 별도 계약                                           |
| 13 Form builder | forms workspace                                                   | `approval-form-field-editor.tsx`, catalog dialogs/drafts                                               | create/update/publish                                | editor 책임 분리, preview/state table. 신규 field type 금지                                            |
| 14 Workflow     | `/approvals/admin/workflows`                                      | `approval-workflow-studio.tsx`                                                                         | workflows/detail/create/update/publish               | 순차 `ANY` studio 개선. quorum/parallel/simulation은 별도 계약                                         |
| 15 Policy       | `/approvals/admin/policies`                                       | `approval-policy-studio.tsx`                                                                           | policies/versions/update/publish                     | semantic diff·assurance rail. impact simulator는 별도 계약                                             |
| 16A Operations  | `/approvals/admin/operations`                                     | `approval-admin.tsx`, high-risk dialog/hooks                                                           | operations/retry                                     | recovery detail 개선. bulk/hold는 `CONTRACT_FIRST`                                                     |
| 16B Signatures  | `/approvals/admin/signatures`                                     | `approval-admin.tsx`                                                                                   | signatures                                           | readiness 표현 개선. e-sign은 `EXTERNAL_GATE`                                                          |

공통 route·surface 결속은 다음 파일이 소유한다.

- `apps/dwp/src/pages/approvals.tsx`
- `apps/dwp/src/features/approvals/approval-navigation.ts`
- `apps/dwp/src/features/approvals/approval-product-manifest.ts`
- `apps/dwp/src/routes/approvals-routes.tsx`
- `apps/dwp/src/routes/approval-surface-shell.tsx`
- `apps/dwp/src/layouts/approval-layout.tsx`
- `apps/dwp/src/layouts/approval-surface-layouts.tsx`

디자인 편의를 이유로 이 파일의 route·Product Surface·capability를 먼저 바꾸지 않는다.

## 3. API·Backend 권위 원본

Frontend user API와 admin mutation facade는 `libs/shared-utils/src/api/approval-api.ts`, admin read
API는 `approval-management-api.ts`, 공유 type은 `approval-management-contract.ts`가 현재 소비
경계다.
Backend 권위 원본은 다음과 같다.

- public controller: `dwp-approval-server/.../api/ApprovalController.java`
- admin controller: `dwp-approval-server/.../api/ApprovalAdminController.java`
- 상태 전이: `domain/ApprovalService.java`와 command/query repositories
- owner PEP: `security/ApprovalSecurityFilter.java`, `ApprovalOwnerPredicateEvaluator.java`
- 고위험 명령: `ApprovalHighRiskCommandGuard`, step-up verifier/replay ledger
- canonical DB: `dwp-approval-server/src/main/resources/db/migration/V1__...`~`V14__...`
- generated contracts: backend service/Gateway OpenAPI와 frontend `libs/api-contracts`

화면에 필요한 데이터가 현재 type/API에 없으면 다음 순서를 지킨다.

1. 사용 목적, actor, tenant/resource scope, null·retention·redaction을 정의한다.
2. owner-service DTO·상태 전이·permission·idempotency·audit를 먼저 설계한다.
3. migration이 필요하면 최신 번호를 재확인하고 forward-only로 추가한다.
4. Backend controller/OpenAPI와 owner PEP negative test를 구현한다.
5. service snapshot→Gateway public subset→frontend generated type 순으로 동기화한다.
6. 그 뒤 frontend adapter, query/mutation state, 화면을 구현한다.

Frontend mock이나 local state만으로 서버에 없는 기능을 완성 처리하지 않는다.

## 4. 권한·상태 구현 규칙

- 사용자 `approvals.work`와 관리자 `approvals.admin` Surface를 합치지 않는다.
- 메뉴 노출, 직접 URL, API owner PEP가 동일한 capability 의미를 사용해야 한다.
- `결재함` 하위 큐는 sidebar navigation state이며 Home body component가 아니다.
- URL의 `queue`, `task`, `request`는 선택/복귀용이다. 권한 원본이나 서버 scope가 아니다.
- 선택 상세는 identity, tenant, context scope, id, version과 최신 list/detail snapshot에 결속한다.
- 403/권한 회수는 cache를 폐기하고 열린 command를 닫는다.
- 첫 503/authority failure부터 write를 중지하며 stale read-only와 denied를 구분한다.
- `409`는 사용자 입력을 보존하고 최신 서버 상태를 읽은 뒤 명시적으로 다시 적용한다.
- 늦은 응답은 identity generation과 version monotonic guard를 통과할 때만 cache에 반영한다.
- pending command는 single-flight이며 double click·Enter 반복으로 중복 POST하지 않는다.
- optimistic success만으로 timeline/audit 완료를 표시하지 않는다.

## 5. 컴포넌트 분해 기준

디자인 수용 뒤에도 한 화면을 하나의 거대 TSX로 옮기지 않는다.

1. pure model: queue 분류, risk/SLA 표현, action eligibility, state transition
2. query/mutation controller: authoritative freshness, identity/version fence, cache invalidation
3. view sections: list, detail, evidence, action footer, empty/error states
4. reusable Approval primitives: status, priority, timeline, semantic surface
5. Design System 후보: 제품 중립이고 두 곳 이상에서 동일 접근성 계약을 가질 때만 승격

제품 전용 비즈니스 상태를 Design System에 넣거나, 단 한 화면의 장식을 공용 추상화로 만들지
않는다. icon은 기존 Lucide, command는 DWP Button, dialog는 DWP FormDialog 계약을 우선한다.

## 6. 구현 Wave와 정확한 인계 순서

### Wave A: 개인 판단 축

1. APR-01 승인
2. APR-02 승인
3. APR-03 승인
4. APR-04 승인
5. Home과 Inbox가 서로 다른 목적이라는 Product 검수
6. 기존 API만으로 가능한 `REDESIGN_ONLY` 변경 구현
7. user route Chromium/mobile 회귀와 visual 수용

### Wave B: 기안자 수명주기

1. APR-05~10 순차 승인
2. attachment/reference/search 등 `CONTRACT_FIRST` 항목을 별도 backlog/API proposal로 분리
3. create→draft→submit→needs-info→withdraw/archive 전이 검증
4. delegation identity/version/기간 경계 검증
5. mobile·keyboard·conflict·partial failure 수용

### Wave C: 관리자 통제

1. APR-11~16 순차 승인
2. Form/Workflow/Policy maker-checker persona 검수
3. 기존 순차 `ANY`와 목표 quorum/parallel을 명확히 분리
4. high-risk step-up·retry·readiness fail-closed 검수
5. `CONTRACT_FIRST` backend wave를 각각 독립 설계·승인

### Wave D: 통합

1. route/menu/Product Surface diff review
2. OpenAPI와 generated type drift 0 확인
3. Approval targeted backend/frontend Gate
4. 1440/1280/390/320/200% visual·interaction Gate
5. full repository static/unit/build Gate
6. 독립 Security·UX audit에서 P0/P1 0 확인
7. 정확한 파일 목록·테스트 수·외부 NO-GO를 기록하고 동결

## 7. 화면별 검증 매트릭스

각 구현 PR은 해당 행의 정상 상태만이 아니라 최소 다음 축을 조합한다.

| 축            | 필수 값                                                               |
| ------------- | --------------------------------------------------------------------- |
| Viewport      | 1440×900, 1280×800, 390×844, 320×568, 1280에서 200%                   |
| Theme         | light, 핵심 화면 dark, 고위험/오류 forced colors                      |
| Input         | mouse, keyboard, touch, 반복 Enter/double click                       |
| Data          | populated, empty, long text, null, 100/1000 row 목표                  |
| Query         | loading, partial, first 503, recovery, 403, identity switch           |
| Mutation      | idle, pending, success, 409, 503, stale late success                  |
| Persona       | worker, requester, approver, designer, publisher, operator, auditor   |
| Accessibility | Axe serious/critical 0, focus order/restore, live region, 200% reflow |

배치 결정은 서로 다른 policy/risk/version 대상이 섞인 partial failure를 포함하고, 관리자 publish와
retry는 step-up 취소·만료·재사용 차단을 포함한다.

## 8. 테스트 계획

디자인 문서만 바뀐 현재 단계:

```bash
corepack yarn prettier --check \
  'docs/05-features/DWP-R1-APR-001-enterprise-approval-decision-hub/**/*.md'
git diff --check -- \
  docs/05-features/DWP-R1-APR-001-enterprise-approval-decision-hub
```

Frontend 구현 단계의 최소 Gate:

```bash
corepack yarn vitest run apps/dwp/src/features/approvals libs/shared-utils/src/api/approval-api.test.ts
corepack yarn tsc --noEmit --incremental false --pretty false
corepack yarn lint
corepack yarn architecture:check
corepack yarn playwright test e2e/approval-*.spec.ts \
  --project=chromium --project=mobile --workers=1
corepack yarn build
```

Backend/API 변경이 있을 때:

```bash
./gradlew :dwp-approval-server:check checkServiceBoundaries checkSourceSize \
  --no-daemon --max-workers=1
python3 scripts/devctl.py up contracts
python3 scripts/export-openapi-contracts.py --check
./scripts/audit-code-contracts.sh
```

마지막 세 명령은 clean fresh DB의 전체 서비스 계약 검증이다. 로컬 fixture나 단위 테스트만으로
OpenAPI·DB code contract 정합을 주장하지 않는다. 실행 후 `python3 scripts/devctl.py down`으로
소유한 서비스만 정상 종료한다.

## 9. Design QA 체크리스트

- Home body에 결재함 4개 하위 메뉴 panel이 재등장하지 않았는가?
- `결재함`을 다시 누르면 sidebar submenu가 접히고, active child 맥락은 예측 가능한가?
- 사용자 Surface와 관리자 Surface의 메뉴·권한·시각 맥락이 분리됐는가?
- list selection, URL, browser back, mobile return focus가 같은 문서를 가리키는가?
- decision reason과 독립 collaboration comment를 혼동하지 않았는가?
- `ANY` 외 quorum, attachment, advanced search, legal e-sign을 이미 구현된 것으로 표시하지 않았는가?
- loading/empty/partial/403/503/409/offline이 서로 다른가?
- 실패 후 stale data로 write action이 열리지 않는가?
- 한영 긴 문구, 금액, 날짜, 위험, SLA가 색 없이도 이해되는가?
- 320px와 200%에서 sticky 영역이 본문·마지막 action을 가리지 않는가?
- dialog/drawer가 opener focus를 복구하고 background를 inert 처리하는가?
- 외부 readiness PENDING을 READY로 꾸미지 않았는가?

## 10. 완료 정의

이 Design AI 패키지의 완료는 01~16 프롬프트와 감사·매핑 문서가 구현 가능한 입력으로 준비된
상태다. 전자결재 고도화 개발의 완료가 아니다.

개발 완료는 승인된 frame 기준으로 기존 기능 회귀 0, 신규 계약의 owner-service truth,
Product Surface/permission 정합, desktop/mobile/a11y, 전체 Gate, 독립 Security·UX P0/P1 0까지
확인하고 외부 운영 조건을 별도로 기록했을 때만 선언한다.
