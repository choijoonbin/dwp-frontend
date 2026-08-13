# R1 HRIS Product Shell 및 Role-Aware Experience ADR

> 상태: Accepted and Implemented Local Baseline v1.2
>
> 기준일: 2026-08-14
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 결정

DWP는 임직원이 인사 경험을 찾을 때 `구성원`, `People`, `Workforce`라는 별도 제품을
선택하게 하지 않는다. 사용자에게는 하나의 **HRIS** 앱과 `/hr` 제품 Shell을 제공하고,
로그인한 사람의 관계와 권한에 따라 같은 Shell 안의 Navigation과 Home 내용을 편집한다.

단일 제품 경험은 단일 보안 권한을 의미하지 않는다. 다음 세 권한 경계를 계속 분리한다.

| 경계           | 책임                                              | 대표 권한                                           |
| -------------- | ------------------------------------------------- | --------------------------------------------------- |
| HR 제품 진입   | HR Home과 개인 HR 진입                            | `APP.HRIS:VIEW`                                     |
| 동료·조직 탐색 | 업무용 공개 Profile과 읽기 전용 조직 탐색         | `APP.PEOPLE_DIRECTORY:VIEW`                         |
| HR 운영        | Worker, 발령, Position, 비용, Scenario, HRIS 운영 | `APP.WORKFORCE_MANAGEMENT:VIEW`, `DATA.WORKFORCE:*` |

Frontend의 메뉴 은닉은 편의 기능일 뿐 보안 경계가 아니다. Backend는 기존의 Directory와
Workforce API 권한, Target Population, Field Masking을 요청마다 다시 강제한다. Tenant
Admin이나 Provider 역할만으로 민감 HR 데이터를 자동 허용하지 않는다.

## 2. 외부 기준 검증

공식 제품 문서에서 공통으로 확인한 기준은 제품을 여러 Portal로 쪼개는 것이 아니라,
하나의 개인화된 시작점에서 역할과 시점에 맞는 작업을 노출하는 것이다.

- [Workday Home](https://doc.workday.com/admin-guide/en-us/manage-workday/user-experience/people-experience/home-page/epj1594676779332.html)은
  Awaiting Actions, Timely Suggestions, Recommended Tasks와 Apps를 한 Home에 편집한다.
- [Oracle HCM Quick Actions](https://docs.oracle.com/en/cloud/saas/human-resources/faucf/quick-actions.html)은
  사용자 역할과 Security Privilege에 따라 접근 가능한 HR 작업만 제공한다.
- [SAP SuccessFactors Latest Home](https://help.sap.com/docs/successfactors-platform/managing-sap-successfactors-user-experience/overview-of-latest-home-page-user-experience)은
  역할 기반 Quick Action과 Dynamic Content를 Home에서 제공한다.
- [Microsoft Viva Connections Audience Targeting](https://learn.microsoft.com/en-us/viva/connections/use-audience-targeting-in-viva-connections)은
  역할·지역·조직 기반으로 Dashboard Card를 우선 노출하되 권한 자체를 대신하지 않는다고
  구분한다.
- [SAP Role-Based Permissions](https://help.sap.com/docs/successfactors-platform/using-role-based-permissions/latest-role-based-permissions)은
  역할과 Target Population을 함께 사용해 HR 데이터 범위를 통제한다.

DWP는 이 패턴을 채택하되, 근태·휴가·급여처럼 연결되지 않은 데이터를 예시 숫자로
채우지 않는다. 현재 연결된 Person Projection, Work Queue, Organization Graph, HRIS Run만
사용하고 원천이 없는 기능은 연결 필요 상태로 표현한다.

## 3. 역할별 경험

권한은 누적된다. Manager이면서 HR Operator인 사용자는 개인·팀·운영 메뉴를 모두 본다.

| Audience                | Navigation                                                                                  | Home 우선순위                                           |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 모든 구성원             | HR 홈, 나의 HR, 구성원 디렉터리, 조직 탐색                                                  | 내 Profile, HR 관련 열린 업무, 자주 쓰는 HR 진입점      |
| 실제 Manager            | 모든 구성원 메뉴 + 나의 팀                                                                  | 직속 구성원, 팀 규모, 팀 관련 후속 작업                 |
| HR Operator             | 모든 구성원 메뉴 + 인력 운영, 구성원 관리, 발령 관리, 조직 설계, 기준정보, 데이터 연계·반출 | Workforce Signal, 데이터 품질, 동기화 상태와 운영 Queue |
| 승인된 Provider Support | 허용 Scope에 해당하는 읽기 전용 운영 메뉴                                                   | 지원 Banner와 만료 시각, 허용된 Tenant 근거             |

Manager 여부는 표시용 직함 문자열로 추정하지 않는다. 현재 Person Projection의 실제
직속 구성원 관계를 우선하고, 전환 기간에만 명시적 Manager Role을 보조 근거로 사용한다.
HR Operator 여부는 역할 이름만이 아니라 Runtime Entitlement를 함께 만족해야 한다.

## 4. 경로와 전환 계약

| 목적                    | 표준 경로                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| HR Home                 | `/hr/home`                                                        |
| 나의 HR                 | `/hr/me`                                                          |
| 구성원 디렉터리         | `/hr/directory`                                                   |
| 조직 탐색               | `/hr/organization`                                                |
| 나의 팀                 | `/hr/team`                                                        |
| 인력 운영               | `/hr/operations`                                                  |
| 구성원·발령 운영        | `/hr/operations/people`, `/hr/operations/assignments`             |
| 조직 설계               | `/hr/design/organization`                                         |
| 기준정보·HRIS 연계·반출 | `/hr/data/reference`, `/hr/data/integrations`, `/hr/data/exports` |

기존 Bookmark와 감사 Deep Link를 깨지 않기 위해 `/people/**`, `/workforce/**`는 Query와
Hash를 보존한 채 대응하는 `/hr/**`로 Redirect한다. 신규 Navigation Registry와 Workspace
App은 `DWP_HRIS`와 `APP.HRIS`만 제품 진입점으로 사용한다. `DWP_PEOPLE`과
`DWP_WORKFORCE` 제품 항목은 Migration에서 비활성화하며, Backend bounded context와 API
이름은 데이터 소유권을 나타내므로 이 전환에서 억지로 통합하거나 Rename하지 않는다.

## 5. HR Home 편집 원칙

HR Home은 마케팅 Hero나 장식용 Dashboard가 아니다. 사용자가 5초 안에 현재 Context와
다음 행동을 판단하는 개인 Command Center다.

1. 상단 Context Band는 현재 사람·조직·직책을 짧게 확인하고 핵심 HR 작업으로 이동한다.
2. Quick Action은 최대 여섯 개를 우선 표시하며 권한이 없는 명령은 렌더링하지 않는다.
3. `확인할 일`은 실제 Workspace Work Queue의 HR 관련 항목만 사용한다.
4. `나의 정보`는 People Projection의 Source·기준일·Freshness와 함께 표시한다.
5. Manager와 HR Operator Section은 해당 Audience에만 나타나며, 정상적인 빈 상태와
   데이터 오류를 구분한다.
6. 숫자와 Chart는 비교 기준·기간·Drill-down이 있을 때만 사용한다. 연결되지 않은 휴가,
   급여, 근태, 학습 잔액을 합성하지 않는다.
7. Desktop은 밀도 있는 12-column Grid, Mobile은 행동 우선 단일 열을 사용한다. Page
   Section을 중첩 Card로 감싸지 않고 개별 반복 객체만 Surface로 표현한다.
8. 사용자는 공통 Personal Home Composer에서 권한이 허용된 Widget의 순서·표시·의미 크기와
   표현 모드를 조정한다. 저장·감사·서버 검증 계약은
   `R1 Multi-Surface Personal Home Composer ADR.md`를 따른다.

## 6. 구현·검증 계약

- `HrisLayout`이 하나의 Header Context와 역할 인지 Navigation을 소유한다.
- Auth의 불변 `person_public_id`를 People Projection의 `personId`와 연결 계약으로 사용한다.
  이메일과 표시 이름은 레거시·부분 동기화 계정의 제한된 Fallback으로만 사용한다.
- `useHrisExperience`가 이 연결 결과로 Manager·Operator·Support Audience를 계산한다.
- `visibleHrisNavigation`은 순수 함수로 유지해 역할 조합별 메뉴 계약을 단위 테스트한다.
- 직접 URL 접근도 `HrisPage`가 Audience와 Permission을 다시 검사해 허용되지 않은 화면을
  HR Home으로 복귀시킨다.
- 한국어·영어 Resource, 1280/1440/390px, Keyboard Focus, Axe, 구형 Deep Link Redirect를
  회귀 Gate로 둔다.
- 실제 고객 Delivery 전에는 HRIS Field Mapping, Target Population, 개인정보 Export 정책,
  최대 조직 규모와 Screen Reader를 별도 승인한다.
