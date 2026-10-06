# [HISTORICAL / SUPERSEDED] DWP HRIS 전체 모듈 개발 준비도 재검증

> **HISTORICAL / SUPERSEDED — 이 문서는 G1/G2 폐쇄 전에 수행한 사전 감사 이력이며 현재 Gate를 열지 않는다.** 아래 본문과 backend `5670877de7a39e94e75021c7e23cbbb553296c90`은 당시 source-characterization predecessor 기록으로만 보존한다. 현재 판정은 [전체 코딩 준비 정본](./coding-readiness/README.md), [authoritative LIVE 리포트](./coding-readiness/reports/full-coding-readiness-latest.md), `validate_published_gate_truth.py`만 따른다.

---

아래 본문은 감사 시점의 증거·발견사항 추적을 위해 그대로 보존한다.

기준일: 2026-09-10  
검증 대상 frontend: `69c2df65a4898cd402b0f986bb41230c7e7605a8`  
검증 대상 backend: `5670877de7a39e94e75021c7e23cbbb553296c90`  
최종 판정: **`FULL MODULE CODING NO-GO`**  
조건부 판정: **새 integration checkpoint가 닫힌 뒤 5개 모듈 `G1 CHARACTERIZATION GO`**

## 1. 독립 검증 구성

다음 세 관점을 서로 분리해 읽기 전용으로 검증했다.

1. SKKF 메뉴·기능 coverage와 DWP 목표 메뉴의 N:M 추적성
2. 논리 데이터 모델과 물리 DDL·API·상태기계·원장의 구현 준비도
3. G0/G1/G2/G3 checkpoint, worktree, 승인권자와 세션 실행 조건

세 검증 모두 즉시 전체 코딩은 `NO-GO`, checkpoint 갱신 뒤 G1 분석만 병렬 가능하다는 동일한 결론을 냈다.

## 2. Gate 현황

| 단계 | 현재 판정 | 증거 |
|---|---|---|
| G0 정적 무결성 | `PASS` | 219,181 checks, 6 logical controls |
| G0 live checkpoint | `FAIL` | 331,870 checks 중 Phase 1 이후 HEAD/tree drift 11건 |
| 5개 G1 세션 시작 | `BLOCKED` | 새 integration baseline/checkpoint와 12개 worktree 재고정 필요 |
| G1 종료 | `NOT READY` | source decision 2,267건 미평가, G1 evidence 15개 미생성 |
| G2 계약·물리설계 승인 | `NOT READY` | owner ACK, 물리 persistence, API/event, state/guard, golden 미완료 |
| G3 기능 코딩 | `BLOCKED` | 5개 execution manifest 모두 `current_max_gate=G1`, `BLOCKED_G2_CODE_GO` |
| 운영 출시 | `BLOCKED` | authorization v7, readiness evidence, 법정·운영 증거 미완료 |

## 3. 메뉴·기능 정의의 실제 완성도

76개 목표 메뉴 카탈로그와 `HOME / MY HR / MY TEAM / HR OPERATIONS / HRIS SETTINGS` 정보구조는 존재한다. 그러나 이는 상위 제품 IA이며 SKKF 전체 기능 판정 완료를 뜻하지 않는다.

| 모듈 | 원천 artifact | 인스코프 결정 완료 | `UNKNOWN / UNASSESSED` |
|---|---:|---:|---:|
| HRM | 583 | 0 | 581 |
| PER | 349 | 0 | 349 |
| PAY | 580 | 0 | 580 |
| TIM | 568 | 0 | 568 |
| SYS | 189 | 0 | 189 |
| 합계 | 2,269 | 0 | 2,267 |

HRM의 나머지 2건은 BENSK 제외 `RETIRE / PREDECIDED`다. 2,267건은 `REUSE / REBUILD / CONFIGURE / EXTENSION / RETIRE` 판정, target capability, API/event, data owner, 프로세스 개선 이유와 acceptance evidence가 아직 비어 있다. 16개 상위 capability trace도 모두 `PROPOSED`이고 owner가 미지정이다.

따라서 현재 76개 메뉴는 개발 대상을 탐색하기 위한 목표 분류이며, 최종 개발 backlog로 동결할 수 없다. G1에서 route/controller/entity뿐 아니라 menu element, service operation, job, interface, formula, file/document, SQL behavior와 state transition을 child trace로 연결해야 한다.

## 4. 홈과 메뉴에 관한 최신 사용자 결정

다음 결정을 shared SYS/UX 계약의 정본으로 반영해야 한다.

- `/hr/home`은 76개 메뉴 지도가 아니라 인사·근태·휴가·급여·성과의 핵심정보와 할 일로 구성된 role/scope 기반 위젯 대시보드다.
- 메뉴 지도는 별도 `HRIS 업무 탐색` surface로 이동한다.
- 사이드바는 현재 작업면과 권한에 맞는 업무 진입점만 표시한다.
- 세부 조회·등록·상세·승인·단계는 업무 화면 내부 tab/inspector/wizard로 통합한다.

현재 Phase 1의 home product-map mount는 검토 scaffold이므로 새 checkpoint 전에 superseding decision, catalog coverage, route와 테스트를 함께 정리해야 한다.

## 5. 테이블 설계의 실제 완성도

`target-table-catalog.md`는 구현 가능한 논리 방향을 제시하지만 문서 자체가 **논리 테이블 카탈로그**라고 명시한다. 다음 물리 설계는 아직 확정되지 않았다.

- aggregate별 PK/UK/FK, exclusion constraint, partition, RLS와 index
- tenant/public ID 타입과 uniqueness 범위
- `[from,to)` 효력일, 기간 중복 방지와 과거 correction 방식
- Time/Leave/Payroll append-only ledger, reversal과 projection rebuild
- close/reopen, 재실행, payroll handoff와 reconciliation receipt 상태기계
- API expected version, idempotency key, command receipt와 outbox/inbox
- sensitivity, 암호화, retention, legal hold와 파기 계약
- service별 physical store와 cross-context public snapshot/event

현재 backend에는 목표 `dwp-time-server`와 `dwp-payroll-server`가 없고, `prf_*`, payroll calculation/result/ledger/payment/GL/statutory, raw clock/interpretation/close/handoff의 목표 물리 모델도 아직 구현되지 않았다.

## 6. 모듈별 준비도

| 모듈 | checkpoint 갱신 후 허용 | 코딩 전 반드시 닫을 항목 |
|---|---|---|
| SYS | G1 분석 | authorization v7, access package/PEP/SoD, config lifecycle, job/receipt, 위젯 홈 계약 |
| HRM | G1 분석 | Person/Worker/Assignment/Org snapshot·event, 효력일·correction DDL, HR 원장, 동적 field policy |
| PER | G1 분석 | target service owner 통일, HRM snapshot, `prf_*` DDL, 평가 상태기계·공개/동결, golden cycle |
| TIM | G1 분석 | Time service 경계, raw clock·interpretation·ledger·close·handoff, golden 근무제 |
| PAY | G1 분석 | Payroll service, HRM/TIM snapshot, formula/ledger, golden payroll, KR statutory pack, YEA, bank/ERP 계약 |

공통 순서는 `SYS + HRM foundation → PER/TIM → PAY`다. PAY characterization은 일찍 시작할 수 있지만 계산 코드는 가장 늦게 연다.

## 7. 내부에서 닫을 수 있는 준비사항

1. 최신 frontend/backend SHA와 홈·메뉴 결정을 반영한 새 integration checkpoint 작성
2. 갈라진 기존 frontend module branch를 보존하고 최신 integration SHA에서 새 G1 branch/worktree 생성
3. baseline build/test evidence 재생성 후 `validate_g0.py --static`과 `--check-live` 모두 PASS
4. 5개 모듈의 `g1-characterization.md`, `g1-child-trace.csv`, `g1-decision-log.csv` 15개 생성
5. 2,267개 source parent와 발견되는 child behavior를 target journey/API/event/table/test에 N:M 연결
6. PER target runtime owner 불일치 해소
7. 승인 가능한 vertical slice마다 물리 ADR/DDL, API/event, 상태기계, PEP/SoD, migration과 synthetic golden harness 작성

## 8. 외부 증거 또는 사람의 결정이 필요한 준비사항

- 운영 `/sys/auth/menu`, program, role-menu, access log export
- HRM 동적 tab·요소·필드 권한 export
- 운영 DDL/index/FK/trigger/view/procedure와 대표 실행계획
- batch catalog, schedule, parameter, dependency와 실행·재처리 이력
- ERP·은행·세무·보험·타각 interface 계약, sample과 SLA
- 익명화된 대표 급여군·근무제·평가주기 golden dataset과 기대 결과 승인
- 규모·peak·보존·DR 및 다중 법인·고용·통화 요구
- KR 법정 시행일·반올림·신고포맷·YEA 회귀팩
- Product/SME/Architecture/Security/Privacy/DBA/Statutory named owner와 대리자 ACK
- vertical slice별 Integration Control의 서면 `G2-CODE-GO`

AI가 이 증거 또는 사람의 승인을 추정해 `CLOSED`로 바꿀 수 없다.

## 9. `FULL MODULE DEVELOPMENT READY` 종료조건

다음 조건이 모두 충족된 뒤에만 전체 개발 준비 완료를 보고한다.

1. 새 G0 static/live checkpoint PASS
2. G1 evidence 15개와 master coverage의 중복·누락·고아 0
3. 모든 인스코프 source와 child behavior의 disposition·owner·acceptance evidence 결정
4. 각 모듈의 owner service, aggregate, 물리 DDL/migration과 retention 승인
5. versioned API/event, state/guard/CAS/error/recovery, idempotency/receipt 계약 승인
6. app entitlement, atomic duty, population/field policy와 SoD 검증
7. characterization/golden fixture와 허용오차 및 tenant-negative test 준비
8. 실제 책임자의 ACK와 명명된 vertical slice별 `G2-CODE-GO`

현재는 이 종료조건을 충족하지 않는다.
