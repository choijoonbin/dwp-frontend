# 2026-10-20 HRIS Navigation Experience Successor

> 상태: `DECIDED` — 기존 IA·권한 계약을 변경하지 않는 presentation successor
>
> 적용 대상: DWP HRIS shell navigation, workbench task navigator, `/hr/explore`
>
> 비적용 대상: 기존 봉인 IA 문서, canonical node/route/owner, 권한·tenant policy 의미

## 1. 결정 요약

HRIS 탐색은 다음의 세 계층으로 구성한다.

1. 왼쪽 **1차 rail**에는 `HRIS 홈`과 권한이 있는 7개 workbench만 표시한다.
2. workbench를 선택하면 rail 바로 오른쪽의 **인접 task navigator**에서 해당 workbench의
   허용된 업무 그룹과 leaf task를 검색·선택한다.
3. 전체 HRIS 업무의 검색, 즐겨찾기, 최근 업무, 진행 중 업무는 기존의 공식 utility인
   **`/hr/explore`**가 담당한다.

base 98개 또는 현재 runtime successor 99개 IA 노드를 좁은 sidebar 안에 accordion이나 긴 inline
tree로 펼치지 않는다.
오른쪽 화면 끝의 inspector도 navigation 용도로 사용하지 않는다. 전자는 대규모 메뉴의 발견성과
스캔 효율을 떨어뜨리고, 후자는 상세 정보와 문맥 행동을 표시하는 workspace 영역의 의미를 훼손한다.

이 결정은 navigation의 표현과 interaction을 교체하는 결정이다. 현재 runtime의 7개 workbench,
46개 task group, canonical node ID·route·owner·display order 및 서버 권한 판정은 변경하지 않는다.

## 2. 현재 메뉴 source의 정확한 구조

현재 구조는 "모든 메뉴를 한 DB 메뉴 테이블에서 조회"하는 구조도 아니고, "프론트가 모든 메뉴를
임의 하드코딩"하는 구조도 아니다. 다음 네 source가 서로 다른 책임을 가진 혼합 구조다.

| 계층                       | 현재 source                                                                        | 책임                                                                | HRIS 내부 task 메뉴에 대한 역할                  |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| DWP 앱 런처                | backend `adm_navigation_items`, `adm_navigation_labels`                            | tenant별 DWP `GROUP`/`APP`, 앱 route, registry entry, label         | HRIS 앱으로 들어오는 상위 앱 entry만 담당 가능   |
| HRIS 정본 IA               | 봉인 register와 생성 산출물, frontend runtime manifest, backend canonical topology | 7 workbench, 46 group, canonical node·route·순서·owner              | HRIS 내부 메뉴 구조의 정본                       |
| tenant/legal-entity policy | `hris_navigation_policy_v2_*` revision/effective aggregate                         | 정본 구성원 중 사용할 workbench/group/node를 축소하고 publish       | 정본 밖의 route나 권한을 만들 수 없음            |
| 사용자 runtime projection  | navigation projection API + Product Surface PAGE authority                         | 현재 tenant, legal entity, rollout, entitlement, PAGE 권한을 교집합 | 실제 화면에 보일 workbench/task의 최종 허용 집합 |

### 2.1 `adm_navigation_items` 미사용 범위

`adm_navigation_items`의 `item_type`은 DB constraint상 `GROUP` 또는 `APP`뿐이다. `APP`은
`registry_entry_key`, `/`로 시작하는 route, `required_resource_key`를 가져야 한다. 이 테이블과
`adm_navigation_labels`는 DWP 앱 catalog/launcher와 Navigation Studio의 source다.

그러나 HRIS 화면의 다음 항목은 `adm_navigation_items`에서 읽지 않는다.

- `HRIS 홈`, `내 HR`, `팀`, `인사 운영`, `근태`, `급여`, `성과`, `설정`의 shell 구성
- 각 workbench의 46개 task group
- 각 group 아래 canonical leaf node와 route alias
- HRIS navigation policy의 tenant/legal-entity effective projection

따라서 "현재 HRIS sidebar의 모든 메뉴가 공통 메뉴 테이블에 등록되어 있다"는 설명은 사실이 아니다.
정확한 설명은 **공통 DB 메뉴는 앱 진입을 담당하고, HRIS 내부 navigation은 별도의 typed canonical
catalog와 policy projection을 사용한다**는 것이다.

근거 구현은 다음과 같다.

- 공통 앱 메뉴 스키마:
  `dwp-backend/dwp-platform-server/src/main/resources/db/migration/V5__add_navigation_localization_and_admin_command_foundation.sql`
- frontend shell 후보와 고정 grouping:
  `apps/dwp/src/features/hris/shell/model/hris-shell-navigation-contract.ts`
- frontend runtime topology:
  `apps/dwp/src/features/hris/shell/model/hris-runtime-navigation-manifest.ts`
- backend canonical topology:
  `dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/hrisconfiguration/navigationpolicy/NavigationPolicyAggregateV2Canonical.java`
- tenant/legal-entity aggregate:
  `dwp-backend/dwp-platform-server/src/main/resources/db/migration/V329__create_hris_navigation_policy_aggregate_v2.sql`
- runtime policy와 PAGE route 교집합:
  `apps/dwp/src/features/hris/shell/navigation-policy/hris-navigation-policy-runtime.tsx`

### 2.2 현재 runtime 선택 규칙

- `ENFORCED` policy는 서버가 반환한 workbench/group/node만 후보가 된다.
- 후보 node의 route alias 중 현재 Product Surface가 허용한 PAGE route만 남긴다.
- stale authority, invalid projection 또는 fail-closed 상태에서는 task를 노출하지 않는다.
- `OFF`, `NOT_ENROLLED`, `SHADOW`는 정적 compatibility topology를 사용하되, 현재 허용된 route의
  범위를 벗어나지 않는다.
- 메뉴 숨김은 보안 경계가 아니다. deep link와 API는 서버에서 권한, population, field, purpose,
  SoD를 다시 판정한다.

## 3. 기존 표현의 문제

기존 2차 navigation은 선택된 workbench의 group과 leaf를 248px sidebar 안에 inline으로 이어 붙였다.
이 표현은 적은 수의 링크에는 동작하지만 HRIS 규모에서는 다음 문제가 있다.

1. workbench별 7~23개 leaf와 group heading이 1차 navigation과 같은 세로 흐름을 차지해 현재 위치와
   선택 가능한 업무가 섞인다.
2. sidebar의 폭이 짧은 한국어 label에는 간신히 맞고 긴 한국어·영어 label에서는 과도한 줄바꿈과
   scroll을 만든다.
3. compact rail에서 2차 navigation을 감추면 사용자가 leaf task에 도달할 수 없는 dead end가 생긴다.
4. accordion을 추가하더라도 사용자가 어느 group을 열어야 하는지 먼저 알아야 하므로 발견성이
   해결되지 않고 click 수만 증가한다.
5. 이미 검색·즐겨찾기·최근·진행 중 업무를 제공하는 `/hr/explore`가 navigation에서 보이지 않아
   사용자가 강력한 탐색 기능을 발견하기 어렵다.
6. leaf마다 동일한 시각 무게를 주면 실제 업무 우선순위와 workbench 경계가 약해진다.
7. 선택 표시, disclosure 상태, panel 상태, 실제 route의 `aria-current`가 한 control에 혼재될 수 있다.
8. base 98개/current successor 99개 전체 IA가 확장될수록 sidebar rendering, keyboard 이동,
   회귀 테스트의 비용이 선형으로 증가한다.

문제의 원인은 IA의 크기 자체가 아니라 **대규모 IA를 작은 1차 rail에 직접 투영한 presentation**이다.

## 4. 사용자, 질문, 행동, archetype

### 4.1 경험 단위 계약

| 경험 단위                | 주 사용자                                                                  | 사용자가 답하려는 질문                                                                    | 주 행동                                                 | archetype                         |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| 1차 HRIS rail            | 모든 HRIS entitlement 사용자                                               | "내가 들어갈 수 있는 업무 영역은 무엇인가?"                                               | workbench 선택 또는 홈 이동                             | application navigation            |
| workbench task navigator | 직원, manager, HR operator, payroll/time/performance operator, 설정 관리자 | "이 업무 영역에서 지금 허용된 정확한 업무는 무엇인가?"                                    | group scan, 내부 검색, leaf route 이동                  | navigation flyout / task launcher |
| `/hr/explore`            | 반복 업무 또는 여러 module을 오가는 사용자                                 | "업무 이름을 모르거나 위치를 기억하지 못해도 어떻게 찾고, 최근 작업을 어떻게 재개하는가?" | 전체 검색, 즐겨찾기, 최근 업무, 진행 중 업무 재개       | command center                    |
| navigation policy 관리   | tenant HRIS 관리자와 승인자                                                | "회사 또는 legal entity에 어떤 canonical 메뉴를 언제 적용할 것인가?"                      | draft, validate, maker-checker approve, publish/restore | studio + workflow                 |

`application navigation`과 `navigation flyout`은 업무 page 자체가 아니므로 command center용 KPI나
card를 추가하지 않는다. `/hr/explore`만 탐색·재개 질문을 해결하는 command center다.

### 4.2 persona별 기대 행동

| persona          | 기본 진입                 | 자주 쓰는 경로                              | navigation이 보장할 것                                        |
| ---------------- | ------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| 직원             | HRIS 홈 또는 내 HR        | 내 정보, 휴가, 급여, 목표, HR 요청          | 운영자 메뉴를 섞지 않고 self-service를 먼저 찾음              |
| manager          | 팀                        | 팀 현황, 팀 근태, 변경, 평가, 위임          | 관계 기반 PAGE 권한과 legal-entity 문맥을 보존                |
| HR 운영자        | 인사 운영                 | 고용, 발령, 조직, 서비스, 이동, 데이터 품질 | 많은 leaf를 group 단위로 비교하고 내부 검색 가능              |
| 전문 운영자      | 근태, 급여, 성과          | 예외, 계산, 검증, 평가, 보상 계획           | module별 workbench 경계를 유지하고 deep link 선택 상태를 복원 |
| HRIS 관리자      | 설정                      | 정책, workflow, 연계, 확장, 플랫폼 통제     | 일반 계정 설정과 HRIS 정책 설정을 명확히 분리                 |
| 감사·지원 사용자 | 권한으로 허용된 workbench | read-only projection, audit route           | 허용되지 않은 운영 command가 menu를 통해 암시되지 않음        |

## 5. 목표 information architecture와 UX

### 5.1 1차 rail

1차 rail은 다음 안정된 표현 계층만 갖는다.

| 표시 그룹   | 1차 항목                            |
| ----------- | ----------------------------------- |
| 시작        | `HRIS 홈`                           |
| 나와 팀     | `내 HR`, `팀`                       |
| HR 운영     | `인사 운영`, `근태`, `급여`, `성과` |
| 시스템 관리 | `설정`                              |

규칙은 다음과 같다.

- tenant policy 또는 workbench PAGE 권한에서 제외된 workbench는 표시하지 않는다.
- workbench 자체는 허용됐지만 현재 effective descendant가 0개이면 빈 panel을 만들지 않고, 업무명이나
  route를 누출하지 않는 일반적인 `접근 가능한 업무 없음` 상태와 관리자 확인 안내를 표시한다.
- rail에는 group/leaf를 inline으로 삽입하지 않는다.
- workbench icon과 label은 1차 영역의 식별에만 사용한다. leaf마다 장식용 icon을 반복하지 않는다.
- 현재 leaf가 속한 workbench는 selected 상태로 표시한다.
- panel이 닫혀 leaf가 DOM에 없을 때는 선택된 workbench trigger가 `aria-current="page"`를 소유한다.
  panel을 열어 현재 leaf가 표현되면 trigger는 이를 제거하고 해당 leaf link 한 개로 current를 넘긴다.
  open 상태는 별도로 `aria-expanded`, `aria-controls`, visual marker로 표현한다.
- deep link로 진입하면 올바른 parent workbench가 선택되지만 panel을 강제로 열지 않는다.

### 5.2 인접 workbench task navigator

workbench trigger를 누르면 왼쪽 rail 바로 오른쪽에 task navigator를 연다.

- desktop navigator는 shell header 아래에서 rail에 붙고, sparse에서는
  `clamp(420px, 32vw, 480px)`, dense에서는 `clamp(500px, 38vw, 560px)`를 사용한다.
- navigator header는 workbench icon, 이름, 설명, 단일 task-count chip, 닫기 control을 하나의
  tinted surface로 제공한다. 닫기 전용 빈 toolbar는 만들지 않는다.
- search는 7개 이상의 허용 node가 있을 때만 표시하고, 선택한 workbench의 이미 허용된 node만
  client-side로 필터링한다.
- body는 soft group surface, group별 task 수, 44px leaf row, hover/active marker와 이동 affordance를
  제공한다.
- 8개 이상의 task와 4개 이상의 group이 있고 panel 내부 유효 폭이 470px 이상일 때만 2열을
  사용한다. sparse, constrained desktop, mobile은 1열이다.
- 검색 결과가 없으면 빈 panel이 아니라 query를 지울 수 있는 명시적 empty state를 표시한다.
- effective descendant가 0개이거나 projection이 fail-closed이면 각각 안전한 zero/unavailable state를
  표시하며, fail-closed 상태에서는 explorer shortcut도 노출하지 않는다.
- footer는 권한이 있을 때만 `전체 HR 업무 보기`를 노출하고 `/hr/explore`로 연결한다.
- panel 열기·닫기는 navigation policy를 재조회하지 않는다.
- panel은 content detail inspector가 아니라 navigation surface이므로 rail에 붙은 leading overlay로 유지한다.

### 5.3 공식 `/hr/explore`

`/hr/explore`는 8번째 workbench가 아니며 IA node count를 늘리지 않는 utility다. 기존의 다음 기능을
전체 업무 탐색의 공식 진입점으로 사용한다.

- 권한 재필터가 적용된 전체 route 검색
- workbench/module filter
- 최대 20개의 개인 즐겨찾기
- 최대 20개, 30일 TTL의 최근 업무
- 최대 20개의 진행 중 command/workflow/approval/service/exception
- partial/stale source와 재시도 가능한 degraded 상태

task navigator 안에 이 기능을 별도로 복제하지 않는다. navigator는 빠른 workbench 탐색을,
`/hr/explore`는 cross-module 검색과 재개를 담당한다. 향후 command palette를 제공하더라도 같은
explorer projection과 권한 cache를 사용해야 하며 별도의 client catalog를 만들지 않는다.

### 5.4 visual hardening 기준

- 전체 높이의 흰 sheet가 아니라 content-fit navigation flyout으로 표현하고, viewport를 초과할 때만
  내부 body가 scroll한다.
- route current는 accent selection과 leading marker, workbench open은 soft surface와 border/chevron,
  keyboard focus는 `:focus-visible` ring으로 서로 구분한다.
- pointer click은 keyboard focus ring을 남기지 않으며 forced-colors에서는 outline으로 의미를 보존한다.
- desktop flyout은 180ms 이내의 짧은 slide/fade만 사용하고 reduced-motion에서는 제거한다.
- mobile task view는 `뒤로가기 · workbench 이름 · 닫기`의 단일 header를 사용한다. desktop brand header와
  별도 Back toolbar를 중복하지 않는다.
- 시각 기준은 외형 복제가 아니라 Atlassian Navigation의 progressive disclosure, Oracle Redwood의
  Suggestions/Product Map 분리, Workday의 categorized/Saved navigation, SAP Fiori의 navigation과
  contextual side panel 구분, Fluent 2 drawer anatomy를 DWP token 체계에 맞게 적용한다.

## 6. interaction 계약

### 6.1 desktop expanded rail (`>= 1200px`)

- workbench trigger를 click 또는 `Enter`/`Space`로 열고 같은 trigger로 닫는다.
- 한 번에 한 navigator만 연다.
- `Escape`, close, 같은 trigger로 닫으면 focus를 원래 trigger로 복원한다. panel 밖 pointer activation은
  사용자가 새로 선택한 외부 target의 focus를 보존한다.
- leaf를 선택하면 panel을 닫고 route를 이동한다.
- 선택한 route에서 main content의 첫 `h1`, 없으면 `#dwp-main-content`로 focus를 넘긴다.
- panel은 overlay로 동작해 workspace 폭을 갑자기 재배치하지 않는다.
- hover만으로 panel을 열거나 route를 이동하지 않는다.

### 6.2 desktop compact rail

- icon-only rail에서도 workbench icon은 동일한 navigator를 연다.
- 각 icon trigger에는 visible tooltip과 accessible name이 있다.
- compact 상태는 leaf 접근을 제거하지 않는다.
- selected marker와 forced-colors outline은 label 유무와 관계없이 유지한다.

### 6.3 tablet/mobile (`< 1200px`)

- 기존 modal drawer의 primary 목록에서 workbench를 선택하면 같은 drawer 안의 task view로 drill-in한다.
- task view는 뒤로 가기, workbench heading, 검색, group, leaf, explorer footer를 한 열로 표시한다.
- 뒤로 가기는 drawer를 닫지 않고 primary 목록으로 돌아간다.
- leaf 선택은 drawer를 닫고 main heading으로 focus를 넘긴다.
- drawer close는 opener로 focus를 복원하고 background는 interaction 불가 상태를 유지한다.
- 320px/390px와 200% zoom에서 horizontal scroll 없이 긴 한국어·영어 label을 wrap한다.

### 6.4 active state와 URL 문맥

- route alias는 canonical node와 정확히 하나의 workbench로 resolve되어야 한다.
- panel이 닫혀 있으면 선택된 parent workbench가 `aria-current="page"`를 갖는다.
- panel이 열리고 leaf가 active이면 leaf link만 `aria-current="page"`를 가지며 parent는 selected/open
  marker만 유지한다. 권한상 current leaf를 표현할 수 없는 empty/unmapped 상태에서는 current를
  임의로 만들지 않는다.
- task 이동 시 `legalEntityPublicId`와 Product Surface shortcut scope 등 허용된 URL 문맥을 보존한다.
- 서로 다른 legal entity로 전환하면 이전 projection과 선택 상태를 재사용하지 않는다.

## 7. 권한 및 tenant 정책 불변 원칙

이번 successor는 다음 원칙을 절대 변경하지 않는다.

1. **Canonical-first:** node ID, workbench/group 귀속, route alias, owner, display order는 정본 catalog가
   결정한다.
2. **Restrict-only:** tenant/legal-entity policy는 canonical workbench/group/node를 제거할 수만 있고
   새로운 node, route, 권한, 순서를 만들 수 없다.
3. **Server authority:** frontend local state와 검색 결과는 권한 source가 아니다. 최종 후보는 서버
   navigation projection과 PAGE authority의 교집합이다.
4. **Fail closed:** projection 오류, revision/hash 불일치, stale authority에서는 해당 task를 숨긴다.
5. **No parent bypass:** disabled workbench/group의 descendant를 policy가 단독으로 다시 활성화할 수 없다.
6. **Independent enforcement:** 메뉴 visibility와 무관하게 deep link와 API는 서버에서 entitlement,
   atomic duty, population, field (`VIEW/MASK/OMIT`), purpose, SoD를 다시 판정한다.
7. **Context isolation:** tenant와 legal-entity projection/cache는 context key와 revision으로 분리한다.
8. **Governed utility:** `/hr/explore` shortcut은 정확한 PAGE route decision이 `allowed`일 때만 표시한다.
9. **No placeholder leakage:** 구현·등록·허가되지 않은 목표 route, 빈 group, 빈 chevron은 표시하지 않는다.
10. **Stable supportability:** tenant별 자유로운 route 재배열보다 canonical 순서를 우선해 문서, 지원,
    교육, 자동화의 기준을 안정적으로 유지한다.

회사별 메뉴 정책은 설치 module/country pack, feature rollout, product entitlement, PAGE authority,
tenant policy, legal-entity overlay의 교집합으로 표현한다. 회사별 label override가 필요해질 경우에도
canonical node ID에 결박된 governed i18n override만 허용하고 route/capability는 변경하지 않는다.

## 8. 장기 단일 catalog 방향

현재 정본의 의미는 일관되지만 frontend TypeScript manifest와 backend Java canonical topology가 각각
존재하므로 수동 drift 가능성이 있다. 장기적으로 다음의 단일 생성 파이프라인으로 수렴한다.

```text
sealed IA registers + append-only successor records
                    |
                    v
       versioned HRIS navigation catalog
                    |
          +---------+---------+
          |                   |
          v                   v
 generated backend       generated frontend
 canonical topology      types/manifest/i18n keys
          |                   |
          +---------+---------+
                    v
       runtime authorization projection
```

단일 catalog의 최소 필드는 `nodeId`, `workbenchId`, `groupId`, canonical route, admitted aliases,
display order, label key, owner, lifecycle, capability/PAGE contract reference, topology revision과 digest다.

- backend가 runtime projection과 policy validation의 authority를 유지한다.
- frontend는 generated type/manifest를 사용하며 별도 canonical list를 손으로 복제하지 않는다.
- tenant overlay와 개인 preference는 catalog와 별도 aggregate로 유지한다.
- `adm_navigation_items`는 DWP 앱 launcher 책임을 유지하고 HRIS leaf catalog로 확장하지 않는다.
- generator는 node/group/workbench closure, route uniqueness, owner, label key, digest를 검증한다.
- frontend와 backend artifact는 같은 source revision/digest를 pin한다.

이 수렴은 별도 migration·generator 작업이다. 이번 presentation 개선을 이유로 즉석에서 DB source를
바꾸거나 기존 봉인 topology를 재작성하지 않는다.

## 9. 이번 구현 범위

### 9.1 포함

- HRIS의 2차 navigation presentation을 inline에서 adjacent panel로 전환
- generic `ProductAreaLayout`에 panel presentation을 제공하되 기존 product의 disclosure/inline 동작 보존
- expanded/compact desktop rail에서 동일한 workbench navigator 접근
- mobile drawer의 primary → task drill-in과 뒤로 가기
- workbench 내부 client-side 검색, 결과 수, no-result state
- group별 heading/leaf 목록과 정확한 active state
- 권한이 허용할 때 공식 `/hr/explore` shortcut 노출
- leaf navigation 시 legal-entity query 보존, mobile main-content focus handoff
- Escape, click-away, close button, focus restore, forced-colors, reduced-motion 대응
- 관련 unit/routing/mobile-focus/e2e/visual 검증 갱신

### 9.2 비범위

- 7 workbench, 46 group, 98/99 node의 추가·삭제·재배치
- canonical route, route alias ownership, page owner 변경
- tenant navigation aggregate schema 또는 maker-checker lifecycle 변경
- tenant가 임의 route를 생성하거나 canonical 순서를 바꾸는 기능
- DWP `adm_navigation_items`를 HRIS leaf catalog로 전환하는 migration
- `/hr/explore`의 API·즐겨찾기·최근 업무 데이터 모델 재작성
- 사용자별 drag-and-drop 메뉴 편집
- desktop panel 고정(pin) preference와 cross-device 동기화
- 전역 `Cmd/Ctrl+K` command palette
- 회사별 label override authoring UI
- 아직 구현되지 않은 IA node를 placeholder로 노출

비범위 항목은 후속 successor에서 독립적으로 설계하고 권한·migration·회귀 범위를 별도로 승인한다.

## 10. 인수조건

### 10.1 source와 IA

- **AC-SRC-01:** 문서와 UI는 `adm_navigation_items`를 HRIS leaf source라고 표현하지 않는다.
- **AC-SRC-02:** rail의 workbench와 panel의 task는 기존 canonical manifest/policy projection을 사용한다.
- **AC-SRC-03:** node, route, page owner, 7 workbench, 46 group 및 현재 runtime 99-node closure가 변하지 않는다.
- **AC-SRC-04:** `/hr/explore`는 별도 utility이며 shell workbench 수를 8개로 늘리지 않는다.

### 10.2 권한과 tenant

- **AC-AUTH-01:** panel은 `projectHrisWorkbenchTaskNavigation(policy, view, authorizedPaths)` 결과 밖의
  node를 한 개도 표시하지 않는다.
- **AC-AUTH-02:** unauthorized route, parent-disabled node, stale projection, fail-closed projection은
  menu·검색 결과·count에서 모두 제외된다.
- **AC-AUTH-03:** `OFF/NOT_ENROLLED/SHADOW` compatibility mode도 Product Surface가 허용하지 않은
  route를 추가하지 않는다.
- **AC-AUTH-04:** `/hr/explore` shortcut은 정확한 route contract decision이 allowed일 때만 보인다.
- **AC-AUTH-05:** tenant 또는 legal entity 전환 시 이전 context의 node와 active state가 남지 않는다.
- **AC-AUTH-06:** menu visibility는 API authorization을 대체하지 않는다.

### 10.3 desktop UX

- **AC-UX-01:** 1차 rail은 home과 허용된 workbench만 표시하며 leaf를 inline으로 세로 전개하지 않는다.
- **AC-UX-02:** 모든 허용 leaf는 workbench trigger 후 최대 한 번의 leaf 선택, 즉 primary에서 최대
  2 interaction으로 도달한다.
- **AC-UX-03:** workbench panel은 header, 허용 task 수, 검색, grouped task, empty state, explorer footer를
  제공한다.
- **AC-UX-04:** 한 번에 하나의 panel만 열리고 같은 trigger, close, outside click, `Escape`로 닫힌다.
- **AC-UX-05:** `Escape`, close, 같은 trigger로 panel을 닫으면 focus는 원래 workbench trigger로 돌아간다.
  outside pointer activation으로 닫히면 새로 선택한 외부 target의 focus를 보존한다.
- **AC-UX-06:** compact rail에서도 모든 허용 task에 접근할 수 있다.
- **AC-UX-07:** panel open/close와 검색은 navigation projection을 다시 fetch하지 않는다.
- **AC-UX-08:** empty group, empty chevron, blank panel이 없다. effective descendant 0개와 fail-closed는
  허용되지 않은 node 이름을 누출하지 않는 일반적인 zero/unavailable state로 구분한다.

### 10.4 mobile 및 responsive

- **AC-RWD-01:** `<1200px`에서는 primary와 task view가 같은 modal drawer 안에서 단계적으로 전환된다.
- **AC-RWD-02:** mobile back은 primary 목록으로 돌아가며 leaf 선택은 drawer를 닫는다.
- **AC-RWD-03:** leaf 선택 후 main `h1` 또는 main container가 focus를 받는다.
- **AC-RWD-04:** 1440, 1280, 1024, 768, 390, 320px와 200% zoom에서 horizontal overflow,
  clipped control, content overlap이 없다.
- **AC-RWD-05:** 긴 한국어·영어 label은 의미를 잃는 ellipsis 대신 필요한 범위에서 wrap한다.
- **AC-RWD-06:** mobile interactive target은 최소 44px이다.

### 10.5 접근성 및 시각 상태

- **AC-A11Y-01:** keyboard만으로 rail, panel, search, leaf, close, back, explorer를 사용할 수 있다.
- **AC-A11Y-02:** trigger는 `aria-expanded`와 `aria-controls`, panel은 고유 accessible name을 갖는다.
- **AC-A11Y-03:** 표현 가능한 current target이 있을 때 `aria-current="page"`는 정확히 하나다. panel
  closed에서는 selected parent, open에서는 active leaf로 handoff하며 둘이 중복 소유하지 않는다.
- **AC-A11Y-04:** search 결과 수는 `aria-live`로 전달되고 empty state에는 query clear 행동이 있다.
- **AC-A11Y-05:** forced-colors에서 selected/open/focus 상태가 색 이외 outline/marker로 구분된다.
- **AC-A11Y-06:** reduced-motion에서는 slide/transition이 정보 이해의 전제 조건이 아니다.
- **AC-A11Y-07:** light/dark mode에서 text, focus, selected, divider가 design token 기반 대비를 유지한다.
- **AC-A11Y-08:** 변경 journey의 axe critical/serious violation은 0건이다.

### 10.6 회귀와 성능

- **AC-REG-01:** navigation policy projection은 shell lifecycle에서 한 번 조회되고 workbench 전환마다
  재호출되지 않는다.
- **AC-REG-02:** panel filtering은 workbench당 최대 허용 node 집합만 대상으로 하고 main content를
  재마운트하지 않는다.
- **AC-REG-03:** existing deep link, compatibility alias, legal-entity selector, return navigation이 보존된다.
- **AC-REG-04:** HRIS 이외 ProductArea의 disclosure/inline navigation 동작은 변하지 않는다.
- **AC-REG-05:** partial API failure 또는 explorer 미허용 상태에서도 panel의 허용 task navigation은
  독립적으로 동작하고 허용되지 않은 explorer CTA는 사라진다.

## 11. 검증 매트릭스

| ID   | 영역                | 조건/입력                                   | 기대 결과                                                                        | 최소 증적                             |
| ---- | ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- |
| V-01 | source              | DB schema와 HRIS runtime source 정적 검토   | `adm_navigation_items`는 APP/GROUP, HRIS leaf는 canonical/policy source임이 일치 | schema 및 source reference review     |
| V-02 | topology            | generated manifest 검사                     | 7 workbench, 46 group, runtime 99-node closure와 route uniqueness 유지           | manifest/policy unit test             |
| V-03 | enforced            | 일부 node를 disable한 tenant policy         | disable node와 빈 group은 rail/panel/search/count에 없음                         | policy projection unit test           |
| V-04 | fail closed         | stale revision 또는 invalid authority       | task panel 미노출, node leakage 0                                                | runtime policy negative test          |
| V-05 | compatibility       | OFF/NOT_ENROLLED/SHADOW                     | authorized compatibility route만 표시                                            | routing test                          |
| V-06 | desktop expanded    | 1440px, light/dark                          | rail + leading overlay panel, 2열 가능, overlap/shift 없음                       | Playwright screenshot + walkthrough   |
| V-07 | desktop constrained | 1280px, 긴 영문 label                       | panel 1열 또는 안전한 wrap, main content 사용 가능                               | Playwright screenshot                 |
| V-08 | compact             | 1440px icon rail                            | tooltip/name 제공, icon click으로 task panel 접근                                | component/e2e test                    |
| V-09 | tablet              | 1024/768px                                  | modal drawer primary → task drill-in → back                                      | Playwright screenshot + keyboard test |
| V-10 | mobile              | 390/320px                                   | 1열, 44px target, overflow 0, leaf 후 drawer close                               | Playwright screenshot                 |
| V-11 | zoom                | desktop 200%                                | mobile-equivalent usable layout, clipping/수평 scroll 0                          | manual/Playwright zoom evidence       |
| V-12 | keyboard            | Tab, Shift+Tab, Enter, Space, Escape        | open/close/navigation/focus restore 전체 동작                                    | component + e2e test                  |
| V-13 | active state        | canonical route 및 admitted alias deep link | 올바른 parent selected, leaf `aria-current` 1개                                  | routing/component test                |
| V-14 | search              | label/group match 및 no match               | authorized node만 filter, live count, clearable empty state                      | task navigation unit test             |
| V-15 | explorer            | allowed/denied/pending route decision       | allowed에서만 official CTA, scope query 보존                                     | access/routing unit test              |
| V-16 | legal entity        | selector query가 있는 상태에서 leaf 이동    | `legalEntityPublicId` 보존, context 변경 시 stale selection 제거                 | routing test                          |
| V-17 | focus               | desktop close, mobile leaf 이동             | trigger 또는 main `h1`로 결정적 focus 이동                                       | mobile-focus/component test           |
| V-18 | contrast            | forced-colors, visible focus                | selected/open/focus가 색 없이 구분                                               | screenshot + manual keyboard check    |
| V-19 | motion              | reduced-motion                              | navigation 이해에 animation 의존 없음                                            | media-query test/manual evidence      |
| V-20 | regression          | HRIS 외 ProductArea                         | 기존 disclosure/inline navigation 불변                                           | targeted ProductArea tests            |
| V-21 | performance         | 7 workbench 연속 open/close/search          | policy refetch 0, duplicate request 0                                            | request-count e2e assertion           |
| V-22 | accessibility       | desktop/mobile changed journey              | axe critical/serious 0, unique landmark/labels                                   | axe report                            |
| V-23 | complete journey    | 7 workbench 각각 대표 leaf + explorer       | 모든 route가 현재 권한 안에서 정상 render, 빈 canvas 없음                        | localhost walkthrough evidence        |

검증은 변경 cluster의 unit/routing/mobile-focus test를 먼저 실행하고 실패를 한 번에 수정한 뒤,
HRIS navigation e2e와 위 screenshot matrix를 한 번 수행한다. 관련 없는 전체 suite를 반복 실행하지
않는다. 전체 regression은 변경 cluster와 공용 `ProductAreaLayout` 영향이 안정된 뒤 최종 gate에서
필요한 경우 한 번만 수행한다.

## 12. 완료 판정

다음이 모두 만족되어야 이 successor를 완료로 판정한다.

- AC-SRC, AC-AUTH, AC-UX, AC-RWD, AC-A11Y, AC-REG 전 항목을 증적으로 추적할 수 있다.
- 7개 workbench의 대표 leaf와 `/hr/explore`를 실제 browser에서 검증했다.
- compact와 mobile에서 leaf 접근 dead end가 없다.
- 권한이 없는 node가 rail, panel, search, count, explorer CTA 어디에도 노출되지 않는다.
- 기존 봉인 IA 산출물과 canonical topology digest를 수정하지 않았다.
- 새 presentation이 DWP design system token과 공용 component 계약을 사용하며 HRIS 전용 CSS 예외에
  의존하지 않는다.

이 문서는 기존 봉인된
`recovery/hris-porting-blueprint-2026-09-09/coding-readiness/09-information-architecture-contract.md`를
수정하거나 무효화하지 않는다. 해당 문서의 inline 표현을 역사적 baseline으로 보존하고, 본 문서가
2026-10-20 이후 navigation presentation에 대한 append-only successor 결정이 된다.
