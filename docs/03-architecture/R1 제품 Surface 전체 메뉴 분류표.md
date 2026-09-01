# R1 제품 Surface 전체 메뉴 분류표

- 상태: Governed ledger v1.6
- 기준일: 2026-08-28
- 기준 Frontend Commit: `9bc909a` + 본 통합 변경 단위
- 집계 Source: `apps/dwp/src/routes/product-menu-manifest.ts`
- Ledger SHA-256: `c77a266fc9e1320ba4a75d639e4dd8903b7d031610854f793e904174057b85ec`
- 상위 결정:
  [R1 제품 업무·관리 Surface 분리 및 관리 Context ADR](R1%20제품%20업무·관리%20Surface%20분리%20및%20관리%20Context%20ADR.md)

## 1. 범위와 판정

이 표는 현재 Runtime의 정적 Menu Route **187개 전부**를 분류한다. Detail Route, Query View,
Context Menu와 아직 Navigation Source에 없는 예정 메뉴는 수량에 포함하지 않는다. 각 행의
`목표 Plane/Task`와 `목표 Surface`는 구현 시 Product Manifest와 자동 Test의 Golden Source가
된다.

전체 187개는 `GovernedMenuRecord.navigationContextId`를 정확히 하나 가진다. 표의 `목표
Surface`는 12개 업무 앱 139개에서는 `productSurfaceId`이자 `navigationContextId`이고, 나머지
48개에서는 Product Surface가 아닌 상위 Navigation Context다. 고정값은 `home`, `catalog`,
`work.work`, `activity.work`, `tenant.admin`, `provider.control`, `account.settings`다.
모든 `navigationContextId`는 `_`가 없는 lower-kebab 점 구간 문법을 사용한다. 비제품 Governed
Route Key가 필요할 때는 점을 `__`로 치환한 가역 Token만 사용하며 별도 수기 Token Mapping은
두지 않는다.

| 목표 Plane          |    수량 | 의미                                    |
| ------------------- | ------: | --------------------------------------- |
| `work`              |      84 | 개인·참여 업무 81 + 관계 기반 팀 업무 3 |
| `management`        |      61 | 제품 운영 33 + 제품 설정 28             |
| `tenant-governance` |      24 | 회사 공통 운영 8 + 회사 공통 설정 16    |
| `provider-control`  |      10 | Provider 운영 6 + Provider 설정·통제 4  |
| `account`           |       8 | 개인 계정·선호                          |
| **합계**            | **187** |                                         |

Task 기준 합계는 `work 89`, `team 3`, `operations 47`, `administration 48`이다. Account의
개인 설정 8개는 Plane은 `account`, Task 집계에서는 `work`로 센다.

### 표기

- `W/W`: `work/work`, `W/T`: `work/team`
- `M/O`: `management/operations`, `M/A`: `management/administration`
- `TG/O`: `tenant-governance/operations`, `TG/A`: `tenant-governance/administration`
- `PC/O`: `provider-control/operations`, `PC/A`: `provider-control/administration`
- `AC/W`: `account/work`
- `P:` Parent Route Guard, `I:` Item/Page Guard, `S:` Provider Support Scope
- `VIEW+`는 현재 공통 Helper가 `VIEW` 또는 `MANAGE`를 허용한다는 뜻이다. 개별 Page의 정확한
  `VIEW` 검사와 다르면 `Guard 정합화`를 표시한다.

### Migration Wave

| Wave     | 정적 메뉴 수량 | 범위                                                     |
| -------- | -------------: | -------------------------------------------------------- |
| `W0`     |              0 | 공통 Manifest·Resolver·Guard·Shell·Context API·Telemetry |
| `W0.5`   |             12 | Communications·Services Technical Canary                 |
| `W1a`    |             15 | Approvals 대표 Pilot                                     |
| `W1b`    |             25 | HCM 대표 Pilot                                           |
| `W2`     |             35 | DWAI·ON, Notifications, Spaces                           |
| `W3`     |             52 | Calendar, Workplace/Rooms, Mail, Messaging, Meetings     |
| `Keep`   |             48 | 이미 독립된 Workspace, Tenant, Provider, Account Plane   |
| **합계** |        **187** |                                                          |

## 2. Workspace, Work와 Activity — 6

| Menu ID             | 현재 그룹 › 메뉴              | Path                 | Plane/Task | 목표 Surface    | 현재 조건              | 결정 |
| ------------------- | ----------------------------- | -------------------- | ---------- | --------------- | ---------------------- | ---- |
| `home.personal`     | Home › 개인 홈                | `/`                  | W/W        | `home`          | Auth + Workspace Guard | Keep |
| `catalog.apps`      | Catalog › 앱 카탈로그         | `/apps`              | W/W        | `catalog`       | Auth + Workspace Guard | Keep |
| `work.home`         | 홈 › 업무 홈                  | `/work/home`         | W/W        | `work.work`     | P: `APP.WORK`          | Keep |
| `work.queue`        | 나의 업무 › 통합 업무함       | `/work/queue`        | W/W        | `work.work`     | P: `APP.WORK`          | Keep |
| `activity.home`     | 홈 › 활동 홈                  | `/activity/home`     | W/W        | `activity.work` | P: `APP.ACTIVITY`      | Keep |
| `activity.timeline` | 활동 모니터링 › 활동 타임라인 | `/activity/timeline` | W/W        | `activity.work` | P: `APP.ACTIVITY`      | Keep |

## 3. DWAI·ON — 15 (`W2`)

Parent는 현재 `APP.ASK`다. Management Child가 Parent App Guard와 결합된 구조를 분리한다.

| Menu ID                   | 현재 그룹 › 메뉴             | Path                       | Plane/Task | 목표 Surface        | Item 조건                                                       | 결정                                |
| ------------------------- | ---------------------------- | -------------------------- | ---------- | ------------------- | --------------------------------------------------------------- | ----------------------------------- |
| `dwaion.home`             | 시작 › DWAI·ON 홈            | `/dwaion/home`             | W/W        | `dwaion.work`       | —                                                               | Work Nav                            |
| `dwaion.new`              | 대화 › 새 대화               | `/dwaion/new`              | W/W        | `dwaion.work`       | —                                                               | Work Nav                            |
| `dwaion.activity`         | 실행 › AI 실행 이력          | `/dwaion/activity`         | W/W        | `dwaion.work`       | —                                                               | Work Nav; DRAFT PAGE                |
| `dwaion.proposals`        | 제안 › AI 제안함             | `/dwaion/proposals`        | W/W        | `dwaion.work`       | —                                                               | Work Nav; DRAFT PAGE                |
| `dwaion.conversations`    | 대화 › 내 대화               | `/dwaion/conversations`    | W/W        | `dwaion.work`       | —                                                               | Work Nav                            |
| `dwaion.agents`           | 탐색 › 전문 에이전트         | `/dwaion/agents`           | W/W        | `dwaion.work`       | —                                                               | Work Nav                            |
| `dwaion.actions`          | 탐색 › 업무 실행 및 연결     | `/dwaion/actions`          | W/W        | `dwaion.work`       | I: 4개 Exact Action 중 하나, 현재 각 Resource `MANAGE` Fallback | Work Nav; Exact Action 정합화       |
| `dwaion.admin-overview`   | 운영 › 운영 현황             | `/dwaion/admin/overview`   | M/O        | `dwaion.management` | I: `ADMIN.DWAION_OPERATIONS:VIEW+`                              | Management Nav                      |
| `dwaion.admin-agents`     | 운영 › 에이전트 및 게시 관리 | `/dwaion/admin/agents`     | M/A        | `dwaion.management` | I: `ADMIN.DWAION_AGENTS:VIEW+`                                  | Management Nav                      |
| `dwaion.admin-sources`    | 운영 › 데이터 소스와 커넥터  | `/dwaion/admin/sources`    | M/A        | `dwaion.management` | I: `ADMIN.DWAION_SOURCES:VIEW+`                                 | Management Nav                      |
| `dwaion.admin-actions`    | 운영 › 액션과 실행 권한      | `/dwaion/admin/actions`    | M/A        | `dwaion.management` | I: `ADMIN.DWAION_ACTIONS:VIEW+`                                 | Management Nav                      |
| `dwaion.admin-safety`     | 운영 › 정책 및 안전 제어     | `/dwaion/admin/safety`     | M/A        | `dwaion.management` | I: `ADMIN.DWAION_SAFETY:VIEW+`                                  | Management Nav                      |
| `dwaion.admin-evaluation` | 운영 › 응답 품질과 평가      | `/dwaion/admin/evaluation` | M/O        | `dwaion.management` | I: `ADMIN.DWAION_EVALUATION:VIEW+`                              | Management Nav                      |
| `dwaion.admin-gates`      | 운영 › 운영 전환 검증        | `/dwaion/admin/gates`      | M/A        | `dwaion.management` | I: `ADMIN.DWAION_GATES:VIEW+`                                   | Management Nav                      |
| `dwaion.admin-audit`      | 운영 › 데이터 보존과 감사    | `/dwaion/admin/audit`      | M/A        | `dwaion.management` | I: Retention/Audit `VIEW` 또는 `MANAGE` 중 하나                 | Management Nav; Exact Action 정합화 |

## 4. Communications — 6 (`W0.5` Canary)

일반 Parent는 `APP.COMMUNICATIONS`이고, 승인된 Support Session은
`TENANT_CONFIGURATION_READ|WRITE`로 관리 Route만 열 수 있다.

| Menu ID                        | 현재 그룹 › 메뉴            | Path                            | Plane/Task | 목표 Surface                | Item 조건                                 | 결정           |
| ------------------------------ | --------------------------- | ------------------------------- | ---------- | --------------------------- | ----------------------------------------- | -------------- |
| `communications.home`          | 개요 › 소식 홈              | `/communications/home`          | W/W        | `communications.work`       | P: App                                    | Work Nav       |
| `communications.for-you`       | 발견 › 나를 위한 소식       | `/communications/for-you`       | W/W        | `communications.work`       | P: App                                    | Work Nav       |
| `communications.all`           | 발견 › 전체 소식            | `/communications/all`           | W/W        | `communications.work`       | P: App                                    | Work Nav       |
| `communications.required`      | 내 라이브러리 › 필수 확인   | `/communications/required`      | W/W        | `communications.work`       | P: App                                    | Work Nav       |
| `communications.saved`         | 내 라이브러리 › 저장한 소식 | `/communications/saved`         | W/W        | `communications.work`       | P: App                                    | Work Nav       |
| `communications.admin-content` | 소식 운영 › 콘텐츠 및 게시  | `/communications/admin/content` | M/O        | `communications.management` | I: `ADMIN.COMMUNICATIONS:VIEW+`; S config | Management Nav |

## 5. Services — 6 (`W0.5` Canary)

Parent는 `APP.EMPLOYEE_SERVICES`다.

| Menu ID                     | 현재 그룹 › 메뉴              | Path                         | Plane/Task | 목표 Surface          | Item 조건                           | 결정           |
| --------------------------- | ----------------------------- | ---------------------------- | ---------- | --------------------- | ----------------------------------- | -------------- |
| `services.home`             | 개요 › 서비스 홈              | `/services/home`             | W/W        | `services.work`       | P: App                              | Work Nav       |
| `services.discover`         | 서비스 이용 › 서비스 찾기     | `/services/discover`         | W/W        | `services.work`       | P: App                              | Work Nav       |
| `services.my`               | 서비스 이용 › 진행 중인 요청  | `/services/my`               | W/W        | `services.work`       | P: App                              | Work Nav       |
| `services.drafts`           | 서비스 이용 › 임시 저장       | `/services/drafts`           | W/W        | `services.work`       | P: App                              | Work Nav       |
| `services.admin-catalog`    | 서비스 운영 › 서비스 카탈로그 | `/services/admin/catalog`    | M/A        | `services.management` | I: `ADMIN.SERVICE_CATALOG:VIEW+`    | Management Nav |
| `services.admin-operations` | 서비스 운영 › 요청 운영       | `/services/admin/operations` | M/O        | `services.management` | I: `ADMIN.SERVICE_OPERATIONS:VIEW+` | Management Nav |

## 6. Notifications — 9 (`W2`)

Parent는 `APP.NOTIFICATIONS`다. Query View 6개는 별도 Menu가 아니다.

| Menu ID                            | 현재 그룹 › 메뉴              | Path                                | Plane/Task | 목표 Surface               | Item 조건                                               | 결정                          |
| ---------------------------------- | ----------------------------- | ----------------------------------- | ---------- | -------------------------- | ------------------------------------------------------- | ----------------------------- |
| `notifications.home`               | 개요 › 알림 홈                | `/notifications/home`               | W/W        | `notifications.work`       | P: App                                                  | Work Nav                      |
| `notifications.center`             | 내 알림 › 알림 센터           | `/notifications/center`             | W/W        | `notifications.work`       | Nav-only: `APP.NOTIFICATIONS:VIEW+`; Route는 Parent App | Work Nav; Direct Route 정합화 |
| `notifications.settings`           | 내 알림 › 알림 설정           | `/notifications/settings`           | W/W        | `notifications.work`       | Nav-only: `APP.NOTIFICATIONS:VIEW+`; Route는 Parent App | Work Nav; Direct Route 정합화 |
| `notifications.admin-overview`     | 테넌트 운영 › 운영 개요       | `/notifications/admin/overview`     | M/O        | `notifications.management` | I: `ADMIN.NOTIFICATION_OPERATIONS:VIEW+`                | Management Nav                |
| `notifications.admin-contracts`    | 테넌트 운영 › 알림 계약       | `/notifications/admin/contracts`    | M/A        | `notifications.management` | I: `ADMIN.NOTIFICATION_CONTRACT:VIEW+`                  | Management Nav                |
| `notifications.admin-policies`     | 테넌트 운영 › 정책 스튜디오   | `/notifications/admin/policies`     | M/A        | `notifications.management` | I: `ADMIN.NOTIFICATION_POLICY:VIEW+`                    | Management Nav                |
| `notifications.admin-templates`    | 테넌트 운영 › 템플릿 스튜디오 | `/notifications/admin/templates`    | M/A        | `notifications.management` | I: `ADMIN.NOTIFICATION_TEMPLATE:VIEW+`                  | Management Nav                |
| `notifications.admin-operations`   | 테넌트 운영 › 전달 운영       | `/notifications/admin/operations`   | M/O        | `notifications.management` | I: `ADMIN.NOTIFICATION_OPERATIONS:VIEW+`                | Management Nav                |
| `notifications.admin-suppressions` | 테넌트 운영 › 전달 통제       | `/notifications/admin/suppressions` | M/O        | `notifications.management` | I: `ADMIN.NOTIFICATION_OPERATIONS:VIEW+`                | Management Nav                |

Notifications는 Runtime 관점의 논리 Product로 고정한다. 물리 배포는 계속 `platformFeature`일
수 있으나 W2에서 `architecture/frontend-apps.json`에 Product Surface·Route Ownership을
명시한다.

## 7. Calendar — 10 (`W3`)

Parent는 `APP.CALENDAR`다.

| Menu ID                            | 현재 그룹 › 메뉴           | Path                                | Plane/Task | 목표 Surface          | Item 조건                 | 결정                         |
| ---------------------------------- | -------------------------- | ----------------------------------- | ---------- | --------------------- | ------------------------- | ---------------------------- |
| `calendar.home`                    | 시작 › 오늘                | `/calendar/home`                    | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.schedule`                | 계획 › 일정                | `/calendar/schedule`                | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.focus`                   | 계획 › 집중 계획           | `/calendar/focus`                   | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.invitations`             | 협업과 예약 › 초대 및 응답 | `/calendar/invitations`             | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.availability`            | 협업과 예약 › 가용 시간    | `/calendar/availability`            | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.trash`                   | 협업과 예약 › 휴지통       | `/calendar/trash`                   | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.insights`                | 분석 › 시간 인사이트       | `/calendar/insights`                | W/W        | `calendar.work`       | P: App                    | Work Nav                     |
| `calendar.admin-overview`          | 운영 관리 › 운영 현황      | `/calendar/admin/overview`          | M/O        | `calendar.management` | I: `ADMIN.CALENDAR:VIEW+` | Management Nav; Guard 정합화 |
| `calendar.admin-company-calendars` | 운영 관리 › 회사 캘린더    | `/calendar/admin/company-calendars` | M/O        | `calendar.management` | I: `ADMIN.CALENDAR:VIEW+` | Management Nav; Guard 정합화 |
| `calendar.admin-policies`          | 운영 관리 › 일정 정책      | `/calendar/admin/policies`          | M/A        | `calendar.management` | I: `ADMIN.CALENDAR:VIEW+` | Management Nav; Guard 정합화 |

## 8. Workplace/Rooms — 12 (`W3`)

현재 Parent는 `APP.WORKPLACE` 하나이고 일부 항목은 `APP.ROOMS` 또는 `ADMIN.ROOMS`를 추가로
요구한다. Surface Guard에서 두 App Boundary를 독립 판정한다.

| Menu ID                       | 현재 그룹 › 메뉴                 | Path                                  | Plane/Task | 목표 Surface           | Item 조건                  | 결정                                |
| ----------------------------- | -------------------------------- | ------------------------------------- | ---------- | ---------------------- | -------------------------- | ----------------------------------- |
| `rooms.home`                  | 내 공간 예약 › 근무 공간 홈      | `/workplace/home`                     | W/W        | `workplace.work`       | I: `APP.WORKPLACE:VIEW+`   | Work Nav; Guard 정합화              |
| `rooms.explore`               | 내 공간 예약 › 공간 찾기         | `/workplace/explore`                  | W/W        | `workplace.work`       | I: `APP.WORKPLACE:VIEW+`   | Work Nav; Guard 정합화              |
| `rooms.find-rooms`            | 내 공간 예약 › 회의실 찾기       | `/workplace/rooms`                    | W/W        | `workplace.work`       | I: `APP.ROOMS:VIEW+`       | Work Nav; Parent·Guard 정합화       |
| `rooms.my-bookings`           | 내 공간 예약 › 내 공간 예약      | `/workplace/my-bookings`              | W/W        | `workplace.work`       | I: `APP.WORKPLACE:VIEW+`   | Work Nav; Guard 정합화              |
| `rooms.my-meetings`           | 내 공간 예약 › 내 회의 예약      | `/workplace/my-meetings`              | W/W        | `workplace.work`       | I: `APP.ROOMS:VIEW+`       | Work Nav; Parent·Guard 정합화       |
| `rooms.admin-overview`        | 근무공간 관리 › 운영 현황        | `/workplace/admin/overview`           | M/O        | `workplace.management` | I: `ADMIN.WORKPLACE:VIEW+` | Management Nav; Guard 정합화        |
| `rooms.admin-operations`      | 근무공간 관리 › 예약 운영·감사   | `/workplace/admin/operations`         | M/O        | `workplace.management` | I: `ADMIN.WORKPLACE:VIEW+` | Management Nav; Guard 정합화        |
| `rooms.admin-governance`      | 근무공간 관리 › 공간 거버넌스    | `/workplace/admin/governance`         | M/A        | `workplace.management` | I: `ADMIN.WORKPLACE:VIEW+` | Management Nav; Guard 정합화        |
| `rooms.admin-locations`       | 근무공간 관리 › 사업장 및 배치도 | `/workplace/admin/locations`          | M/A        | `workplace.management` | I: `ADMIN.WORKPLACE:VIEW+` | Management Nav; Guard 정합화        |
| `rooms.admin-policy`          | 근무공간 관리 › 공간 예약 정책   | `/workplace/admin/policies`           | M/A        | `workplace.management` | I: `ADMIN.WORKPLACE:VIEW+` | Management Nav; Guard 정합화        |
| `rooms.admin-room-operations` | 회의실 관리 › 회의 승인 운영     | `/workplace/admin/meeting-operations` | M/O        | `workplace.management` | I: `ADMIN.ROOMS:VIEW+`     | Management Nav; Parent·Guard 정합화 |
| `rooms.admin-room-policy`     | 회의실 관리 › 회의 예약 정책     | `/workplace/admin/meeting-policy`     | M/A        | `workplace.management` | I: `ADMIN.ROOMS:VIEW+`     | Management Nav; Parent·Guard 정합화 |

## 9. Mail — 15 (`W3`)

Parent는 `APP.MAIL`이다.

| Menu ID                     | 현재 그룹 › 메뉴            | Path                         | Plane/Task | 목표 Surface      | Item 조건             | 결정                              |
| --------------------------- | --------------------------- | ---------------------------- | ---------- | ----------------- | --------------------- | --------------------------------- |
| `mail.home`                 | 시작 › 메일 홈              | `/mail/home`                 | W/W        | `mail.work`       | P: App                | Work Nav                          |
| `mail.inbox`                | 메일함 › 받은 메일          | `/mail/inbox`                | W/W        | `mail.work`       | P: App                | Work Nav                          |
| `mail.sent`                 | 메일함 › 보낸 메일          | `/mail/sent`                 | W/W        | `mail.work`       | P: App                | Work Nav                          |
| `mail.drafts`               | 메일함 › 임시 보관함        | `/mail/drafts`               | W/W        | `mail.work`       | P: App                | Work Nav                          |
| `mail.archive`              | 메일함 › 보관함             | `/mail/archive`              | W/W        | `mail.work`       | P: App                | Work Nav; ACTIVE Menu; DRAFT PAGE |
| `mail.spam`                 | 메일함 › 스팸               | `/mail/spam`                 | W/W        | `mail.work`       | P: App                | Work Nav; ACTIVE Menu; DRAFT PAGE |
| `mail.trash`                | 메일함 › 휴지통             | `/mail/trash`                | W/W        | `mail.work`       | P: App                | Work Nav; ACTIVE Menu; DRAFT PAGE |
| `mail.folders`              | 메일함 › 내 폴더            | `/mail/folders`              | W/W        | `mail.work`       | P: App                | Work Nav; ACTIVE Menu; DRAFT PAGE |
| `mail.shared`               | 협업 › 공유 메일함          | `/mail/shared`               | W/W        | `mail.work`       | P: App                | Work Nav                          |
| `mail.organization`         | 개인 설정 › 폴더 및 규칙    | `/mail/organization`         | W/W        | `mail.work`       | P: App                | Work Nav; ACTIVE Menu; DRAFT PAGE |
| `mail.accounts`             | 개인 설정 › 연결된 계정     | `/mail/accounts`             | W/W        | `mail.work`       | P: App                | Work Nav                          |
| `mail.admin-overview`       | 메일 운영 › 운영 현황       | `/mail/admin/overview`       | M/O        | `mail.management` | I: `ADMIN.MAIL:VIEW+` | Management Nav; Guard 정합화      |
| `mail.admin-connections`    | 메일 운영 › 메일 연결       | `/mail/admin/connections`    | M/A        | `mail.management` | I: `ADMIN.MAIL:VIEW+` | Management Nav; Guard 정합화      |
| `mail.admin-shared-inboxes` | 메일 운영 › 공유함 운영     | `/mail/admin/shared-inboxes` | M/A        | `mail.management` | I: `ADMIN.MAIL:VIEW+` | Management Nav; Guard 정합화      |
| `mail.admin-policies`       | 메일 운영 › 보안 및 AI 정책 | `/mail/admin/policies`       | M/A        | `mail.management` | I: `ADMIN.MAIL:VIEW+` | Management Nav; Guard 정합화      |

위 신규 5개 메뉴는 Runtime Navigation에서는 `ACTIVE`이고 `APP.MAIL` Entitlement와
`mail.work-access.v1` Policy를 함께 사용한다. 다만 W3 Exact Authority의 PAGE 계약은 제품 Owner가
승인 Bundle로 승격하기 전까지 `DRAFT`이며 `110/111`에서 Fail Closed한다.

## 10. Messaging — 8 (`W3`)

Parent는 `APP.MESSAGING`이다.

| Menu ID                    | 현재 그룹 › 메뉴   | Path                       | Plane/Task | 목표 Surface           | Item 조건                  | 결정                         |
| -------------------------- | ------------------ | -------------------------- | ---------- | ---------------------- | -------------------------- | ---------------------------- |
| `messaging.home`           | 시작 › 홈          | `/messages/home`           | W/W        | `messaging.work`       | P: App                     | Work Nav                     |
| `messaging.inbox`          | 대화 › 받은 대화   | `/messages/inbox`          | W/W        | `messaging.work`       | P: App                     | Work Nav                     |
| `messaging.spaces`         | 대화 › Space 대화  | `/messages/spaces`         | W/W        | `messaging.work`       | P: App                     | Work Nav                     |
| `messaging.direct`         | 대화 › DM          | `/messages/direct`         | W/W        | `messaging.work`       | P: App                     | Work Nav                     |
| `messaging.people`         | 대화 › 구성원 찾기 | `/messages/people`         | W/W        | `messaging.work`       | P: App                     | Work Nav                     |
| `messaging.later`          | 작업 › 나중에 보기 | `/messages/later`          | W/W        | `messaging.work`       | P: App                     | Work Nav                     |
| `messaging.admin-overview` | 관리 › 운영 현황   | `/messages/admin/overview` | M/O        | `messaging.management` | I: `ADMIN.MESSAGING:VIEW+` | Management Nav; Guard 정합화 |
| `messaging.admin-policy`   | 관리 › 대화 정책   | `/messages/admin/policy`   | M/A        | `messaging.management` | I: `ADMIN.MESSAGING:VIEW+` | Management Nav; Guard 정합화 |

## 11. Video Meetings — 7 (`W3`)

Parent는 `APP.MEETINGS`이며 운영 정책은 `ADMIN.MEETINGS`로 분리한다. 회의 참가와 호스트 권한은
테넌트 관리자 권한이 아니라 회의별 참가자 역할로 판정한다.

| Menu ID                       | 현재 그룹 › 메뉴             | Path                           | Plane/Task | 목표 Surface          | Item 조건                 | 결정                         |
| ----------------------------- | ---------------------------- | ------------------------------ | ---------- | --------------------- | ------------------------- | ---------------------------- |
| `meetings.home`               | 시작 › 화상회의 홈           | `/meetings/home`               | W/W        | `meetings.work`       | P: App                    | Work Nav                     |
| `meetings.join`               | 시작 › 코드로 참가           | `/meetings/join`               | W/W        | `meetings.work`       | P: App                    | Work Nav                     |
| `meetings.mine`               | 회의 › 내 회의               | `/meetings/mine`               | W/W        | `meetings.work`       | P: App                    | Work Nav                     |
| `meetings.history`            | 회의 › 회의 기록             | `/meetings/history`            | W/W        | `meetings.work`       | P: App                    | Work Nav                     |
| `meetings.admin-operations`   | 관리 › 운영 현황             | `/meetings/admin/operations`   | M/O        | `meetings.management` | I: `ADMIN.MEETINGS:VIEW+` | Management Nav; Guard 정합화 |
| `meetings.admin-policies`     | 관리 › 회의 정책             | `/meetings/admin/policies`     | M/A        | `meetings.management` | I: `ADMIN.MEETINGS:VIEW+` | Management Nav; Guard 정합화 |
| `meetings.admin-intelligence` | 관리 › AI 및 데이터 거버넌스 | `/meetings/admin/intelligence` | M/A        | `meetings.management` | I: `ADMIN.MEETINGS:VIEW+` | Management Nav; DRAFT PAGE   |

## 12. Approvals — 15 (`W1a` Pilot)

Parent는 현재 `APP.APPROVALS`다. Pilot에서 `approvals.work`와 `approvals.admin` Guard를
독립시킨다.

| Menu ID                    | 현재 그룹 › 메뉴             | Path                             | Plane/Task | 목표 Surface      | Item 조건                                                      | 결정           |
| -------------------------- | ---------------------------- | -------------------------------- | ---------- | ----------------- | -------------------------------------------------------------- | -------------- |
| `approvals.home`           | 시작 › 전자결재 홈           | `/approvals/home`                | W/W        | `approvals.work`  | P: App                                                         | Work Nav       |
| `approvals.inbox`          | 내 결재 › 결재함             | `/approvals/inbox`               | W/W        | `approvals.work`  | I: `ACTION.APPROVAL_TASK:VIEW+`                                | Work Nav       |
| `approvals.completed`      | 내 결재 › 내 처리 완료함     | `/approvals/completed`           | W/W        | `approvals.work`  | I: `ACTION.APPROVAL_TASK:VIEW+`                                | Work Nav       |
| `approvals.new`            | 내 결재 › 새 결재 작성       | `/approvals/requests/new`        | W/W        | `approvals.work`  | I: 현재 `MANAGE` 또는 (`CREATE` AND `UPDATE`); v2 Exact 정합화 | Work Nav       |
| `approvals.drafts`         | 내 결재 › 임시 저장          | `/approvals/requests/drafts`     | W/W        | `approvals.work`  | I: `ACTION.APPROVAL_REQUEST:VIEW+`                             | Work Nav       |
| `approvals.submitted`      | 내 결재 › 내가 올린 결재     | `/approvals/requests/submitted`  | W/W        | `approvals.work`  | I: `ACTION.APPROVAL_REQUEST:VIEW+`                             | Work Nav       |
| `approvals.needs-info`     | 내 결재 › 보완할 결재        | `/approvals/requests/needs-info` | W/W        | `approvals.work`  | I: `ACTION.APPROVAL_REQUEST:VIEW+`                             | Work Nav       |
| `approvals.archive`        | 내 결재 › 완료 보관함        | `/approvals/requests/archive`    | W/W        | `approvals.work`  | I: `ACTION.APPROVAL_REQUEST:VIEW+`                             | Work Nav       |
| `approvals.delegations`    | 내 결재 › 결재 위임          | `/approvals/delegations`         | W/W        | `approvals.work`  | I: Delegation `VIEW` 또는 `MANAGE`                             | Work Nav       |
| `approvals.admin-overview` | 결재 관리 › 운영 개요        | `/approvals/admin/overview`      | M/O        | `approvals.admin` | I: `ADMIN.APPROVAL_OPERATIONS:VIEW+`                           | Management Nav |
| `approvals.workflows`      | 결재 관리 › 프로세스 설계    | `/approvals/admin/workflows`     | M/A        | `approvals.admin` | I: `ADMIN.APPROVAL_DESIGN:VIEW+`                               | Management Nav |
| `approvals.forms`          | 결재 관리 › 양식 카탈로그    | `/approvals/admin/forms`         | M/A        | `approvals.admin` | I: `ADMIN.APPROVAL_DESIGN:VIEW+`                               | Management Nav |
| `approvals.policies`       | 결재 관리 › 결재 정책        | `/approvals/admin/policies`      | M/A        | `approvals.admin` | I: `ADMIN.APPROVAL_POLICY:VIEW+`                               | Management Nav |
| `approvals.operations`     | 결재 관리 › SLA 및 전달 운영 | `/approvals/admin/operations`    | M/O        | `approvals.admin` | I: `ADMIN.APPROVAL_OPERATIONS:VIEW+`                           | Management Nav |
| `approvals.signatures`     | 결재 관리 › 전자서명 연계    | `/approvals/admin/signatures`    | M/A        | `approvals.admin` | I: `ADMIN.APPROVAL_SIGNATURE:VIEW+`                            | Management Nav |

## 13. Spaces — 11 (`W2`)

Parent는 `APP.SPACES`다.

| Menu ID                        | 현재 그룹 › 메뉴            | Path                            | Plane/Task | 목표 Surface        | Item 조건                            | 결정                         |
| ------------------------------ | --------------------------- | ------------------------------- | ---------- | ------------------- | ------------------------------------ | ---------------------------- |
| `spaces.home`                  | 개요 › Space 홈             | `/spaces/home`                  | W/W        | `spaces.work`       | P: App                               | Work Nav                     |
| `spaces.my-spaces`             | 내 Space › 내 Space         | `/spaces/my`                    | W/W        | `spaces.work`       | P: App                               | Work Nav                     |
| `spaces.discover`              | 내 Space › Space 탐색       | `/spaces/discover`              | W/W        | `spaces.work`       | P: App                               | Work Nav                     |
| `spaces.requests`              | 내 Space › 내 요청          | `/spaces/requests`              | W/W        | `spaces.work`       | P: App                               | Work Nav                     |
| `spaces.admin-overview`        | Space 운영 › 운영 현황      | `/spaces/admin/overview`        | M/O        | `spaces.management` | I: `ADMIN.SPACE_GOVERNANCE:VIEW+`    | Management Nav; Guard 정합화 |
| `spaces.admin-directory`       | Space 운영 › Space 디렉터리 | `/spaces/admin/directory`       | M/O        | `spaces.management` | I: `ADMIN.SPACE_GOVERNANCE:VIEW+`    | Management Nav; Guard 정합화 |
| `spaces.admin-requests`        | Space 운영 › 생성 요청      | `/spaces/admin/requests`        | M/O        | `spaces.management` | I: `ADMIN.SPACE_GOVERNANCE:VIEW+`    | Management Nav; Guard 정합화 |
| `spaces.admin-templates`       | Space 운영 › 템플릿         | `/spaces/admin/templates`       | M/A        | `spaces.management` | I: `ADMIN.SPACE_TEMPLATES:VIEW+`     | Management Nav; Guard 정합화 |
| `spaces.admin-content-reviews` | Space 운영 › 콘텐츠 검토    | `/spaces/admin/content-reviews` | M/O        | `spaces.management` | I: `ADMIN.SPACE_COMPLIANCE:VIEW+`    | Management Nav; Guard 정합화 |
| `spaces.admin-lifecycle`       | Space 운영 › 수명주기 검토  | `/spaces/admin/lifecycle`       | M/O        | `spaces.management` | I: `ADMIN.SPACE_ACCESS_REVIEW:VIEW+` | Management Nav; Guard 정합화 |
| `spaces.admin-operations`      | Space 운영 › 복구 및 운영   | `/spaces/admin/operations`      | M/O        | `spaces.management` | I: `ADMIN.SPACE_GOVERNANCE:VIEW+`    | Management Nav; Guard 정합화 |

## 14. HCM — 25 (`W1b` Pilot)

현재 HCM Guard는 여러 App, 역할, Reporting Relation과 Support Scope를 결합하고 허용 Audience를
한 Sidebar에 합친다. Pilot Surface는 `hcm.personal`, `hcm.team`, `hcm.operations`,
`hcm.management`로 고정한다.

| Menu ID                   | 현재 그룹 › 메뉴                | Path                         | Plane/Task | 목표 Surface     | 현재 조건 요약                                         | 결정                                                                            |
| ------------------------- | ------------------------------- | ---------------------------- | ---------- | ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `hcm.home`                | 홈 › HR 홈                      | `/hr/home`                   | W/W        | `hcm.personal`   | all; S `WORKFORCE_READ`                                | Personal Nav                                                                    |
| `hcm.me`                  | 나의 인사 › 나의 인사정보       | `/hr/me`                     | W/W        | `hcm.personal`   | all                                                    | Personal Nav                                                                    |
| `hcm.time`                | 나의 인사 › 나의 근태           | `/hr/time`                   | W/W        | `hcm.personal`   | all                                                    | Personal Nav                                                                    |
| `hcm.absence`             | 나의 인사 › 휴가                | `/hr/absence`                | W/W        | `hcm.personal`   | all                                                    | Personal Nav                                                                    |
| `hcm.benefits`            | 나의 인사 › 복리후생            | `/hr/benefits`               | W/W        | `hcm.personal`   | all                                                    | Personal Nav                                                                    |
| `hcm.pay`                 | 나의 인사 › 급여 명세           | `/hr/pay`                    | W/W        | `hcm.personal`   | all                                                    | Personal Nav                                                                    |
| `hcm.talent`              | 나의 인사 › 성장과 커리어       | `/hr/talent`                 | W/W        | `hcm.personal`   | all                                                    | Personal Nav                                                                    |
| `hcm.services`            | 나의 인사 › HR 도움 및 요청     | `/hr/services`               | W/W        | `hcm.personal`   | Nav `APP.EMPLOYEE_SERVICES:VIEW+`, Page exact `VIEW`   | Personal Nav; Guard 정합화                                                      |
| `hcm.directory`           | 조직 › 구성원 디렉터리          | `/hr/directory`              | W/W        | `hcm.personal`   | all; S `WORKFORCE_READ`                                | Personal Nav; Data boundary 확인                                                |
| `hcm.organization`        | 조직 › 조직 탐색                | `/hr/organization`           | W/W        | `hcm.personal`   | all; S `WORKFORCE_READ`                                | Personal Nav; Data boundary 확인                                                |
| `hcm.team`                | 팀 관리 › 내 팀                 | `/hr/team`                   | W/T        | `hcm.team`       | 실제 Reporting Relation 또는 Manager Authority         | Team Nav                                                                        |
| `hcm.team-time`           | 팀 관리 › 팀 근태 승인          | `/hr/team/time`              | W/T        | `hcm.team`       | 현재 `isManager`만, Target Population 없음             | Team Nav; Permission+Relationship+Target 추가                                   |
| `hcm.team-absence`        | 팀 관리 › 팀 휴가 승인          | `/hr/team/absence`           | W/T        | `hcm.team`       | 현재 `isManager`만, Target Population 없음             | Team Nav; Permission+Relationship+Target 추가                                   |
| `hcm.operations`          | HR 운영 › 운영 현황             | `/hr/operations`             | M/O        | `hcm.operations` | Workforce operation or Support Read                    | Operations Nav                                                                  |
| `hcm.time-operations`     | HR 운영 › 근태 운영             | `/hr/operations/time`        | M/O        | `hcm.operations` | I: `DATA.HR_TIME`                                      | Operations Nav; VIEW/APPROVE 정합화                                             |
| `hcm.absence-operations`  | HR 운영 › 휴가 운영             | `/hr/operations/absence`     | M/O        | `hcm.operations` | I: `DATA.HR_ABSENCE`                                   | Operations Nav; VIEW/APPROVE 정합화                                             |
| `hcm.benefits-operations` | HR 운영 › 복리후생 운영         | `/hr/operations/benefits`    | M/O        | `hcm.operations` | I: `DATA.HR_BENEFITS`                                  | Operations Nav; VIEW/APPROVE 정합화                                             |
| `hcm.pay-operations`      | HR 운영 › 급여 운영             | `/hr/operations/pay`         | M/O        | `hcm.operations` | I: `DATA.HR_PAY`                                       | Operations Nav; VIEW/APPROVE 정합화                                             |
| `hcm.talent-operations`   | HR 운영 › 인재 운영             | `/hr/operations/talent`      | M/O        | `hcm.operations` | I: `DATA.HR_TALENT`                                    | Operations Nav; VIEW/APPROVE 정합화                                             |
| `hcm.people`              | HR 운영 › 인력 정보             | `/hr/operations/people`      | M/O        | `hcm.operations` | Workforce operation or Support Read                    | Operations Nav                                                                  |
| `hcm.assignments`         | HR 운영 › 발령 현황             | `/hr/operations/assignments` | M/O        | `hcm.operations` | Workforce operation or Support Read                    | Operations Nav                                                                  |
| `hcm.organization-design` | 조직 설계 › 조직 설계           | `/hr/design/organization`    | M/A        | `hcm.management` | 현재 operator audience, Support `WORKFORCE_READ` 포함  | Management Nav; Support 차단+전용 capability                                    |
| `hcm.reference-data`      | 데이터 및 연계 › 인력 기준정보  | `/hr/data/reference`         | M/A        | `hcm.management` | 현재 `canOperate` + `ACTION.WORKFORCE_REFERENCE`       | Management Nav; Exact Action 정합화                                             |
| `hcm.data-operations`     | 데이터 및 연계 › 연계 및 정합성 | `/hr/data/integrations`      | M/O        | `hcm.management` | 현재 `canOperate` + `ACTION.WORKFORCE_DATA_OPERATIONS` | Management Nav; Exact Action 정합화                                             |
| `hcm.exports`             | 데이터 및 연계 › 통제형 반출    | `/hr/data/exports`           | M/O        | `hcm.management` | 현재 `canOperate` + `DATA.WORKFORCE:MANAGE`            | Management Nav; 신규 `ACTION.WORKFORCE_CONTROLLED_EXPORT:VIEW/EXPORT` + Step-up |

목표 계약은 Provider `WORKFORCE_READ`를 `hcm.operations` Read-only에만 허용하는 것이다. 현재는
HCM Direct Route와 People Service의 광범위 GET Prefix 때문에 Personal·Organization Design까지
열릴 수 있는 Gap이 있으므로 W1b 전에 Support 미활성 Provider 403, Endpoint+Method Allowlist와
Gateway Exact Capability Mapping을 선행한다. `hcm.organization-design`에는 전용 Granular
Capability와 API Predicate를 추가한다.

## 15. Tenant Admin Hub — 24 (`Keep`)

모든 행의 Plane은 `tenant-governance`, 목표 Shell은 `/admin`이다. 제품 운영 Route를 이 Hub로
되돌리지 않는다. 24개 행의 `navigationContextId`는 모두 `tenant.admin`이다.

| Menu ID                       | 현재 그룹 › 메뉴                   | Path                                      | Plane/Task | 현재 조건 요약                                                                  | 결정                                                           |
| ----------------------------- | ---------------------------------- | ----------------------------------------- | ---------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `admin.branding`              | 사용자 경험 › 브랜딩               | `/admin/experience/branding`              | TG/A       | Full Tenant Admin; S config                                                     | Keep                                                           |
| `admin.home-experience`       | 사용자 경험 › 홈 화면 설정         | `/admin/experience/home-experience`       | TG/A       | Full Tenant Admin; S config                                                     | Keep                                                           |
| `admin.home-composition`      | 사용자 경험 › 홈 구성 정책         | `/admin/experience/home-composition`      | TG/A       | Full Tenant Admin; S config                                                     | Keep                                                           |
| `admin.home-apps`             | 사용자 경험 › 홈 앱 구성           | `/admin/experience/home-apps`             | TG/A       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.preference-exceptions` | 사용자 경험 › 설정 예외 검토       | `/admin/experience/preference-exceptions` | TG/O       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.localization`          | 사용자 경험 › 다국어 스튜디오      | `/admin/experience/localization`          | TG/A       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.access`                | ID 및 접근 권한 › 접근 제어        | `/admin/identity/access`                  | TG/A       | `ADMIN.IDENTITY_DIRECTORY:VIEW`                                                 | Keep                                                           |
| `admin.app-governance`        | ID 및 접근 권한 › 앱 책임 관리     | `/admin/identity/app-governance`          | TG/A       | `APP_OWNER`, `APP_ACCESS_MANAGER`, `APP_ACCESS_APPROVER`, `APP_ACCESS_REVIEWER` | Keep scoped Hub; Preset 수명주기만 오케스트레이션              |
| `admin.app-access-requests`   | ID 및 접근 권한 › 앱 접근 요청     | `/admin/identity/app-access-requests`     | TG/O       | Access permission or scoped responsibility                                      | Keep scoped Hub                                                |
| `admin.access-reviews`        | ID 및 접근 권한 › 접근 권한 검토   | `/admin/identity/access-reviews`          | TG/O       | 현재 모든 non-provider direct exception                                         | **분해:** 캠페인 운영만 Hub, Named Reviewer Task는 Work로 이동 |
| `admin.roles`                 | ID 및 접근 권한 › 역할 및 권한     | `/admin/identity/roles`                   | TG/A       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.workforce-access`      | ID 및 접근 권한 › 인력 데이터 경계 | `/admin/identity/workforce-access`        | TG/A       | `ADMIN.WORKFORCE_ACCESS:MANAGE`                                                 | Keep                                                           |
| `admin.saved-view-custody`    | ID 및 접근 권한 › 저장 뷰 관리권   | `/admin/identity/saved-view-custody`      | TG/O       | `ADMIN.SAVED_VIEW_CUSTODY:VIEW`                                                 | Keep                                                           |
| `admin.provisioning`          | ID 및 접근 권한 › ID 프로비저닝    | `/admin/identity/provisioning`            | TG/A       | `ADMIN.IDENTITY_PROVISIONING:VIEW`                                              | Keep                                                           |
| `admin.catalog`               | 플랫폼 설정 › 카탈로그 탐색        | `/admin/platform/catalog`                 | TG/A       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.reference-data`        | 플랫폼 설정 › 기준정보             | `/admin/platform/reference-data`          | TG/A       | Full Tenant Admin                                                               | Keep; HCM 기준정보와 Scope 구분                                |
| `admin.registry`              | 플랫폼 설정 › 앱 레지스트리        | `/admin/platform/registry`                | TG/A       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.navigation`            | 플랫폼 설정 › 내비게이션           | `/admin/platform/navigation`              | TG/A       | Full Tenant Admin                                                               | Keep                                                           |
| `admin.productivity`          | 연계 및 자동화 › 생산성 커넥터     | `/admin/integrations/productivity`        | TG/A       | `ADMIN.PRODUCTIVITY_CONNECTOR:MANAGE`                                           | Keep                                                           |
| `admin.api-monitoring`        | 거버넌스 › API 모니터링            | `/admin/governance/api-monitoring`        | TG/O       | `ADMIN.API_MONITORING:VIEW`                                                     | Keep                                                           |
| `admin.audit-overview`        | 거버넌스 › 감사 관제               | `/admin/governance/audit-overview`        | TG/O       | `ADMIN.AUDIT_VIEW:VIEW`                                                         | Keep                                                           |
| `admin.audit-investigations`  | 거버넌스 › 조사 워크벤치           | `/admin/governance/audit-investigations`  | TG/O       | `ADMIN.AUDIT_INVESTIGATE:UPDATE`                                                | Keep                                                           |
| `admin.audit-events`          | 거버넌스 › 증적 탐색기             | `/admin/governance/audit-events`          | TG/O       | `ADMIN.AUDIT_VIEW:VIEW`                                                         | Keep                                                           |
| `admin.audit-governance`      | 거버넌스 › 증적 거버넌스           | `/admin/governance/audit-governance`      | TG/A       | `ADMIN.AUDIT_CONFIGURE:MANAGE`                                                  | Keep                                                           |

회사 관리 센터의 `admin.app-governance`는 위 네 책임의 직접 할당과 제품 관리자 Preset의
요청·승인·활성화·회수 수명주기를 오케스트레이션한다. `APP_CONFIG_ADMIN`과 제품 전문
Role·Exact Capability의 실행 UI는 각 앱 Management Workbench에 귀속되며, 이 Hub의 Deep Link나
Preset 승인이 회사 센터에 제품별 생성·수정·게시·운영 Action을 만들지는 않는다.

`admin.access-reviews`의 Backend 행 단위 Reviewer 제한은 유지한다. 분해 전까지 보안 우회는
아니지만 일반 Reviewer가 Admin Shell에 들어가는 의미 오류로 기록한다.

## 16. Provider Control Plane — 10 (`Keep`)

10개 행의 `navigationContextId`는 모두 `provider.control`이다.

| Menu ID                    | 현재 그룹 › 메뉴        | Path                         | Plane/Task | 조건                   | 결정                   |
| -------------------------- | ----------------------- | ---------------------------- | ---------- | ---------------------- | ---------------------- |
| `provider.overview`        | 운영 › 운영 지휘        | `/provider/overview`         | PC/O       | `ESTATE_READ`          | Keep                   |
| `provider.tenants`         | 운영 › 고객 및 테넌트   | `/provider/tenants`          | PC/A       | `ESTATE_READ`          | Keep                   |
| `provider.operations`      | 운영 › 변경 통제        | `/provider/operations`       | PC/O       | `ESTATE_READ`          | Keep                   |
| `provider.health`          | 운영 › 서비스 운영      | `/provider/health`           | PC/O       | `HEALTH_READ`          | Keep                   |
| `provider.featureRollouts` | 통제 › 기능 롤아웃      | `/provider/feature-rollouts` | PC/O       | `FEATURE_ROLLOUT_READ` | Keep                   |
| `provider.support`         | 통제 › 권한 있는 지원   | `/provider/support`          | PC/O       | `ESTATE_READ`          | Keep; 지원 세션 시작점 |
| `provider.commercial`      | 통제 › 구독 및 권한     | `/provider/commercial`       | PC/A       | `COMMERCIAL_READ`      | Keep                   |
| `provider.codeContracts`   | 통제 › 제품 계약        | `/provider/code-contracts`   | PC/A       | `CATALOG_READ`         | Keep                   |
| `provider.dataGovernance`  | 통제 › 데이터 거버넌스  | `/provider/data-governance`  | PC/A       | `DATA_GOVERNANCE_READ` | Keep                   |
| `provider.audit`           | 통제 › 거버넌스 및 감사 | `/provider/audit`            | PC/O       | `AUDIT_READ`           | Keep                   |

## 17. Account — 8 (`Keep`)

8개 행의 `navigationContextId`는 모두 `account.settings`다.

| Menu ID                 | 현재 그룹 › 메뉴            | Path                              | Plane/Task | 결정                                  |
| ----------------------- | --------------------------- | --------------------------------- | ---------- | ------------------------------------- |
| `account.profile`       | 계정 › 프로필               | `/account/profile`                | AC/W       | Keep                                  |
| `account.security`      | 계정 › 보안 및 세션         | `/account/security`               | AC/W       | Keep                                  |
| `account.appearance`    | 환경 설정 › 화면 모양       | `/account/settings/appearance`    | AC/W       | Keep                                  |
| `account.accessibility` | 환경 설정 › 접근성          | `/account/settings/accessibility` | AC/W       | Keep                                  |
| `account.language`      | 환경 설정 › 언어 및 지역    | `/account/settings/language`      | AC/W       | Keep                                  |
| `account.home`          | 환경 설정 › 홈 워크스페이스 | `/account/settings/home`          | AC/W       | Keep                                  |
| `account.notifications` | 환경 설정 › 알림            | `/account/settings/notifications` | AC/W       | Keep                                  |
| `account.managed`       | 조직 › 관리형 설정          | `/account/settings/managed`       | AC/W       | Keep; 정책 조회·예외 요청용 개인 화면 |

## 18. 동적 Route와 호환 목록

다음은 정적 187개에 추가하지 않지만 Surface Resolver와 회귀 Test에 포함한다. W0에서는 수기
목록을 `Alias/Index/Dynamic Matcher Registry`로 이전하고 문서 Snapshot과 Test를 같은 Registry에서
생성한다.

- Notifications `/notifications/center?view=priority|all|mentions|saved|later|done`
- DWAI·ON `/dwaion/conversations/:conversationId`
- Communications `/communications/:view/:storyId`
- Services `/services/:view/:requestId`
- Notifications `/notifications/center/:notificationId`
- Video Meetings `/meetings/room/:meetingId`
- Spaces `/spaces/:spaceKey/:tab?`
- Provider `/provider/tenants/:tenantId`
- HCM Organization Explorer의 Query/Tab Mode
- `/work`, `/activity`, `/dwaion`의 Query 기반 Index와 Unknown Fallback
- 각 Product Root의 Work→Management-only→Access State Resolver와 Wildcard 404
- `/admin?view=...`, `/admin/:section`, `/admin/people/:view` Resolver
- 중앙 Product Admin Legacy Redirect 14개
- DWAI·ON `/ask`, `/dwaion/admin/retention`
- Notification Legacy `/notifications/:notificationId`
- HCM Registry에 명시된 `/people/**`, `/workforce/**` Source 11개 Mapping
- `/admin/governance/audit` Legacy Route

HCM 미등록 Legacy Subpath는 자기 Redirect 대신 HCM Surface 404로 종료한다. `/rooms`는
`/workplace/home`, `/rooms/<suffix>`는 동일한 `/workplace/<suffix>` Canonical Route가 있을 때만
Query·Hash를 보존해 한 번 Redirect하며 대상이 없으면 Workplace Surface 404로 종료한다.

## 19. 검증 불변식

1. 정적 Menu ID와 Path는 각각 187개이고 중복이 없다.
2. Plane 합계는 `84 + 61 + 24 + 10 + 8 = 187`다.
3. Task 합계는 `89 + 3 + 47 + 48 = 187`다.
4. `management` 61개가 Work Sidebar에 나타나지 않는다.
5. 12개 주요 업무 앱의 Work·Team 77개가 Product Management Sidebar에 나타나지 않는다.
6. 전체 187개 Menu가 정확히 한 `navigationContextId`를 가지며, 업무 앱 139개는 정확히 한
   `productSurfaceId`도 가진다.
7. Legacy Alias는 정적 Menu를 추가하지 않고 대상 Canonical Route와 같은 Surface를 해석한다.
8. 동적 Detail Route는 Parent Menu의 Surface를 상속하되 Object 권한을 서버에서 다시 검사한다.
