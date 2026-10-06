# [HISTORICAL / SUPERSEDED] DWP HRIS 1차 워킹 스켈레톤 검증 보고서

> **HISTORICAL / SUPERSEDED — 이 문서는 1차 워킹 스켈레톤 checkpoint의 구현·검증 이력이며 현재 전체 코딩 Gate를 열지 않는다.** 아래 frontend `69c2df65...` 결과와 본문은 당시 이력으로만 보존한다. 현재 판정은 [전체 코딩 준비 정본](./coding-readiness/README.md), [authoritative LIVE 리포트](./coding-readiness/reports/full-coding-readiness-latest.md), `validate_published_gate_truth.py`만 따른다.

---

아래 본문은 당시 구현 범위와 테스트 증거 추적을 위해 그대로 보존한다.

기준일: 2026-09-10  
Frontend 통합 커밋: `69c2df65a4898cd402b0f986bb41230c7e7605a8` (`codex/hris-integration-frontend-20260909`)  
Backend 통합 커밋: `5670877de7a39e94e75021c7e23cbbb553296c90` (`codex/hris-integration-backend-20260909`)  
판정: **`PHASE1 REVIEW GO / PRODUCTION NO-GO`**

## 1. 판정 요약

사용자가 요청한 1차 범위인 앱 표시명, 전체 HRIS 정보구조 검토면, `SYS / HRM / TIM / PAY / PER`별 실제 시작점 하나, 권한에 따른 진입 통제, desktop/mobile 검증을 구현했다. 향후 메뉴를 클릭 가능한 빈 화면으로 만들지 않았으며, 현재 열 수 있는 기능과 계획·정책차단·DWP 관리자 소유 기능을 구분했다.

이번 결과는 **전체 HRIS 이관 완료나 운영 출시 승인**이 아니다. 나머지 도메인 기능, backend 원장·계산·마감·법정 처리, authorization v7, 제품 출시 증빙, 최종 디자인 교체는 후속 Gate에 남아 있다. 1차 독립 감사에서 발견한 권한·PII·재전송·상태전이 5건은 결과 보고 전에 frontend/backend에서 모두 보강하고 회귀 검증했다.

## 2. 구현 결과

| 항목 | 결과 | 비고 |
|---|---|---|
| 사용자 노출 앱 명칭 | 완료 | `인사` 앱의 사용자 노출 명칭을 `HRIS`로 통일했다. 내부 호환 ID `hcm`, `/hr`, `APP.HCM`은 유지한다. |
| 전체 HRIS 업무 지도 | 완료 | 76개 typed catalog를 `HOME 1 / MY HR 7 / MY TEAM 7 / HR OPERATIONS 42 / HRIS SETTINGS 19`로 제공한다. |
| 현재 sidebar 호환 | 완료 | 기존의 권한 통제된 실행 메뉴 25개를 유지한다. 76개 목표 항목 전체를 sidebar route로 만든 것은 아니다. |
| 미래 메뉴 처리 | 완료 | 5개만 `PILOT`, 나머지 71개는 `PLANNED / BLOCKED / EXTERNAL` 상태로 표시하고 가짜 route·빈 성공 화면을 만들지 않았다. |
| BENSK / ADDSK 제외 | 완료 | 76개 목표 catalog에서 제외했다. 기존 BENSK route 2개는 호환 목적으로만 유지하며 제외 이유를 명시했다. |
| 권한별 진입 | 완료(1차) | 현재 DWP HCM 권한으로 실제 열 수 있는 경로만 `Open` 동작을 제공한다. 권한이 없으면 dead-end 버튼 대신 `Route access required`를 표시한다. |

## 3. 모듈별 1차 시작점

| 모듈 | route | 구현된 시작 기능 | 이번 단계의 명시적 한계 |
|---|---|---|---|
| SYS | `/hr/home` | 76개 메뉴·5개 작업면·모듈·persona·수명주기·가용성 탐색 | 설정 게시, 권한 변경, 확장팩 설치 없음 |
| HRM | `/hr/operations/people` | 권한·scope가 적용된 People 360 검색, 필터, 키보드 상세 진입, 마스킹·효력일 표시 | 신규 인사 원장, 일괄 발령 없음 |
| TIM | `/hr/time` | 주간 근태 조회, 제한된 입력, 원천·버전·충돌·권한 상태 | 스케줄 생성, 해석, 마감, 급여 인계 없음 |
| PAY | `/hr/pay` | 본인 급여 지급주기·명세 발행 상태, provenance와 redaction 경계 | 계산, 확정, 지급, 세무 신고 및 실다운로드 없음 |
| PER | `/hr/talent` | 본인 목표와 진행률 조회, 명시적 저장, 충돌 복구 | `ACTIVE / AT_RISK` 진행률만 수정하며 상태전이·점수·등급·평가주기 제출·확정 없음 |

PAY와 PER의 읽기 API도 DWP Product Surface의 `contextScopeKey`, scope별 query cache, `AbortSignal`, 준비상태와 query metadata를 사용하도록 정리했다. HRM/TIM은 scope가 바뀔 때 이전 요청을 취소하고 늦게 도착한 응답을 폐기하며, 권한 거부 후 이전 사용자의 cache 내용을 노출하지 않는 negative runtime test를 포함한다. HRM backend는 상세 조회에도 효력일·조직 scope를 적용하고, 마스킹된 식별자와 직급이 검색 조건에 참여하지 않도록 field grant와 검색 predicate를 결합했다.

## 4. 권한 구현과 남은 계약

1차 UI는 `useHcmAccess()`가 만든 현재 DWP audience와 실제 navigation registry의 교집합만 열어 준다. 검증 fixture에서 직원은 HR 운영 People 360 실행 동작이 0개이고, HR 관리자는 1개다. 직접 route 진입도 기존 DWP route guard와 Product Surface scope를 거친다.

목표 권한 구조는 다음을 유지한다.

```text
HRIS 앱 자격
  ∩ 직원·관리자·업무운영자·설정관리자·전사감사자 권한 package
  ∩ 메뉴 atomic duty
  ∩ 대상집단/업무 scope
  ∩ 필드·목적 정책
  ∩ SoD 및 step-up 조건
```

다만 현재 authorization v6의 모든 HCM route에 부모 `APP.HCM` entitlement를 강제하는 계약은 아직 활성화하지 않았다. append-only authorization v7, Auth/People/Platform owner PEP, negative matrix, shadow/canary 증거가 닫히기 전에는 운영 권한 완료로 판정하지 않는다.

## 5. 검증 증거

프로젝트가 요구하는 Node `24.19.0`과 Yarn `4.17.1` 기준 결과다.

| 검증 | 결과 |
|---|---|
| 전체 Vitest | **PASS** — 570 files, 4,644 tests |
| HRIS 집중 Vitest | **PASS** — 18 files, 132 tests |
| TypeScript | **PASS** |
| Architecture | **PASS** — authorization 79 PAGE routes, 12/12 product contracts, 60/60 PEP cells, 경계·cycle·reachability·source budget 통과 |
| Production build | **PASS** — G0에 고정된 Agent OpenAPI 계약 기준, 5,248 modules, bundle budget 통과 |
| Backend Gradle check | **PASS** — 80 tasks, People service 172 tests 및 authorization/negative matrix/service/cycle/source budget 통과 |
| Phase 1 Playwright | **PASS** — Chromium/mobile 합계 52 tests |
| 접근성·반응형 독립 확인 | **PASS** — 1280×900, 390×844, 320×760 + 200% root font; axe 위반 0, `h1` 1개, document overflow 0, console warning/error 0 |
| 변경분 포맷·whitespace | **PASS** — 변경 파일 Prettier 및 `git diff --check` |
| G0 정적 무결성 | **PASS** — 219,181 checks, 6 controls, 7 evidence rows |

Playwright는 76개 고유 catalog, 정확히 5개 PILOT와 71개 비활성 목표, 영역별 합계, BENSK 제외, 권한별 Open 동작, 필터 live status, API scope header, overview 장애 시 제품 지도 유지, People 검색·키보드 상세, axe와 overflow를 desktop/mobile에서 함께 확인한다.

스크린샷 증거는 `/Users/a10697/Work/DWP/output/hris-phase1-evidence-2026-09-10`에 있다.

## 6. 독립 감사 발견사항 폐쇄

| 발견사항 | 최종 조치 | 판정 |
|---|---|---|
| HRM 상세 assignment/workforce entity의 기준일·조직 범위 누락 | repository 조회에 `asOf`, tenant-wide 여부, 허용 조직 목록과 효력일 predicate를 강제 | 폐쇄 |
| 마스킹 필드를 이용한 검색 추론 가능성 | worker identifier·assignment key·job grade predicate를 해당 field grant가 있을 때만 생성 | 폐쇄 |
| People 상세 재조회 403 뒤 cache PII 잔류 | 오류 상태에서는 title·subtitle·status·본문이 cache fallback을 사용하지 않도록 fail-closed 처리하고 negative test 추가 | 폐쇄 |
| TIM 401/403 뒤 저장·제출 재전송 가능성 | 비재시도 오류에서 handler와 button을 함께 차단하고 draft 보존·단일 호출을 8개 조합으로 검증 | 폐쇄 |
| PER DRAFT 편집 및 암묵적 완료 전이 | `ACTIVE / AT_RISK`의 progress-only 수정으로 축소하고 backend에서 상태 일치·버전·허용 상태를 원자 검증 | 폐쇄 |

이 폐쇄는 1차 시작점의 안전성 판정이다. HRIS 전체 도메인의 보안·법정·운영 준비가 완료됐다는 의미는 아니다.

독립 재감사는 frontend 보안 집중 52/52, backend 집중 25/25를 통과했고 신규 치명적·고위험 결함을 발견하지 않았다. 이후 동일한 최종 SHA에서 전체 Phase 1 브라우저 E2E 52/52와 production build까지 다시 통과했다. 비차단 후속 품질 과제로는 실제 PostgreSQL의 다중 배정·조직 이동·종료일 경계 통합 fixture, parent summary의 work-relationship 효력일 일치, 403 시 상세 query cache 자체 제거, 다음 API 버전의 `status` → `expectedStatus=ACTIVE|AT_RISK` 축소를 등록한다.

## 7. 의도적으로 열어 둔 차단 사항

1. **운영 권한:** authorization v7과 부모 앱 entitlement가 미활성 상태다.
2. **제품 출시 증빙:** Product Surface production readiness는 정직하게 `BLOCKED 0/37`이다.
3. **전체 기능:** 71개 목표 메뉴의 실제 도메인 기능과 route는 아직 개발하지 않았다.
4. **backend:** 이번 시작점의 HRM scope/search와 PER progress 전이는 보강했다. 신규 HR 원장·근태 해석/마감·급여 계산/확정/법정·성과 평가 확정 schema/API는 owner와 Gate 승인 전이다.
5. **보안 다운로드:** PAY 명세서의 실제 감사 가능한 다운로드 endpoint는 연결 전이다.
6. **데이터 provenance:** PER를 포함한 후속 쓰기 기능은 owner 근거·효력일·감사 증거를 더 확장해야 한다.
7. **최종 UI:** 현재 화면은 기능·정보구조 검토용이다. 모듈 기능 완료 후 Design AI 프롬프트 패키지를 만들고 승인 디자인으로 교체한다.
8. **인접 Agent 계약:** G0에 고정된 계약으로 build는 통과했지만 현재 sibling `dwp_agent` checkout과 frontend snapshot은 SHA가 달라 owner 동기화가 필요하다.
9. **전역 포맷 게이트:** 이번 변경 파일은 모두 통과했다. 저장소 전역 `format:check`에는 이번 커밋이 수정하지 않은 공용 script 5개의 기존 경고가 남아 있다.
10. **G0 live checkpoint:** 원본 G0 정적 패키지는 통과한다. 최종 구현 뒤 원본 baseline을 기대하는 `--check-live`는 backend/frontend 기준선의 HEAD·tree와 control/5개 module frontend HEAD에서 합계 11개 의도적 drift를 탐지한다. 다음 전체 모듈 세션 착수 전에는 이 delta를 증빙한 별도 승인 integration checkpoint로 갱신해야 한다.

## 8. 다음 의사결정

사용자는 이 1차 화면에서 다음을 먼저 검토한다.

- 다섯 작업면이 복잡한 HRIS 메뉴를 이해하기 쉬운 구조로 보이는가
- 기존 sidebar 25개와 76개 목표 지도의 관계가 적절한가
- 모듈별 대표 시작점의 기능 깊이와 경계가 올바른가
- 직원·관리자·운영자·설정관리자·감사자 관점의 탐색 방식이 적절한가

승인 후에는 새 baseline/checkpoint를 만들고, `HRM / TIM / PAY / PER / SYS` 모듈 task에서 G2/G3가 열린 vertical slice부터 실제 기능을 확장한다. 각 모듈의 전체 기능이 완료되면 공통 계약에 따라 전체 메뉴 대상 Design AI 프롬프트 설계서와 검증 패키지를 산출한다.
