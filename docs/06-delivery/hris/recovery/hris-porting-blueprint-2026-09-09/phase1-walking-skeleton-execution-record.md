# DWP HRIS 1차 워킹 스켈레톤 실행 기록

기준일: 2026-09-10  
상태: `PHASE1 REVIEW GO`  
운영 출시 상태: `NOT PRODUCTION READY`

실행 결과와 검증 근거는 [phase1-validation-report.md](./phase1-validation-report.md)에 기록했다. 최종 통합 커밋은 frontend `69c2df65a4898cd402b0f986bb41230c7e7605a8`, backend `5670877de7a39e94e75021c7e23cbbb553296c90`이며, 이 판정은 전체 모듈 G2/G3 또는 운영 출시 승인이 아니다.

## 1. 사용자 결정과 이 기록의 효력

사용자는 G0 여섯 통제가 닫힌 뒤, 전체 HRIS 구현에 앞서 다음 범위의 1차 개발을 명시적으로 지시했다.

1. DWP에서 사용자에게 보이는 `인사` 앱 명칭을 `HRIS`로 변경한다.
2. `/hr` 기술 경로와 `APP.HCM` 정본을 보존하면서 HRIS의 전체 메뉴 구조와 모듈 관계를 첫 화면에서 검토할 수 있게 한다.
3. `SYS / HRM / TIM / PAY / PER`마다 대표 시작 화면 하나만 실제 동작하게 한다.
4. 나머지 목표 메뉴는 구현된 것처럼 위장한 빈 route를 양산하지 않고, 상태가 명확한 제품 지도에서 향후 범위로 제시한다.
5. 시각 완성은 기능 완료 뒤 모듈별 Design AI 전달 패키지와 승인된 디자인 교체 단계에서 수행한다.

따라서 이 기록은 `implementation-readiness-and-five-session-plan.md`의 전체 모듈 G2/G3 제한을 해제하지 않는다. 기존 DWP API와 읽기/제한적 자기수정 계약을 재사용하는 아래 다섯 vertical slice와 공통 shell/catalog에만 예외적으로 코드 진행을 허용한다. 새로운 원장·테이블·계산·마감·법정 결과를 만들거나 운영 권한을 활성화하는 근거로 사용할 수 없다.

## 2. 1차 제품 구조

사용자에게는 개발 모듈명을 최상위 메뉴로 강요하지 않고, 업무 목적에 따라 다음 작업면을 제공한다.

| 작업면 | 사용자가 해결하는 질문 | 개발 owner |
|---|---|---|
| HRIS 홈 | 지금 할 일과 사용할 수 있는 HRIS 영역은 무엇인가 | SYS |
| 내 HR | 내 정보·근태·휴가·급여·성과·요청을 어디서 처리하는가 | HRM/TIM/PAY/PER |
| 내 팀 | 팀원과 승인·근태·휴가·성과 판단을 어디서 처리하는가 | HRM/TIM/PER |
| HR 운영 | 사람·조직·근태·급여·성과의 예외와 실행을 어디서 관리하는가 | HRM/TIM/PAY/PER |
| HRIS 설정 | 다음 효력일에 적용할 규칙과 확장을 어디서 관리하는가 | SYS + domain owner |
| DWP 관리자·감사 | 앱 자격·권한그룹·SoD·감사·보존을 어디서 통제하는가 | DWP Auth/Platform/Audit |

`SYS / HRM / TIM / PAY / PER`는 소스 분석과 코드 소유권을 나누는 표식이며, 일반 사용자의 1차 탐색 구조가 아니다. 메뉴는 앱 entitlement, capability, 대상집단, 필드 정책, 설치 모듈·국가팩·테넌트 설정의 교집합으로 투영한다.

## 3. 목표 메뉴 카탈로그와 1차 route 원칙

`uiux-and-menu-blueprint.md` 2.1~2.8의 76개 노드를 단일 typed catalog에 등록한다.

| 영역 | 노드 수 | 합계 |
|---|---:|---:|
| 개인 업무 | 8 | 8 |
| 팀 업무 | 7 | 15 |
| HR 운영 — 인사/조직 | 10 | 25 |
| HR 운영 — 근태/휴가 | 10 | 35 |
| HR 운영 — 급여/법정 | 14 | 49 |
| HR 운영 — 성과 | 8 | 57 |
| HRIS 설정 | 13 | 70 |
| DWP 관리자 연결 | 6 | 76 |

카탈로그는 최소한 `nodeId`, `label`, `description`, `workSurface`, `moduleOwner`, `personas`, `deliveryStatus`, `availability`, `route 또는 externalTarget`을 분리한다. `deliveryStatus`는 `PILOT / PLANNED / BLOCKED / EXTERNAL`로 표현하고, `availability`와 권한 판정을 완료율로 오인하지 않는다.

- 현재 25개 governed `/hr/**` route는 호환성과 기존 테스트를 위해 유지한다.
- 1차 대표 화면만 `PILOT` 링크로 활성화한다.
- `PLANNED`와 `BLOCKED`는 클릭 가능한 가짜 화면이나 성공 동작으로 만들지 않는다.
- DWP 관리자·감사 6개 항목은 HRIS 내부 설정 화면으로 복제하지 않고 소유 제품으로 연결되는 `EXTERNAL` 항목으로 표시한다.
- BENSK와 ADDSK는 카탈로그·코드·fixture에 포함하지 않는다.

## 4. 1차 대표 vertical slice

| 모듈 | canonical route | 1차 기능 | 명시적 경계 |
|---|---|---|---|
| SYS | `/hr/home` | 76개 목표 구조, 작업면·모듈·상태 탐색, 실제 시작점 연결 | 설정 게시·권한 변경·확장팩 설치 없음 |
| HRM | `/hr/operations/people` | 실제 People 검색과 상세 진입, deep link, 기준일·필터·마스킹 의미 | 새로운 HR 원장·일괄 발령 없음 |
| TIM | `/hr/time` | 실제 주간 근태 조회·제한된 입력, 로컬 날짜·충돌·권한·원천 상태 | 스케줄 생성·해석·마감·급여 인계 없음 |
| PAY | `/hr/pay` | 연결된 원천의 본인 급여명세 발행 상태와 provenance/redaction 표시 | 급여 계산·확정·지급·세무 신고 없음 |
| PER | `/hr/talent` | 본인 목표 진행률 조회·명시적 저장과 충돌 복구 | `ACTIVE / AT_RISK` 진행률만 수정하며 상태전이·점수·등급·평가주기 제출·확정 없음 |

대표 화면은 현재 backend 계약에 실제 연결하고 loading, empty, error, 401/403, 409 또는 stale, unavailable/unknown을 해당 계약에 맞게 구분한다. 데이터가 없거나 기능이 제공되지 않는 상태를 성공처럼 보이는 fixture로 채우지 않는다.

## 5. 권한 경계

목표 권한식은 다음과 같다.

```text
HRIS 화면 허용
  = APP.HCM:VIEW (APP.HRIS compatibility alias 포함)
  ∩ 메뉴 atomic duty
  ∩ 대상집단/업무 scope
  ∩ 민감 필드·목적 정책
  ∩ SoD 및 step-up 조건
```

권한그룹은 DWP 기존 권한 체계를 확장해 `직원 · 관리자 · 업무운영자 · 설정관리자 · 전사감사자` persona bundle 아래 원자 업무를 조합한다. 다만 현재 authorization v6에는 모든 HCM route를 강제하는 app entitlement 부모 gate가 없으므로 1차 UI를 운영 보안 완료로 선언하지 않는다. append-only authorization v7, Auth 부모 gate, People/Platform owner PEP와 negative test가 함께 준비되고 shadow/canary 검증을 통과한 뒤 별도 활성화한다. Auditor는 우회권한이 아니며 부모 앱 자격과 감사 atomic duty 및 필드 마스킹을 모두 요구한다.

## 6. 구현 소유권

| 소유자 | 수정 범위 |
|---|---|
| SYS 세션 | HRIS typed catalog, explorer/home, 표시명 사전, superseding ADR, catalog 단위 테스트 |
| HRM 세션 | `features/hris/people/**` 대표 화면과 테스트 |
| TIM 세션 | `features/hris/time/**` 대표 화면과 테스트 |
| PAY 세션 | `features/hris/payroll/**` 대표 화면과 테스트 |
| PER 세션 | `features/hris/performance/**` 대표 화면과 테스트 |
| Backend 보강 | People 상세 효력일·조직 scope, 검색 field grant, PER progress-only 원자 조건과 negative test |
| 통합 task | `pages/hcm.tsx` 중앙 wiring, 병합, 전체 회귀, 실행 증거와 최종 판정 |

모든 구현은 frontend integration baseline `7a068a705a6f2ca231b9b0ecd0e6e40591d315de`와 backend baseline `122fbecf39470897ef1ec7442f76ddd5a5863bd3`에서 시작했다. 최종 보안 회귀 보강까지 반영한 커밋은 위에 기록했으며, 이번 slice에는 backend migration이나 schema 변경을 포함하지 않았다.

## 7. 수용 기준

1. 사용자 노출 앱 이름과 HRIS shell 용어가 `HRIS`로 일관되고, 기술 호환 ID/URL은 유지된다.
2. catalog 노드가 정확히 76개이며 ID·route가 중복되지 않고 모듈/작업면/상태 합계가 테스트로 고정된다.
3. 기존 governed HCM route 25개와 authorization 계약 테스트가 깨지지 않는다.
4. 다섯 대표 route는 각자 실 API 계약을 사용하며 미제공 업무를 수행한다고 주장하지 않는다.
5. desktop과 mobile에서 전체 구조와 대표 시작점을 탐색할 수 있고, keyboard/focus/semantic label 및 200% 확대에서 핵심 동작을 잃지 않는다.
6. typecheck, architecture, unit/integration, production build, HCM desktop/mobile E2E와 접근성 점검 결과를 남긴다.
7. 실패한 검증이나 미완성 권한 v7은 숨기지 않고 차단/후속으로 보고한다.

독립 감사에서 확인된 다섯 경계(HRM 상세 scope, 마스킹 필드 검색 추론, People 403 cache PII, TIM 권한 상실 뒤 재전송, PER 상태전이)는 최종 커밋에서 모두 보강했다. 다음 전체 모듈 세션은 의도적인 post-G0 변경을 포함한 새 integration checkpoint가 승인된 뒤 시작한다.

## 8. 이번 1차에 포함하지 않는 것

- SKKF 테이블·controller·route의 1:1 복제
- 76개 노드 각각의 빈 route 생성
- 신규 HRM/PER/TIM/PAY 원장이나 Flyway migration
- 급여 계산·확정·지급, 근태 해석·마감, 평가 점수·확정의 구현
- 운영 authorization v7 및 실제 고객 access package 배포
- 실제 고객 데이터, 운영 연계, 법정 결과의 검증
- G4, G5A, G5B, G5C 또는 전체 HRIS 완료 선언

## 9. 후속 Design AI 작업지시

각 모듈은 자기 전체 기능이 G4를 통과한 뒤 `session-prompts/90-design-ai-handoff-output-contract.md`에 따라 전체 메뉴·route·하위 surface의 Design AI 전달 패키지를 만든다. SYS가 공통 shell·HRIS 홈·공통 디자인 계약을, HRM/PER/PAY/TIM이 각 도메인 화면군을 소유한다. `UNMAPPED=0`, orphan=0, 독립 검토, verification JSON과 무결성 ZIP이 없는 모듈은 G5A로 종료할 수 없다. 디자인 반환 전은 `WAITING_EXTERNAL_DESIGN`, 승인 디자인의 코드 반영과 기능·권한·상태·접근성·반응형 회귀까지 통과해야 `G5C VISUAL_REPLACEMENT_COMPLETE`다.

## 10. 종료 보고 형식

통합 task는 다음을 각각 `완료 / 부분완료 / 차단 / 미착수`로 보고한다.

- 표시명과 공통 shell
- 76개 메뉴 catalog 및 explorer
- SYS/HRM/TIM/PAY/PER 대표 기능
- 기존 25개 route 호환
- 권한 v7 목표 계약과 현재 활성화 상태
- desktop/mobile/접근성/테스트 증거
- 전체 모듈 구현을 시작하기 전에 필요한 다음 결정
