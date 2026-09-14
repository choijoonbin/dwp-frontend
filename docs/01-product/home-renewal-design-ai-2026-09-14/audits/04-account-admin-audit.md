# 계정설정·관리콘솔 전반 전문가 감사

2026-09-14 현재 소스를 읽기 전용으로 조사했다. HEAD `8b9975e4e69a80e653618beae71305e91dd0d969`, 공유 트리에는 조사 시작 당시 추적 파일 변경 167개가 있었다. 제품 소스·설정·서비스를 수정하거나 테스트/게시/재기동하지 않았다. 이 문서는 **소스에서 확인한 기능과 설계 판단**을 구분한다. 현재 사용자 세션의 실제 권한·API 응답·서버 유효 정책은 검증하지 않았으며 소스만으로 런타임 정상 인증을 하지 않는다.

## 조사 범위와 집계

- 계정 탐색 전체: 3그룹 8개 메뉴. 프로필/보안, 화면모양/접근성/언어지역/홈/알림, 관리형 설정.
- 중앙 관리콘솔 전체: 5그룹 24개 정식 탐색 메뉴 + 직접 route를 유지하는 legacy 감사로그 1개.
- 홈 구성 내부: policy/catalog/blueprints 3탭; 역할/권한 내부: roles/assignments/privileged/effective 4탭, 특권 내부 4뷰까지 포함.
- 기존 33개 route 각각에 디자인 프롬프트가 있다. 추가 route 후보 10개는 미구현 제안이며 기존 메뉴 안의 탭/inspector/작업공간으로 흡수할 수 있다. 새 메뉴를 의무적으로 10개 추가하라는 요구가 아니다.
- 중앙 콘솔의 옛 소식/서비스/알림/Space 메뉴는 이미 제품별 관리 route로 이관되는 legacy redirect다. i18n label의 존재만으로 현재 중앙 메뉴가 있다고 판정하지 않았다.

[전체 메뉴 계약](../contracts/account-admin-menu-inventory.md)과 P07–P10은 모든 현행 메뉴를 포함한다. 사용자의 전반 리뉴얼 요구를 홈 관련 설정만으로 축소하지 않았다.

## 주요 판단: 지금 먼저 해결할 문제

### 1. 홈 모드가 어디서 결정되는지 발견하기 어렵다 · 높은 우선순위

**소스 사실:** `home-experience`는 배경·문구 studio이며 모드 선택은 `home-composition?tab=policy`에 있다. `HomeCompositionPolicy.experienceVariant`와 서버의 `effectiveExperienceVariant`는 다른 필드다. [모드·실제 적용 계약](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/home-experience-api.ts:38), [정책 탭](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/home-composition-manager.tsx:80).

**UX 판단:** “홈 화면 설정”이라는 이름에서 기대하는 모드 변경이 다른 메뉴 아래 정책 탭에 숨어 있다. 사용자가 Classic으로 돌아간 화면을 보아도 자기 설정, 조직 정책, runtime fallback 중 무엇이 원인인지 이해하기 어렵다.

**설계:** Classic 조직 포털 / Flow 개인 업무 실행 / Adaptive 문맥 실행(가칭 제안)을 목적·preview·지원 조건으로 비교한다. 설정값과 실제 적용값은 따로 표시하고 이유를 서버가 제공하지 않으면 추정하지 않는다. 모드를 바꾸기 전에 개인 뷰·기기 배치·미지원 위젯 영향을 확인한다.

### 2. 개인 홈 설정 메뉴가 실제 관리 시작점으로 너무 얕다 · 높은 우선순위

**소스 사실:** `/account/settings/home`은 설명과 홈 편집 이동 버튼이 핵심이며 `/?edit=home`으로 이동한다. [현행 홈 설정](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/pages/account/settings.tsx:543). 반면 home-personalization client에는 named views, active view, device layouts, revisions, templates, proposals 계약이 있다. [개인화 API](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/home-personalization-api.ts:1).

**UX 판단:** 별도 기능이 많아도 계정설정에서 현재 홈의 권위·활성뷰·표현폭·기기·개인화 권한을 읽을 수 없으면 기능 발견과 복원이 어렵다.

**설계:** 현재 홈 요약 + 모드(조직) / 표현폭(개인) / 앱·위젯배치(개인/관리) / view/device(개인) / 청사진(시작배치)를 나눈다. API client 존재는 runtime capability 보장이 아니므로 미지원/legacy 상태를 따로 둔다.

### 3. 동일 이름처럼 보이는 설정들이 서로 다른 저장 권위를 가진다 · 높은 우선순위

**소스 사실:** tenant mode/composition, launchpad, home visual content, personal preference, home preference, named views/device layouts는 별도 API다. [모드/정책](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/home-experience-api.ts:50), [표현/위젯 크기](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/home-preference-api.ts:20), [개인 설정](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/personal-preference-api.ts:16).

**UX 판단:** 모드/와이드/밀도/위젯너비/기기 override를 하나의 “레이아웃” control로 묶으면 사용자가 바뀌지 않은 기능으로 오인하거나 잘못 reset한다.

**설계:** control마다 `적용 대상·저장 범위·변경 권한`을 표시하고 personal reset은 테넌트 모드를 바꾸지 않는다. preview mode와 실제 mode도 구분한다.

### 4. 두 기존 모드를 같은 디자인의 변종으로 만들면 새 리뉴얼도 실패한다 · 높은 우선순위

**사용자 요구:** Classic는 첨부 내 앱 영역만 보존하며 나머지 전체를 개편한다. Flow는 개인 업무 실행, Classic는 조직 포털이라는 목적 차이가 한눈에 드러나야 한다. 제 3 모드는 AI 중심으로 혁신적인 화면을 별도 제안한다.

**설계:** 관리모드 비교 화면에서 정보 우선순위·대표 여정·권한·대상/구조 차이를 먼저 보여준다. 같은 위젯 grid에 색/배너만 바꾸는 안을 받지 않는다. AI 실행은 citation·허용 tool·confirmation·receipt·trace가 연결되어야 한다.

### 5. 위젯 라이브러리를 운영 marketplace처럼 오인하면 미지원 기능을 설계한다 · 높은 우선순위

**소스 사실:** catalog는 `WORKSPACE_WIDGET_CATALOG`를 읽고 선택 상세를 보여준다. [현재 빌드 카탈로그](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/home-widget-manager.tsx:78). 청사진은 서버 template query와 publish/revoke command다. [청사진 운영](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/home-widget-manager.tsx:332).

**UX 판단:** 동적 등록·버전·원천·permission·retired 정책 없이 미래 위젯을 단순 목록에 추가하면 빈카드/권한누락/실행 불확실성을 확장한다.

**설계:** 기존 catalog에서 등록 요청/계약 검증/구현 artifact 지원/version/pilot/철회 영향로 단계 확장. 현재 read-only build definition과 신규 운영 lifecycle을 구분. 소유권은 provider app과 홈표시/배치에 분리한다.

### 6. 게시·승인·복원 단계를 모든 메뉴에 똑같이 적용하면 기능을 발명하게 된다 · 높은 우선순위

**소스 사실:** 홈/브랜딩/앱 배치는 version-aware publish/update/rollback이 있으며 별도 approval chain은 확인되지 않았다. 다국어는 submit/decide/publish/restore가 있고 증적 정책에는 revision/submit/decide/publish/rollback이 있다. [홈 게시](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/home-experience-manager.tsx:363), [다국어 transitions](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/localization-studio.tsx:18), [증적정책 transitions](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/audit-governance.tsx:23).

**설계:** 현행 단계는 그대로 드러내되 고영향에는 preview/impact/confirmation/progress/recovery/audit를 강화한다. 별도 승인·예약·다중 domain조합게시·원자적 rollback은 신규 계약이다. affectedScopes가 누락된 구서버 이력의 복원 scope를 추정하지 않는다.

### 7. 역할·책임·신청·실행·최종 권한의 경계를 보이지 않게 하면 보안 UX가 틀린다 · 높은 우선순위

**소스 사실:** 중앙 access, app-governance, app-access-requests, access-reviews, roles, workforce-access가 서로 다른 renderer/API를 가진다. [전체 renderer](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/admin-content.tsx:18), [탐색 권한 정책](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/admin-access-policy.ts:30).

**UX 판단:** 모두 “권한관리” 동종 table이면 승인됐지만 실행되지 않은 접근, 앱 책임이지만 사용자권한 아닌 상태, 그룹 상속과 직접 역할을 혼동한다.

**설계:** 각메뉴의 핵심 질문을 별도로 설정하고 전후 diff·근거·유효기간·실행 증거·최종 권한 근거를 제공. 메뉴 visibility와 변경 권위는 별도다. 역할탭에서 최종 권한 검증은 read-only 조사로 디자인한다.

### 8. 중앙 콘솔의 모든 항목이 동등 탐색이면 운영 질문의 연결이 약하다 · 중간 이상 우선순위

**소스 사실:** 중앙 layout은 group collapse 및 active route에 따른 확장을 사용하며 permission으로 visible items를 필터한다. [그룹 탐색·권한](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/layouts/admin-layout.tsx:49).

**UX 판단:** 홈운영→source문제→permission→trace→audit가 각메뉴에 분리되어 정확한 복귀 맥락가 필요하다. 그룹별 landing/운영 센터를 보강하되 메뉴 수 자체를 늘리는 것을 목표로 삼지 않는다.

**설계:** context/URL/selection/drill-down 계약. 경험 운영 센터·원천 검증·quality 등의 제안은 기존 tab/작업공간에 흡수할 수 있다. 새질문·독립책임이 있으면 신규 메뉴를 허용한다.

### 9. 선택·필터·복귀 state 저장이 페이지마다 다르다 · 중간 이상 우선순위

**소스 사실:** 홈 구성 tab은 URL 쿼리, 감사 조사는 view/finding/case, evidence는 mode/query를 URL에 넣는다. 역할 및 권한 tab은 local useState다. [홈 tab](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/home-composition-manager.tsx:82), [조사 선택](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/audit-investigations.tsx:65), [역할 localtab](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/role-governance-manager.tsx:938).

**설계:** 업무조사에 필요한 scope/filter/tab/selection/inspector를 URL/저장 상태에 보존한다. 기존 구현이 이미 다 하는 것이라고 주장하지 않고 추가 개선으로 문서화한다.

### 10. 연결 활성·개인동의·sync 성공·홈신선도가 하나의 “연결됨”이 아니다 · 높은 우선순위

**소스 사실:** productivity connector는 lifecycle/health/policy, subject consent, 자원 유형별 run 상태/마지막 성공 동기화를 분리한다. 현재 provider는 MICROSOFT_GRAPH/DELEGATED로 한정된다. [연계 계약](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/productivity-connector-api.ts:5).

**설계:** state를 교차로 설명하고 MAIL 정상/CALENDAR stale의 partial 상태를 지원. 중앙과 개인 동의/재연결 source소유권을 유지. provider 추가나 수동 fullsync를 기존 기능이라고 그리지 않는다.

### 11. 계정알림은 별도 알림 앱으로 이동하므로 settings가 두개가 되면 안 된다 · 중간 우선순위

**소스 사실:** account notifications는 `/notifications/settings`로 redirect한다. 알림 preferences는 전달 프로필/실제 적용 설정/endpoints/유형별 수신 규칙/diagnostics·충돌 재평가를 다룬다. [redirect](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/pages/account/settings.tsx:573), [알림 API·복구](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/notifications/notification-preferences.tsx:16).

**설계:** 기존 앱 UI를 리뉴얼하고 계정 return context를 보존. 의무알림/개인선택/실제 채널 효과를 구분. 홈 count와 채널 전달를 같은권위로 판정하지 않는다.

### 12. 계정 프로필은 원천 읽기 전용이고 Provider에는 다른 경계가 있다 · 중간 우선순위

**소스 사실:** profile은 getMe를 조회한다. provider에 테넌트 전용 home/notifications/managed sections를 제한한다. [프로필](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/pages/account/profile.tsx:86), [provider account 경계](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/account/settings-navigation.ts:54).

**설계:** 프로필 edit처럼 꾸며내지 않고 원천 정정경로를 제시. Provider 브라우저 환경설정와 고객 테넌트 정책를 구분한다. support 실패를 자유로운 계정접근 허용으로 바꾸지 않는다.

### 13. 인력 정책·저장 뷰 이전·일회성 secret는 전혀 다른 작업 유형이다 · 높은 우선순위

**소스 사실:** workforce policy는 subject/population/데이터 군/READ·EXPORT/validity. custody는 preview 후 plan transfer 및 orphan lifecycle. SCIM은 일회성 secret create/rotate. [인력 policy](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/workforce-access-api.ts:28), [custody workflow](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/saved-view-custody-manager.tsx:98), [SCIM](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/identity-provisioning-manager.tsx:362).

**설계:** 직원 data를 가상으로만 사용, VIEW/EXPORT와 인력 집합 범위 분리. 저장 뷰 소유권이 접근 권한이전이 아님을 명시. 일회성 secret의노출/복사/닫기·회전영향·결과 불확실 복구를 설계. 평문 token을 일반목록/감사에 노출하지 않는다.

### 14. registry 타입은 API와 현재 등록 dialog 지원 범위가 다르다 · 중간 우선순위

**소스 사실:** API RegistryType은 API/DATA_PRODUCT를 포함하지만 등록 dialog의 types는 APP/CONNECTOR/AGENT/TOOL/POLICY다. [API 타입](/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/api/platform-registry-api.ts:14), [현재 dialog](/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/features/admin/registry-dialog.tsx:39).

**설계:** 신규 타입등록은 추가 제안. 코드 client union만 보고 모든 type UI동작을 보증하지 않는다. 등록·활성화·테넌트제공·홈배치·사용자 접근은 독립 상태.

### 15. 품질검증은 화면 렌더만 확인하면 부족하다 · 높은 우선순위

**근거:** [AGENTS 품질 계약](/Users/a10697/Work/DWP/dwp-frontend/AGENTS.md:53)에는 1440/1280/390/320, 200% zoom, theme/고대비/움직임 줄이기/keyboard/한·영/부분 실패, 대표 여정을 요구한다.

**설계:** 새 디자인 패킷에 각 메뉴의 정상/빈값/부분 실패/권한/진행/복구 prototype을 요구한다. 홈은 모드별 첫 화면의 차이, 와이드의 실제 효과, 승인 내 앱의 연속 정렬, 위젯 내부 스크롤 제거, 모드별 정보 위계, 신선도 정보 중복을 검증한다. AI는 현재 REFERENCE/REVIEW의 조회·검토와 실제 허용된 EXECUTE를 구분하고, 실행 영수증·trace를 지원되는 행동에서만 제공한다. 실제 증거가 없는 PASS 상태를 디자인 완료로 제출하지 않는다.

## 기능별 실제 renderer/API 근거표

| 범위                      | 실제 소스 진입점                                                                                                       | client/API 근거                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 계정 navigation8          | `features/account/settings-navigation.ts:14,56`                                                                        | `pages/account/settings.tsx:88,253,320,396,543,573,577`                                         |
| 프로필/보안               | `pages/account/profile.tsx:86`, `security.tsx:132`                                                                     | `api/auth-api.ts:465,550`; `features/account/my-privileged-access.tsx:6`                        |
| 관리형/예외               | `pages/account/settings.tsx:149,188`; `features/admin/preference-exception-manager.tsx:148`                            | `api/personal-preference-api.ts:51,76,119`                                                      |
| 관리 navigation24+legacy1 | `features/admin/admin-navigation.ts:75,289`                                                                            | `features/admin/admin-content.tsx:18` 25개 renderer                                             |
| 브랜딩                    | `features/admin/tenant-branding-manager.tsx:160`                                                                       | `api/tenant-branding-api.ts:46,60,90`                                                           |
| 홈화면                    | `features/admin/home-experience-manager.tsx:98,127,363`                                                                | `api/home-experience-api.ts:65,101,123`                                                         |
| 홈 정책/카탈로그/청사진   | `features/admin/home-composition-manager.tsx:80,137`; `home-widget-manager.tsx:78,332`                                 | `api/home-experience-api.ts:50`; `api/home-personalization-api.ts:156,306,336,349`              |
| 홈 앱구성                 | `features/admin/home-app-layout-manager.tsx:131,197`                                                                   | `api/home-experience-api.ts:15,29`; workspace apps query                                        |
| 다국어                    | `features/admin/localization-studio.tsx:69`                                                                            | `api/localization-api.ts:120,142,164,171,183,196,208`                                           |
| 접근제어                  | `features/admin/access-manager.tsx:15`                                                                                 | `api/identity-admin-api.ts:68` list/replaceRole                                                 |
| 앱 책임                   | `features/admin/app-governance-manager.tsx:13`; `app-admin-preset-manager.tsx:8`                                       | `api/app-governance-api.ts:158` dashboard + assignment/resource/preset transitions              |
| 앱 접근요청               | `features/admin/app-access-request-manager.tsx:145`                                                                    | `api/workspace-api.ts:718,727,743,757`                                                          |
| 접근 권한검토             | `features/admin/access-review-manager.tsx:283`                                                                         | `api/access-review-api.ts:4,94,122,143`                                                         |
| 역할/그룹/특권/최종 권한  | `features/admin/role-governance-manager.tsx:937`; `role-governance-layout.tsx:12`; `privileged-access-manager.tsx:111` | `api/access-governance-api.ts:16,90,103,184`; `api/privileged-access-api.ts:96,114,169,211,230` |
| 인력접근                  | `features/admin/workforce-access-manager.tsx:589`; `workforce-access-dialogs.tsx:27`                                   | `api/workforce-access-api.ts:5,28,50`                                                           |
| 저장 뷰 소유권            | `features/admin/saved-view-custody-manager.tsx:98,135`                                                                 | `api/saved-view-api.ts:239,259,269,283,292,306,317,328`                                         |
| SCIM                      | `features/admin/identity-provisioning-manager.tsx:362`                                                                 | `api/provisioning-admin-api.ts:41,46,58,69,79`                                                  |
| 카탈로그                  | `features/admin/catalog-explorer.tsx:280,304`                                                                          | `api/catalog-api.ts:166,182,191,202,209`                                                        |
| 기준정보                  | `features/admin/reference-data-manager.tsx:47`                                                                         | `api/platform-admin-api.ts:7,26,65,103`                                                         |
| registry                  | `features/admin/registry-manager.tsx:113`; `registry-dialog.tsx:39`                                                    | `api/platform-registry-api.ts:14,36` revision/activate/retire                                   |
| navigation                | `features/admin/navigation-studio-manager.tsx:196`                                                                     | `api/navigation-admin-api.ts:154,159,167,178,189,200`                                           |
| productivity              | `features/admin/productivity-connector-manager.tsx:288`                                                                | `api/productivity-connector-api.ts:5,17,39,80`                                                  |
| APImonitoring             | `features/admin/api-monitoring.tsx:104`                                                                                | `api/api-history-api.ts:127`; audit lookup                                                      |
| 감사관제/증적/조사/정책   | `audit-overview.tsx:200`; `audit-evidence-workspace.tsx:15`; `audit-investigations.tsx:60`; `audit-governance.tsx:413` | `api/audit-control-api.ts:395,402,495,598,617`                                                  |
| 감사 legacy               | `features/admin/admin-navigation.ts` LEGACY_ADMIN_ITEMS; `admin-content.tsx` audit                                     | `features/admin/audit-log.tsx` identity/platform audit aggregation                              |
| 옛 중앙 app관리 redirect  | `routes/administration-routes.tsx:179`                                                                                 | PRODUCT_LEGACY_ROUTE_SOURCE resolver; current product route contracts                           |

표 안의 경로는 `/Users/a10697/Work/DWP/dwp-frontend/apps/dwp/src/` 또는 `/Users/a10697/Work/DWP/dwp-frontend/libs/shared-utils/src/` 기준이다. 상세 링크는 각 판단에 제공했다. UI에 API 기술명을 불필요하게 노출하라는 뜻은 아니고 디자인/개발 인수인계 근거다.

## 리뉴얼 결과가 충족해야 할 대표 여정

1. 홈 운영자가 Classic 조직 포털과 Flow 개인 실행의 차이를 읽고, requested/effective와 개인 배치 영향을 확인한 후 정확한 scope의 정책을 게시/복원한다.
2. 구성원이 홈 설정에서 현재 mode/내 view/폭/기기/조직 관리 영역을 이해하고 개인 layout 저장 충돌을 복구한다.
3. 신규 미지 위젯이 현재 빌드 미지원 상태부터 계약/원천/권한/버전/검증/시범 적용/retirement의 책임 있는 여정을 거친다.
4. 앱 접근 신청의 판정→실제 IAM 실행→effective 검증이 같은 완료 상태로 묶이지 않는다.
5. 홈 source가 부분 실패했을 때 사용자 위젯은 성공 정보를 보존하고 운영자는 owner/permission/trace/원천 앱 recovery로 이어간다.
6. Adaptive AI가 읽은 근거와 허용 tool을 보여주고, 높은 영향 실행은 confirmation/진행/receipt/trace/복구와 연결되며 앱 owner의 업무 권위를 넘지 않는다.
7. 33개 현행 메뉴 모두 한·영/모바일/키보드/부분 실패 대표 여정을 디자인 패킷에 갖는다.

## 산출물

- [현행 33메뉴+제안 10route 계약](../contracts/account-admin-menu-inventory.md)
- [P07 계정설정 8메뉴+3제안](../prompts/07-account-settings.md)
- [P08 경험 6메뉴+카탈로그/청사진+3제안](../prompts/08-admin-home-and-experience.md)
- [P09 ID8+플랫폼 4메뉴+1제안](../prompts/09-admin-identity-and-platform.md)
- [P10 연계 1+거버넌스 5+legacy1+3제안](../prompts/10-admin-integrations-and-governance.md)
