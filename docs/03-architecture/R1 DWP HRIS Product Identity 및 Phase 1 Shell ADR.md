# R1 DWP HRIS Product Identity 및 Phase 1 Shell ADR

> 상태: Accepted for Phase 1
>
> 기준일: 2026-09-09
>
> 적용 저장소: `dwp-frontend`
>
> 대체 범위: [R1 DWP HCM Product Shell 및 Role-Aware Experience ADR](R1%20DWP%20HCM%20Product%20Shell%20및%20Role-Aware%20Experience%20ADR.md)의 사용자 노출 제품명 결정만 대체한다.

## 1. 결정

DWP의 기존 한국어 `인사`, 영어 `HR`, 제품군 `DWP HCM` 사용자 노출 이름을 모두 `HRIS`로
통일한다. 기술 계약은 이 변경에서 개명하지 않는다.

- 애플리케이션 ID `hcm`, 기본 경로 `/hr`, canonical entitlement `APP.HCM`을 유지한다.
- `APP.HRIS`는 기존 호환 alias 계약을 유지하며 신규 canonical key로 승격하지 않는다.
- People·Workforce bounded context, API, 감사 source key와 `hcm-home` preference key를 유지한다.
- `인사정보`, `HR 운영`, `HR 요청`처럼 업무 의미를 나타내는 일반 명사는 제품명으로 간주하지
  않는다.

이 결정은 이전 ADR의 보안 경계, 데이터 소유권, 유효일, target population, field masking,
서비스 분리 결정을 변경하지 않는다.

## 2. Phase 1 정보구조

사용자가 이해하는 작업면은 `HRIS 홈 / 내 HR / 내 팀 / HR 운영 / HRIS 설정` 다섯 개다.
개발 소유 단위인 `SYS / HRM / TIM / PAY / PER`는 필터와 배지로 설명하며 최상위 사용자
내비게이션으로 노출하지 않는다.

Phase 1 제품 지도는 76개 목표 메뉴를 다음과 같이 고정한다.

| 제품 영역            | 메뉴 수 |
| -------------------- | ------: |
| 내 HR                |       8 |
| 팀                   |       7 |
| 인사·조직 운영       |      10 |
| 근태·휴가 운영       |      10 |
| 급여·법정 운영       |      14 |
| 성과 운영            |       8 |
| HRIS 설정            |      13 |
| DWP 관리자·감사 연결 |       6 |

기존 25개 HCM runtime route와 sidebar 계약은 그대로 유지한다. 76개 목표 메뉴를 1차 route로
복제하거나 빈 화면으로 연결하지 않는다. 목록·등록·상세·팝업으로 분산됐던 SKKF 흐름은 향후
list-detail, workflow, command center, studio로 통합한다.

## 3. Walking skeleton 계약

각 개발 모듈에서 현재 검증 가능한 시작점 하나만 `PILOT`으로 연다.

| 모듈 | 시작점       | 경로                    |
| ---- | ------------ | ----------------------- |
| SYS  | HRIS 홈      | `/hr/home`              |
| HRM  | 사람 360°    | `/hr/operations/people` |
| TIM  | 내 근태      | `/hr/time`              |
| PAY  | 급여 및 세무 | `/hr/pay`               |
| PER  | 목표 및 평가 | `/hr/talent`            |

나머지는 `PLANNED`, 정책·원천 증빙이 필요한 기능은 `BLOCKED_EVIDENCE`, DWP 중앙 관리자에서
소유할 기능은 `EXTERNAL`로 표시한다. 세 상태에는 `href`나 실행 action을 제공하지 않는다.
메뉴 개발 상태, 패키지 설치 상태, runtime 권한 판정은 서로 다른 필드로 관리한다. 따라서
`PLANNED`를 권한 거절로, 화면 렌더링을 기능 완료로 해석하지 않는다.

## 4. 권한 경계

제품 지도는 로드맵 설명용이며 authorization 결과가 아니다. 현재 route의 기존 gateway·service
PEP와 field masking은 계속 적용한다. 사용자가 요청한 `HRIS 앱 entitlement ∩ 하위 메뉴
capability` 교집합 강제는 canonical authorization registry와 gateway PEP가 함께 진화하는 별도
보안 게이트에서 완료해야 한다. Phase 1 표시명·제품 지도만으로 그 강제가 구현됐다고 주장하지
않는다.

직원·관리자·업무운영자·설정관리자·전사감사자는 제품 지도 필터 언어로 사용하되, 역할명 자체로
민감 데이터 접근을 허용하지 않는다. Provider support와 감사 읽기 예외도 별도 시간·목적·범위
정책을 요구한다.

## 5. 검증

- 카탈로그 ID 유일성, 영역별 수량, 정확히 다섯 개 PILOT 경로를 단위 테스트로 고정한다.
- PILOT 이외 상태에 route/action이 없음을 테스트한다.
- 제품 지도는 Home API 로딩·실패·성공과 무관하게 유지한다.
- 한국어·영어 shell, launcher, notification source와 정적 fallback에서 `HRIS` 노출을 검증한다.
- 기존 25개 route와 authorization generated artifact는 이 변경에서 수정하지 않는다.
- 1440/1280/390/320px, 200% 확대, keyboard, 명시적 focus, 고대비·dark mode, reduced motion을
  통합 시각 검증에서 확인한다.
