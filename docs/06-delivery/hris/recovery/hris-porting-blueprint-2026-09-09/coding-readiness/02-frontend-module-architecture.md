# HRIS 프론트엔드 모듈 아키텍처

상태: **목표 구조 / G3 CLOSED**. 아래 기능·화면·테스트는 구현 완료 목록이 아니다. 현재 소스와 독립 감사 판정은 `reports/readiness-recovery-2026-09-14.md`를 함께 확인한다. historical G1/G2 봉인이나 개별 contract check PASS만으로 모듈 전체 개발을 시작하지 않는다.

## 1. 목표 구조

현재 DWP frontend의 Nx, React 19, React Router, React Query, MUI/design-system, product-surface authorization을 유지한다. 새 HRIS 기능은 `apps/dwp/src/features/hris` 아래 bounded feature로 두고, 중앙 route·manifest·API snapshot은 Integration Control만 수정한다.

```text
apps/dwp/src/features/hris/
  shell/                 # SYS: app identity, compatibility, contribution contract
  home/                  # SYS: widget composition, personalization, freshness
  explorer/              # SYS: capability-driven work explorer
  people/                # HRM: person/worker/employment/assignment
  organization/          # HRM: organization/position/location design workspaces
  employee-services/     # HRM: request/case/document journeys
  performance/           # PER: goals/reviews/calibration/results
  time/                  # TIM: schedule/clock/timesheet/approval/close
  leave/                 # TIM: request/balance/accrual/adjustment
  payroll/               # PAY: inputs/run/result/statement/payment/accounting
  administration/        # SYS shell + domain-owned settings contributions
  integrations/          # SYS control-plane UI, domain connector contributions

apps/dwp/src/routes/
  hcm-routes.tsx         # Integration Control single-writer

libs/api-contracts/
  src/generated/         # OpenAPI-generated types only
  src/hris/              # stable cross-app transport types, no domain logic

libs/design-system/      # generic components only
libs/shared-utils/       # domain-neutral auth/API/error/idempotency helpers only
```

각 directory는 `index.ts` public API를 제공한다. feature끼리 상대 경로로 내부 구현을 가져오지 않는다. 공유 필요성이 생기면 먼저 domain ownership을 판단하고, 진짜 제품 중립 코드만 library로 승격한다. `utils.ts`, `common.ts`, 거대 barrel, 순환 import는 금지한다. 세션별 정확한 root와 layer/import edge는 `module-structure-contract-register.csv`, source/test와 중앙 route/build/contract/CI/deploy writer는 `g3-file-allocation-register.csv`가 정본이다.

## 2. 화면 구성 계약

### Shell과 navigation

- 사이드바는 IA 정본의 7개 workbench인 `내 HR / 팀 / 인사 운영 / 근태 / 급여 / 성과 / 설정`을 권한에 따라 투영한다. HRIS Home은 별도 고정 진입점이며 메뉴 카탈로그로 사용하지 않는다.
- 각 작업면은 5~8개의 journey 수준 항목만 노출하고, 레거시 leaf route는 workspace 내부 tab·filter·detail로 흡수한다.
- 선택 상태는 route pattern으로 결정하고 새로고침·deep link·browser back을 보존한다.
- 앱 권한만 있고 leaf capability가 없으면 홈/탐색의 허용된 개인 정보만 표시한다.
- 권한 없는 메뉴는 숨기지만 직접 URL 접근은 명확한 403/denied 화면으로 종료한다.

### HRIS Home

홈은 메뉴 카드 모음이 아니라 사용자 질문에 답하는 위젯 화면이다.

- 직원: 오늘 근무, 휴가잔액·신청, 최근 급여명세, 진행 목표, 문서/승인 할 일
- 관리자: 팀 예외, 승인 대기, 결원/변경, 평가 진행률
- 운영자: 입퇴사/발령 queue, 근태·급여 마감, 데이터 품질, 연계 실패
- 설정/감사자: 게시 대기, SoD·권한 review, automation/connector health, 감사 exception

각 module contribution은 `widgetKey`, `schemaVersion`, `audience`, `requiredCapabilities`, `scopeKinds`, `freshness`, `status`, `metrics`, `actions`, `deepLinks`, `generatedAt`만 제공한다. SYS home은 순서·개인화·부분실패·stale 표시를 담당한다. 브라우저가 모듈 service를 동기 fan-out하지 않고 gateway의 materialized home read model을 읽는다.

### Work Explorer

`/hr/explore`는 base 76개와 modern 22개를 합친 98개 IA node의 검색·즐겨찾기·최근 사용을 제공하되 설치 모듈, country pack, tenant config, app entitlement, atomic capability, scope를 모두 통과한 항목만 표시한다. Phase 1 catalog는 이 route의 정보모델 입력일 뿐 홈에 mount하지 않는다.

## 3. Feature 내부 표준

```text
<feature>/
  index.ts
  routes/              # feature-owned lazy page components, central route 등록은 별도
  pages/               # journey/workspace composition
  components/          # feature-only components
  api/                  # generated contract adapters and query/mutation functions
  model/                # view model, state projection, pure rules
  forms/                # schema, field mapping, dirty/draft rules
  hooks/                # feature orchestration hooks
  testing/              # builders/fixtures; production import 금지
  *.test.ts(x)
```

- page는 fetch·mutation 세부 구현을 직접 포함하지 않는다.
- transport DTO를 component 전체로 흘리지 않고 view model로 투영한다.
- 정본 import edge는 `routes → pages`, `pages → components/model/hooks/forms`, `components → model`, `api/forms → model`, `hooks → api/model/forms`, `testing → public-api`다. 페이지는 hook을 통해 query/mutation을 조합하고 pure form schema를 사용한다. hook은 form/model을 조합하되 form/model은 React나 hook에 역의존하지 않는다. 이 12개 edge는 DAG이며 `pages → api`, `components → api`, `forms → hooks`는 허용하지 않는다.
- feature 내부 implementation을 다른 feature가 import하거나 UI가 raw transport DTO/gateway client에 의존하면 architecture check가 실패해야 한다. 기존 first-segment/relative-import 검사만으로 중첩된 `hris/<feature>` 및 alias isolation이 검증됐다고 간주하지 않는다. 새 layer 검사에서 AST 기반 relative/alias 경로와 feature public API 경계, actual repository scan을 별도로 확인한다. synthetic compile-only fixture는 실제 메뉴 기능·DOM·네트워크·권한 동작 검증이 아니다.
- 서버가 상태/권한/계산의 정본이며 클라이언트 계산은 preview로 표시한다.
- mutation마다 stable intent ID와 idempotency key를 생성해 재시도 동안 유지한다.
- query key는 `tenantId`, surface, scope revision, resource public ID, filter, contract version을 포함한다.
- tenant/scope/identity 변경 시 관련 cache를 폐기하고 in-flight request를 취소한다.
- optimistic update는 비금전·비법정·가역 상태에만 사용하고, 급여/마감/승인/게시에는 receipt 기반 상태를 사용한다.

## 4. 필수 UI 상태

모든 route/surface는 적용 가능한 다음 상태를 구현하고 테스트한다.

| 상태 | 계약 |
|---|---|
| loading | skeleton과 accessible status, 이전 tenant 데이터 노출 금지 |
| empty | 원인과 다음 행동을 구분; 권한없음을 empty로 위장하지 않음 |
| validation | field + summary 오류, focus 이동, 서버 rule code 보존 |
| denied/403 | 필요한 권한의 사용자 친화 설명과 요청 경로; 데이터 일부 렌더 금지 |
| conflict/409 | 현재 version과 사용자 draft 비교, reload/merge/retry 선택 |
| stale | 기준시각·마감/정책 version 표시, 위험 command 차단 |
| partial | 성공/실패 단위를 구분하고 실패행 재처리 receipt 제공 |
| result unknown | timeout을 실패로 단정하지 않고 receipt 조회/재개 제공 |
| degraded | widget/connector 단위 격리, 전체 화면 blank 금지 |
| success | 다음 상태, 감사/receipt ID, 영향을 받은 범위를 확인 가능 |

## 5. Form·table·bulk 작업

- effective-date form은 현재/미래/소급 변경과 충돌 구간을 시각적으로 구분한다.
- 민감 필드는 field policy 결과에 따라 `VISIBLE / MASKED / REDACTED / DENIED`로 투영한다.
- data grid는 server pagination/sort/filter를 기본으로 하고 export 권한과 분리한다.
- bulk import는 업로드→schema 검증→dry-run→오류행 수정→승인→실행→reconciliation 흐름을 따른다.
- 100건 이상 command는 기본 비동기 receipt로 전환한다.
- CSV/Excel formula injection, unsafe filename, oversized file, content-type mismatch를 방어한다.
- 인쇄/PDF/문서는 별도 projection contract와 watermark/audit를 사용한다.

## 6. 접근성·반응형·국제화

- 키보드만으로 sidebar, tab, table, dialog, wizard, drag 대체조작이 가능해야 한다.
- focus trap/return, semantic heading, label, error association, live region을 검증한다.
- 색상만으로 상태를 표현하지 않고 reduced motion과 zoom 200%를 지원한다.
- 1440 desktop과 390 mobile을 최소 수용점으로 사용하되 업무운영 대량 grid는 mobile에서 핵심 확인/승인만 제공하고 전체 편집을 강제하지 않는다.
- locale, IANA timezone, calendar date, currency, number formatting을 transport 값과 분리한다.
- 이름 순서·주소·식별번호·근무일 경계는 국가/tenant policy로 처리한다.

## 7. 성능·bundle

- route와 대형 grid/chart/editor는 lazy load한다.
- Home initial route는 각 도메인 feature 전체 bundle을 가져오지 않는다.
- list virtualization은 측정 후 적용하고 접근성 대체를 제공한다.
- server-driven filter/debounce/cancellation을 사용한다.
- 기존 bundle budget, reachability, source-size, unused-export, cycle ratchet을 악화시키지 않는다.
- `nx.json`의 `hcmProduct` input에는 `features/hris/**/*`가 포함돼야 하며 새 shared input은 Integration Control이 승인한다.

## 8. 테스트와 디자인 인계

G3 착수 승인 전에는 정확한 메뉴·journey·DTO·권한·owner port·상태별 수용조건과 공통 fail-closed scaffold/consumer 검증을 닫는다. 승인 후 모듈 구현에서 view-model unit, component interaction, route/authorization, API adapter, 403/409/stale/result-unknown, accessibility smoke, responsive smoke를 작성하고, G4 기능 수용에서 실제 E2E golden journey와 visual semantic baseline을 고정한다. 그 뒤 각 모듈은 모든 page/tab/dialog/drawer/wizard/report/document/state/persona를 포함한 G5A Design AI prompt package를 생성한다. 디자인 교체가 data/command/accessibility contract를 변경하면 기능 Gate로 되돌린다.

## 9. 실제 준비 구현 참조 — Integration 후보, 미게시

2026-09-14 급여 조회 시작 화면에 위 계층을 실제 적용했다. `payroll/index.ts` 공개 진입점, `api/payroll-api.ts`, `hooks/use-hris-payroll-workspace.ts`, `model/payroll-self-service-model.ts`, `pages/hris-payroll-workspace.tsx`, `testing/hris-payroll-workspace.runtime.test.tsx`가 참조 구현이다. API와 조회 훅은 current scope·취소·오류를 처리하고, page는 명시적 화면 모델만 표시한다. domain model은 employee·계좌·금액 transport를 포함하지 않는다. 기존 조회·다운로드 경계와 디자인은 보존했다.

이는 PAY pilot의 실제 구조 준비안이며 전체 PAY 기능이나 다섯 모듈 계층 완성·canonical 전달·G3 승인이 아니다. 2026-09-15 Integration 후보에서 `node scripts/verification/hris-layer-contract-v1.mjs --mode scan`을 다시 실행한 현재 증거는 exit 0, `structuralPass=true`, source 2,440개, classified 60개, layered 54개, unclassified 0개, errors 0개다. 이전 준비 보고서의 미분류 32개/진단 45개/exit 1은 보강 전 historical 수치이며 현재 판정이 아니다. 다만 이 명령 자체도 `readinessPass=false`, `g3StartAuthorized=false`로 명시하므로 구조 scan PASS를 전체 모듈 구현 완료나 G3 착수 승인으로 해석하지 않는다. 독립 전문가 검토와 나머지 모듈 적용이 남는다. 정확한 source pin·원본 실행·한계는 `reports/frontend-payroll-real-layer-preparation-2026-09-14.md` 및 연결 JSON들을 따른다.
