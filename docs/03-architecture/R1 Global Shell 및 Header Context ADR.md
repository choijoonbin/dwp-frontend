# R1 Global Shell 및 Header Context ADR

- 상태: Accepted
- 적용일: 2026-08-13
- 대상: Personal Home, Business App, Product Area, Enterprise Space, Tenant Control Center,
  Provider Control Plane

> 후속 개정 검토(2026-08-21):
> [제품 업무·관리 Surface 분리 및 관리 Context ADR](R1%20제품%20업무·관리%20Surface%20분리%20및%20관리%20Context%20ADR.md)이
> 승인되면 Business App 안에 `Product Management` Shell Profile을 추가한다. 동일 Product
> Brand를 유지하되 Work와 Management의 Header Context, Navigation Collection, Scope와 복귀
> 동작을 분리한다. 이 확장은 기존 Global Utility 순서와 Shell Registry 소유 원칙을 바꾸지
> 않는다.

## 1. 결정 배경

DWP에는 홈, 일반 업무, HR, 테넌트 관리, 프로바이더 운영처럼 성격이 다른
Shell이 있다. 기존 구현은 각 Layout이 Header를 직접 조립하여 같은 사용자가 이동하는
동안 현재 앱 이름, Product Mark, Workspace, Global Utility의 위치와 명칭이 달라졌다.
이 차이는 업무 Context 차이가 아니라 공통 계약 부재에서 발생한 Drift다.

공식 제품 지침도 일관된 Shell을 요구한다.

- [IBM Carbon UI shell header](https://carbondesignsystem.com/components/UI-shell-header/usage/)는
  Header를 제품 간 지속되는 최상위 탐색·방향 인지 요소로 정의하고, 왼쪽에서 오른쪽으로
  Product Context에서 Global Utility 순서가 되도록 규정한다.
- [SAP Fiori shell bar](https://experience.sap.com/fiori-design-web/shell-bar/)는 모든 화면에
  공통 Shell Bar를 두고 현재 Product 또는 Application 이름, Search, Notification,
  User Profile을 제공하며 Logo는 Home으로 이동하도록 권고한다.
- [Microsoft Fluent Nav](https://fluent2.microsoft.design/components/web/react/core/nav/usage)는
  단순 탐색과 복합 Tree를 구분하고, 좁은 화면에서는 Inline Navigation을 Overlay로
  전환하며 분류와 순서를 일관되게 유지하도록 요구한다.

## 2. 정보 계층

DWP는 다음 세 계층을 섞지 않는다.

| 계층                | 표시 위치                     | 책임                             | 예시                                  |
| ------------------- | ----------------------------- | -------------------------------- | ------------------------------------- |
| Product identity    | Sidebar 상단 또는 Home Header | DWP 제품과 Home 복귀             | Digital Workplace                     |
| Application context | Global Header 왼쪽            | 현재 실행 중인 독립 앱·운영 영역 | 업무, HR, 관리 센터                   |
| Page context        | Main의 Page Header            | 현재 기능·객체·작업              | 구성원 찾기, 테넌트 브랜딩, 접근 권한 |

Application Context를 Page 제목으로 대체하지 않는다. Header는 Route가 깊어져도 현재 앱을
유지하고, Main의 Breadcrumb와 H1이 앱 안의 상세 위치를 설명한다.

## 3. Shell 계약

| Shell                    | Product identity         | Header context         | Work Context                     | Navigation width |
| ------------------------ | ------------------------ | ---------------------- | -------------------------------- | ---------------- |
| Personal Home            | Tenant Logo + DWP Lockup | 없음                   | 내 작업, Space 이동 가능         | 없음             |
| Business App             | DWP Lockup               | 현재 앱                | 내 작업 또는 지원되는 활성 Space | 248 / 72px Rail  |
| HR Product               | DWP Lockup               | HR                     | 내 작업 또는 지원되는 활성 Space | 248px            |
| Enterprise Space         | DWP Lockup               | Space                  | 현재 Space                       | 248 / 72px Rail  |
| Tenant Control Center    | 관리 센터 Lockup         | 관리 센터              | 고정 Tenant Scope                | 272px            |
| Provider Control Plane   | Provider Lockup          | Provider Control Plane | 미표시                           | 272px            |
| Provider Support Session | 관리 센터 Lockup         | 관리 센터              | Work Context 대신 Support Banner | 272px            |

- Tenant Logo는 개인 Home의 공동 Brand 영역에서만 표시한다. 업무·관리 Sidebar에는 고객사
  Logo를 반복하지 않아 현재 Product와 Tenant Scope를 혼동시키지 않는다.
- Sidebar의 Product Lockup 전체가 Home Link다. Icon과 Text의 클릭 범위가 다르지 않다.
- 단일 단계 업무·제품 Navigation은 248px를 사용한다. 여러 Group과 하위 메뉴가 있는
  Control Plane만 272px를 사용한다.
- Sidebar 접기 시 Header와 Main은 같은 시간에 남은 폭을 회수한다. Mobile Drawer는
  Canvas 폭을 바꾸지 않는다.

## 4. Header 순서

Desktop은 다음 순서를 고정한다.

1. Navigation Toggle
2. Application Context
3. Work Context(`내 작업` 또는 활성 Space) 또는 승인된 Support Context
4. Flexible Space
5. Global Search
6. Full Screen
7. Notification
8. Account Identity와 Avatar

Mobile은 `Menu → Application Context → Flexible Space → Search → Notification → Account`를
사용한다. Work Context와 Full Screen은 공간이 좁을 때 감추되 Account, Search,
Notification과 현재 앱 Context는 유지한다. Global Utility 위치는 Route마다 바꾸지 않는다.

Page 전용 생성·저장·내보내기·필터 명령은 Global Header에 넣지 않고 Page Header 또는
영향받는 Content 가까이에 둔다.

Account Identity는 이름과 Avatar를 항상 유지하고, 두 번째 줄은 HR 직책을 우선 표시한다.
직책이 없는 계정은 권한 역할을 대체 표시한다. Account Panel에서는 Email, 직책, 현재
권한 역할과 Work Context를 서로 다른 정보로 분리해 권한과 인사 정보를 혼동하지 않는다.

## 5. 구현 계약

- `ShellHeader`가 AppBar, Application Context, Work Context와 Global Utility 순서를 단독
  소유한다.
- `shellRegistry`가 Route별 Scope, Brand Mode, Work Context 노출, Application Context,
  Navigation Width와
  Header Surface를 소유하며 Layout은 Registry 밖에서 이 값을 재정의하지 않는다.
- Layout은 `context`, `desktopOffset`, `navigation`, `scope`만 전달한다.
- 현재 앱 이름은 Runtime Navigation Registry의 현재 Route Label을 우선하고, Registry를
  불러오지 못한 경우 다국어 Core Label을 사용한다.
- 모든 사용자 표시 Text는 Locale Resource에서 가져온다. Route 문자열이나 영문 Label을
  Layout에 직접 작성하지 않는다.
- Header에는 `header`, Sidebar에는 `aside/nav`, Main에는 `main` Landmark를 사용하고 모든
  Icon Button은 Accessible Name과 최소 40px Target을 가진다.
- Header는 CSS Container Query로 남은 폭을 판단하고 검색·계정 보조정보·Workspace와 Top
  Navigation을 단계적으로 축약한다. 인증·개인설정 Hydration 동안에는 같은 Registry 치수를
  사용하는 `ShellBootScreen`으로 Layout Shift를 억제한다.

## 6. Enterprise Space 확장 계약

- `Tenant`는 회사의 보안·계약·데이터 격리 경계이고, `Digital Workplace`는 Tenant의 DWP
  전체 제품 경험이다.
- `내 작업`은 여러 앱과 Space의 개인 업무를 모으는 가상 Context이며 Membership Entity가
  아니다.
- `Space`는 목적, Owner, Membership, Policy와 수명주기를 가진 Tenant 내부 Context다.
- Work Context Selector는 권한을 부여하지 않는다. 선택 후 Server가 App Entitlement,
  Space Membership, 원본 ACL과 Object Policy를 다시 평가한다.
- App Registry는 `NONE`, `TENANT`, `SPACE_OPTIONAL`, `SPACE_REQUIRED` 중 하나의 Context
  Capability를 선언한다. 지원하지 않는 앱은 활성 Space ID를 받지 않는다.
- Tenant Control Center는 일반 사용자의 Space Switcher를 사용하지 않고 고정 Tenant Scope와
  관리 대상 Space Deep Link를 구분한다.
- 세부 Domain·권한·수명주기는 `R2 Enterprise Space Platform ADR.md`를 따른다.

## 7. 검증 Gate

- Home, Business, HR, Space, Admin, Provider의 Application Context·Work Context·Utility 순서
- 1920px Expanded/Compact Reflow와 1280px·390px Responsive Layout
- 한국어·영어의 긴 Context Label Truncation과 Tooltip/Accessible Name
- Keyboard Focus, Drawer Open/Close, Home Link, Search Dialog와 Account Menu
- Axe 자동 접근성 검사와 Header 요소 간 겹침·잘림 시각 검사

Shell 계약을 변경하려면 이 ADR, `ShellHeader` Public API와 Shell Matrix E2E를 같은 변경에서
갱신한다.
