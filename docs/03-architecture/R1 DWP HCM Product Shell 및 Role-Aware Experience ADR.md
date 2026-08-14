# R1 DWP HCM Product Shell 및 Role-Aware Experience ADR

> 상태: Accepted and Implemented Local Baseline v1.4
>
> 기준일: 2026-08-14
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

## 1. 결정

DWP는 임직원이 인사 경험을 찾을 때 `구성원`, `People`, `Workforce`라는 별도 제품을
선택하게 하지 않는다. 제품군은 **DWP HCM**, 사용자 앱은 한국어 **인사**·영어 **HR**로
표시하며 `/hr` 제품 Shell을 제공한다. `HRIS`는 외부 인사 시스템 연계 문맥에만 사용하고,
로그인한 사람의 관계와 권한에 따라 같은 Shell 안의 Navigation과 Home 내용을 편집한다.

단일 제품 경험은 단일 보안 권한을 의미하지 않는다. 다음 세 권한 경계를 계속 분리한다.

| 경계           | 책임                                              | 대표 권한                                           |
| -------------- | ------------------------------------------------- | --------------------------------------------------- |
| HR 제품 진입   | HR Home과 본인 Self-service                       | `APP.HCM:VIEW`                                      |
| HR 도움·요청   | 공통 Service Catalog를 통한 HR 요청과 진행 추적   | `APP.EMPLOYEE_SERVICES:VIEW`                        |
| 동료·조직 탐색 | 업무용 공개 Profile과 읽기 전용 조직 탐색         | `APP.PEOPLE_DIRECTORY:VIEW`                         |
| 팀 결정        | 실제 직속 구성원의 근태·휴가 결정                 | 유효일 보고 관계 또는 도메인 `APPROVE`              |
| HR 도메인 운영 | 근태·휴가·복리후생·급여·Talent 위임 운영          | `DATA.HR_{DOMAIN}:*`                                |
| Workforce 운영 | Worker, 발령, Position, 비용, Scenario, HRIS 연계 | `APP.WORKFORCE_MANAGEMENT:VIEW`, `DATA.WORKFORCE:*` |

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

DWP는 이 패턴을 채택하되 권위 데이터와 Local Reference를 혼동하지 않는다. 근태·휴가·
복리후생·급여·Talent의 Local Foundation은 `dataOrigin=REFERENCE`와 연결 상태를 함께
표시한다. 고객 Delivery에서는 승인된 Source Mapping을 거친 `SOURCE` 데이터만 권위 값으로
간주하며 원천이 없는 기능은 연결 필요 상태로 표현한다.

## 3. 역할별 경험

권한은 누적된다. Manager이면서 HR Operator인 사용자는 개인·팀·운영 메뉴를 모두 본다.

| Audience                | Navigation                                                                      | Home 우선순위                                           |
| ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 모든 구성원             | HR 홈, 인사정보, 근태, 휴가, 복리후생, 급여, 성장, HR 도움, 디렉터리, 조직 탐색 | 내 상태, 다음 행동, 실제 Quick Action                   |
| 실제 Manager            | 모든 구성원 메뉴 + 팀 개요·팀 근태·팀 휴가                                      | 직속 구성원 제출 Queue와 예외                           |
| 도메인 관리자           | 모든 구성원 메뉴 + 허용된 근태·휴가·복리후생·급여·Talent 운영                   | 허용 도메인의 준비 상태·예외·제출 Queue                 |
| Workforce Operator      | 모든 구성원 메뉴 + 인력 운영, 발령, 조직 설계, 기준정보, 데이터 연계·반출       | Workforce Signal, 데이터 품질, 동기화 상태와 운영 Queue |
| 승인된 Provider Support | 허용 Scope에 해당하는 읽기 전용 운영 메뉴                                       | 지원 Banner와 만료 시각, 허용된 Tenant 근거             |

Manager 여부는 표시용 직함 문자열로 추정하지 않는다. 현재 Person Projection의 실제
직속 구성원 관계를 우선하고, 전환 기간에만 명시적 Manager Role을 보조 근거로 사용한다.
도메인 관리자 여부는 역할 이름이 아니라 Runtime Permission을 기준으로 판정한다. Workforce
Operator 여부는 운영 역할, `APP.WORKFORCE_MANAGEMENT` Entitlement와
`DATA.WORKFORCE:VIEW|MANAGE`를 모두 만족해야 한다. 승인된 Provider Support는 별도의
시간 제한 Support Scope에 `WORKFORCE_READ`가 있을 때만 읽기 Context를 사용한다.

## 4. 경로와 전환 계약

| 목적                    | 표준 경로                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| HR Home                 | `/hr/home`                                                        |
| 나의 인사정보           | `/hr/me`                                                          |
| 나의 근태·휴가          | `/hr/time`, `/hr/absence`                                         |
| 복리후생·급여·성장      | `/hr/benefits`, `/hr/pay`, `/hr/talent`                           |
| HR 도움 및 요청         | `/hr/services`                                                    |
| 구성원 디렉터리         | `/hr/directory`                                                   |
| 조직 탐색               | `/hr/organization`                                                |
| 나의 팀                 | `/hr/team`, `/hr/team/time`, `/hr/team/absence`                   |
| 인력 운영               | `/hr/operations`                                                  |
| HR 도메인 운영          | `/hr/operations/{time,absence,benefits,pay,talent}`               |
| 구성원·발령 운영        | `/hr/operations/people`, `/hr/operations/assignments`             |
| 조직 설계               | `/hr/design/organization`                                         |
| 기준정보·HRIS 연계·반출 | `/hr/data/reference`, `/hr/data/integrations`, `/hr/data/exports` |

기존 Bookmark와 감사 Deep Link를 깨지 않기 위해 `/people/**`, `/workforce/**`는 Query와
Hash를 보존한 채 대응하는 `/hr/**`로 Redirect한다. 신규 Navigation Registry와 Workspace
App은 `DWP_HCM`과 `APP.HCM`을 정식 제품 진입점으로 사용한다. `DWP_HRIS`·`APP.HRIS`·
`hris-home`은 전환 기간의 호환 Alias로만 허용하고 신규 데이터는 `hcm-home`을 사용한다.
`DWP_PEOPLE`과
`DWP_WORKFORCE` 제품 항목은 Migration에서 비활성화하며, Backend bounded context와 API
이름은 데이터 소유권을 나타내므로 이 전환에서 억지로 통합하거나 Rename하지 않는다.

## 5. HR Home 편집 원칙

HR Home은 마케팅 Hero나 장식용 Dashboard가 아니다. 사용자가 5초 안에 현재 Context와
다음 행동을 판단하는 개인 Command Center다.

1. 상단 Compact Context는 현재 사람·조직·직책, 기준일과 데이터 최신성을 짧게 확인한다.
2. `Needs attention`은 실제 HR Workflow와 Aggregate에서 계산한 완료 가능한 행동을 최대
   세 건까지 우선 표시하며 사용자가 숨길 수 없다.
3. `People Rhythm`은 근태의 기록→검증→제출과 휴가·급여·복리후생·성장의 다음 이벤트를
   하나의 시간적 흐름으로 보여준다. 일반 Dashboard KPI를 반복하지 않는다.
4. 화면 이동만 수행하는 링크는 `HR 도구`로 분리하고 현재 화면에서 완료되지 않는 기능을
   Quick Action으로 부르지 않는다.
5. 개인 신호는 출처·기준일과 함께 표시하며 Reference Seed를 고객 실제 데이터처럼 보이게
   하지 않는다.
6. Manager와 HR Operator Context는 개인 화면에 누적하지 않고 명시적으로 전환한다. 해당
   Audience에만 나타나며, 정상적인 빈 상태와
   데이터 오류를 구분한다.
7. 숫자와 Chart는 비교 기준·기간·Drill-down이 있을 때만 사용한다. 연결되지 않은 값을
   합성하지 않고 `REFERENCE`, `SOURCE`, 연결 대기 상태를 구분한다.
8. Desktop은 밀도 있는 12-column Grid, Mobile은 행동 우선 단일 열을 사용한다. Page
   Section을 중첩 Card로 감싸지 않고 개별 반복 객체만 Surface로 표현한다.
9. 사용자는 공통 Personal Home Composer에서 권한이 허용된 Widget의 순서·표시·의미 크기와
   표현 모드를 조정한다. 저장·감사·서버 검증 계약은
   `R1 Multi-Surface Personal Home Composer ADR.md`를 따른다.

## 6. 구현·검증 계약

- `HcmLayout`이 하나의 Header Context와 역할 인지 Navigation을 소유한다.
- Auth의 불변 `person_public_id`를 People Projection의 `personId`와 연결 계약으로 사용한다.
  이메일과 표시 이름은 레거시·부분 동기화 계정의 제한된 Fallback으로만 사용한다.
- `useHcmExperience`가 이 연결 결과로 Manager·Operator·Support Audience를 계산한다.
- `visibleHcmNavigation`은 순수 함수로 유지해 역할 조합별 메뉴 계약을 단위 테스트한다.
- 직접 URL 접근도 `HcmPage`가 Audience와 Permission을 다시 검사해 허용되지 않은 화면을
  HR Home으로 복귀시킨다.
- HR API는 Request의 Worker ID가 아니라 검증된 `person_public_id`로 본인을 결정하고,
  Manager 결정은 실제 보고 관계 또는 `DATA.HR_{DOMAIN}:APPROVE|MANAGE`를 다시 검사한다.
- Home API는 서버가 결정한 Worker Scope만 조회한다. 급여·복리후생·Talent를 Tenant 전체에서
  추정하지 않으며 유효일 기준의 현재 Work Relationship과 Assignment를 사용한다.
- 응답은 `asOf`, `generatedAt`, `timeZone`, `standardDayMinutes`를 포함한다. Frontend는 브라우저
  시각이나 480분 상수를 업무 기준으로 대신 사용하지 않는다.
- 각 Domain은 `availability`, `dataOrigin`, `reason`을 독립적으로 제공한다. 유효한 `0`, 권한
  없음, 미연결, 부분 실패와 `REFERENCE`를 서로 바꾸어 표시하지 않는다. 한 Domain 장애가
  전체 Home 500으로 확산되지 않도록 격리한다.
- 고객 Runtime에서는 Source 장애를 Seed나 Reference 값으로 조용히 대체하지 않는다.
  Reference 데이터는 명시적 검증 환경에서만 표식과 함께 사용한다.
- Team과 Operations Aggregate는 선택된 Context와 권한이 있을 때만 지연 조회하고 목록 대신
  Count·요약 Query를 우선한다. 개인 사용자의 Home 요청으로 Tenant 운영 Queue를 조회하지 않는다.
- `ppl_*`은 Core HR Projection을 유지하고 `tme_*`, `abs_*`, `bnf_*`, `pay_*`, `tal_*`이
  독립 업무 수명주기를 소유한다. 급여 금액은 저장하지 않고 보안 문서 참조만 유지한다.
- HR 문의·증명서·인사정보 변경은 별도 HR Case Table을 만들지 않고 Platform의 `svc_*`
  Catalog·Request·Timeline Aggregate를 재사용한다. HR Shell은 Category Scope와 Deep Link만
  소유하며 상태 전이·SLA·감사는 공통 Employee Service Center가 소유한다.
- 제출된 휴가의 본인 철회는 `cancelled_at`, `cancelled_by`, `cancellation_note`와 Version을
  보존하고 Pending Balance를 원복한다. 승인 후 취소는 회사·국가 정책이 필요한 별도
  Workflow이며 단순 상태 변경으로 처리하지 않는다.
- Aggregate Version, Tenant 복합 FK, 휴가 Range Exclusion, Audit Outbox를 쓰기 Gate로 둔다.
- 한국어·영어 Resource, 1280/1440/390/320px, 200% Zoom, Keyboard Focus, Axe, Reduced Motion,
  Desktop·Mobile Visual 기준선과 구형 Deep Link Redirect를 회귀 Gate로 둔다.
- 실제 고객 Delivery 전에는 HRIS Field Mapping, Target Population, 개인정보 Export 정책,
  최대 조직 규모와 Screen Reader를 별도 승인한다.

## 7. 제품별 경험 프로필

공통 Design System을 분기하지 않으면서 업무 성격을 명확히 하기 위해 Product Shell은
`Product Experience Profile`을 적용한다.

| 제품      | Concept         | 시각·상호작용 우선순위                              |
| --------- | --------------- | --------------------------------------------------- |
| DWP HCM   | `people-flow`   | 편안한 밀도, 사람·여정·지원 행동, Teal과 Coral 신호 |
| Calendar  | `temporal-flow` | 시간축·가용성·충돌, Blue와 Cyan 신호                |
| Approvals | `decision-flow` | 근거·위험·결정 상태, Ink Blue와 Amber 신호          |

Profile은 Canvas, Sidebar, Selection, Accent, Density만 정의한다. Button 의미, Form,
상태색, Focus, 반응형, 고대비·Dark Mode 계약은 공통 Design System을 그대로 사용한다.
