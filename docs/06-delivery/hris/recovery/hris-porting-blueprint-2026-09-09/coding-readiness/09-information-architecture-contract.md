# HRIS 98-node information architecture contract

## 판정 범위

`hris-information-architecture-register.csv`는 기존 76개 목표 메뉴와 최신 HRIS capability가 추가한 22개 메뉴를 하나의 탐색 정본으로 합친다. `hris-shell-navigation-register.csv`는 이 98개 노드를 고정 HRIS 홈, 7개 workbench, 비사이드바 `/hr/explore` utility에 전량·단일 배정하는 shell 정본이다. `hris-workbench-task-group-register.csv`는 홈을 제외한 97개 노드를 7개 workbench 안의 46개 업무지향 그룹에 중복 없이 전량 배정한다. `ia-node-access-contract-register.csv`는 각 노드의 initial query/visibility/action/persona access path를 명시하고, 66개 신규 query는 `ia-entry-query-projection-register.csv`와 `ia-entry-query-projection-schemas.v1.json`에 닫힌 wire 계약으로 귀속한다. 이 산출물들은 G3 구현 입력이며 화면 구현 완료나 G6 운영 승인을 뜻하지 않는다.

사용자에게 98개 항목을 한 번에 펼치지 않는다. 왼쪽 사이드바는 `내 HR`, `팀`, `인사 운영`, `근태`, `급여`, `성과`, `설정`의 workbench entry만 유지하고, 각 workbench 안에서 overview tab, task-oriented sub-navigation, 검색/최근 항목, deep link를 제공한다. HRIS 홈은 메뉴 목록이 아니라 HRM·TIM·PAY·PER의 권한·범위·필드 정책을 재평가한 핵심 위젯 조합 화면이다.

Shell 순서는 `HRIS 홈` 고정 entry 다음에 위 7개 workbench이며, 업무 탐색은 사이드바 tree가 아니라 별도 `/hr/explore` utility다. 각 workbench는 `APP.HCM` entitlement와 허용된 descendant가 하나 이상일 때만 보인다. 기본 노드 권한이 없으면 첫 번째 허용 descendant로 이동하고, 허용 descendant가 없으면 entry 자체를 생략한다. deep link 진입과 widget 조회는 서버가 atomic duty·population·field(`VIEW/MASK/OMIT`)·purpose·SoD를 다시 판정한다.

## Sidebar 표현 결정 (2026-10-20)

아래 명칭은 사용자에게 보이는 **표현 계층**이며 기존 workbench ID, canonical route, owner와
98-node IA 권한 사실을 바꾸지 않는다. `인사 운영`은 HRM 운영 workbench의 봉인된 이름이고,
근태·급여·성과는 상위 `HR 운영` 그룹과 2차 업무 그룹에서 운영 문맥이 이미 드러나므로
`운영`을 반복하지 않는다. 개인·팀·운영·관리 화면을 한 `업무 영역` 아래 섞지 않는다.

| 표시 그룹 | 1차 항목 | 의미 |
|---|---|---|
| 시작 | `HRIS 홈` | 권한이 재평가된 개인·팀·운영 신호와 다음 행동 |
| 나와 팀 | `내 HR`, `팀` | 전 직원 self-service와 관계 기반 manager 업무를 분리 |
| HR 운영 | `인사 운영`, `근태`, `급여`, `성과` | HRM·TIM·PAY·PER 운영 workbench. 개인 근태·급여·성과는 여기가 아니라 `내 HR`에 속함 |
| 시스템 관리 | `설정` | HRIS 기준정보, 정책, workflow, 연계와 DWP 통제. 일반 Account 설정과 구분 |

2차 탐색은 선택된 workbench 하나에만 inline으로 표시한다. 현재 권한으로 갈 수 있는 실제
route만 보이며 아직 구현·등록·허가되지 않은 목표 route를 placeholder 메뉴로 만들지 않는다.
서버 navigation policy가 시행 중이면 서버 projection을 사용하고, 미가입/OFF 상태에서는 기존
Product Surface가 허가한 compatibility route만 같은 그룹 구조로 보여준다. projection 오류나
stale context는 fail-closed이며 빈 disclosure 화살표를 남기지 않는다.

| 1차 항목 | 봉인된 2차 업무 그룹 | 목표 노드 수 |
|---|---|---:|
| 내 HR | 내 정보 / 고용·문서 / 근태·휴가 / 급여·복리후생 / 목표·성장·커리어 / 신청·서비스·도움 | 14 |
| 팀 | 팀 현황 / 팀 근태·휴가 / 인사 변경 / 목표·평가 / 권한 위임 | 7 |
| 인사 운영 | 운영 현황·구성원 / 고용·발령·계약 / 조직·인력 계획 / 직원 서비스·문서 / 입사·이동·퇴직 / 채용·외부인력 / 데이터 품질·분석 | 17 |
| 근태 | 근태 운영 현황 / 근무제·스케줄 / 타각·판정 / 예외·보정 / 휴가·발생 / 마감·리포트 | 11 |
| 급여 | 급여 운영 현황 / 입력·계산 / 검증·결과 / 소급·정정 / 지급·회계 / 세금·보험·퇴직·연말정산 / 명세서·리포트 | 14 |
| 성과 | 성과 운영·주기·양식 / 평가 운영 / 다면·피드백·면담 / 캘리브레이션·결과 / 학습 운영 / 기회·승계 / 보상 계획 | 12 |
| 설정 | 기업·기준·인사 / 근태·휴가 정책 / 급여·법정 정책 / 성과·스킬·리스닝 / 워크플로·문서 / 연계·커넥터 / 확장·AI 거버넌스 / DWP 플랫폼 통제 | 23 |

메뉴 가시성은 `APP.HCM` 제품 접근, 현재 PAGE/route 권한, persona·관계·대상 범위,
설치 capability/country pack/feature rollout, tenant 및 legal-entity navigation policy의
교집합이다. Tenant policy는 기존 권한을 좁힐 수만 있고 새 권한을 만들 수 없다. URL 직접
진입과 API 호출도 같은 서버 권한 판정을 다시 거치므로 메뉴 숨김을 보안 경계로 사용하지 않는다.

반응형 계약은 다음과 같다.

- `1200px` 이상은 고정 sidebar, 사용자 compact 설정에서는 icon-only와 tooltip을 사용한다.
- `1200px` 미만은 focus 복원과 inert background를 가진 drawer를 사용한다.
- 320/390px 및 200% zoom에서도 선택 workbench의 2차 그룹을 한 열로 wrap하고 sidebar 자체를
  세로 scroll한다. 모바일에서 다른 화면으로 이동하면 drawer를 닫고 이동한 업무에 focus를 넘긴다.
- 긴 한국어·영어 명칭은 줄바꿈하며 색만으로 선택 상태를 전달하지 않는다.

## 행 계약

각 98개 행은 다음을 동시에 봉인한다.

- 소스: base 76은 pinned frontend catalog와 target-family register, modern 22는 modern capability/menu contract에서 생성한다.
- 책임: 단일 owner session과 실제 runtime owner를 명시한다.
- 탐색: 중복 없는 canonical route와 workbench tab, canonical route를 보존하는 object/widget deep-link template을 명시한다.
- 동작: base menu는 `source_family_refs`를 통해 exact TFR을 거쳐 `api_contract_refs`로 수렴한다. modern menu는 capability와 exact planned operation을 직접 참조한다.
- 접근: `entry_query_refs`, `visibility_capability_refs`, `action_contract_refs`, `action_capability_refs`를 분리한다. TFR 전체의 command capability 합집합을 메뉴 가시성으로 재사용하지 않는다. 5개 canonical persona 각각은 정확한 access package와 `VIEW` atomic duty를 거쳐 initial query capability에 도달해야 하며, auditor는 audit package/read-only projection 밖의 configuration/operations package로 우회할 수 없다. 공유 DWP query/action은 `ia-shared-authorization-exception-register.csv`의 cross-product entitlement·package·duty·SoD 행에 exact 귀속한다.
- 응답: browser 응답은 trusted tenant identifier를 반사하지 않는다. projection마다 closed query-state, freshness, opaque cursor, field-decision summary, partial failure/correlation, authorization-revision cache invalidation과 closed item/field-group schema를 요구한다. `VIEW/MASK`만 직렬화하고 `OMIT`은 해당 field group property 부재로 표현한다.
- 상태: 기존 pilot 5개만 `PILOT_CURRENT_RUNTIME_LIMITED_SCOPE`, 그 외는 `NOT_STARTED_G3` 또는 evidence-only 상태이며 전 행 production은 `NOT_AUTHORIZED_G6`다.

Base pilot의 `/hr/home`, `/hr/time`, `/hr/pay`, `/hr/talent`, `/hr/operations/people`은 현재 runtime 진입점이다. `/hr/me/**`, `/hr/team/**`, `/hr/operations/**`, `/hr/settings/**`가 확장 메뉴의 canonical namespace이며, pilot 경로 변경은 별도 compatibility/cutover 결정 없이는 허용하지 않는다. `/hr/admin/**`은 금지한다.

## BENSK 제외 및 경로 충돌

기존 BENSK `/hr/benefits`, `/hr/operations/benefits`는 이관 대상이 아니다. 범용 HRIS Benefits는 각각 `/hr/me/benefits`, `/hr/operations/employee-services/benefits`를 사용한다. `route-transition-register.csv`의 두 결정은 redirect와 데이터 공유를 금지하며, BENSK 폐기는 별도 제품 결정 없이는 수행하지 않는다.

## 재현 및 실패 기준

```bash
python3 coding-readiness/generate_information_architecture_register.py --check
python3 coding-readiness/generate_ia_entry_query_projection_schemas.py --check
python3 coding-readiness/validate_information_architecture.py --compact
python3 coding-readiness/validate_information_architecture.py --self-test --compact
python3 coding-readiness/validate_ia_node_access_contracts.py --compact
python3 coding-readiness/validate_ia_node_access_contracts.py --self-test --compact
```

generator는 98-node register, 9-row shell navigation register, 46-group task register와 66개 projection schema를 재현한다. IA validator는 pinned source에서 생성한 navigation register의 byte-for-byte 동일성과 route/shell/task closure를 검증한다. 독립 access validator는 generator를 import하지 않고 node별 GET/action 분리, projection/PEP/modern/shared contract resolution, owner/slice, 5 canonical persona, 31 package, 128 duty, 29 SoD, trusted tenant 비노출과 closed response schema를 검증한다. IA 30개 및 access/schema 54개 변조 중 하나라도 통과하면 중앙 G3 Gate는 열리지 않는다.
