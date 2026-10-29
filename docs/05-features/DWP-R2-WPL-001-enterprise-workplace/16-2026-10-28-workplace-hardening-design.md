# Workplace 고도화 설계 및 완료 기준

- 기준일: 2026-10-28
- 범위: `DWP-R2-WPL-001 Enterprise Workplace`
- 상태: 코드 구현 및 범위 내 자동 검증 완료 / 외부 운영 Gate `BLOCKED_EXTERNAL`
- 원칙: URL·권한·감사 계약을 보존하고, 외부 승인이나 운영 증거가 없는 기능은 활성화하지 않는다.

## 1. 목표와 비목표

이번 고도화는 사용자가 공간을 탐색하고 예약·길찾기·출입을 완료하는 흐름과 운영자가 예외를
종결하는 흐름을 하나의 신뢰 가능한 제품 계약으로 정리한다. 기능 추가보다 다음 네 가지를 우선한다.

1. 입력한 조건이 공유 URL, 예약 명령, 출입 패스에 손실 없이 이어질 것
2. 재시도·보존·라이프사이클 작업이 데이터 규모와 장애에 관계없이 유한하고 관측 가능할 것
3. 정밀 권한, 멱등성, 결과 미확정 상태가 운영 환경에서 우회되지 않을 것
4. 메뉴와 릴리스 Gate가 실제 구현·테스트·외부 승인 상태를 정확히 설명할 것

주차 차량·EV 충전과 같이 고객 수요와 별도 도메인 계약이 필요한 확장은 이번 범위에 포함하지 않는다.
또한 외부 Provider 자격 증명, 보안 승인, 부하 시험 결과를 코드로 대체하거나 완료로 간주하지 않는다.

## 2. 변경 불가 계약

- 기존 `/workplace/**` 정식 경로와 `/rooms/**` 호환 리다이렉트는 유지한다.
- 메뉴 재그룹화는 표시 순서와 제목만 바꾸며 PAGE authority, capability, deep link를 바꾸지 않는다.
- 관리 화면은 최신 서버 권한과 scope를 다시 확인하며 마지막 관리 경로를 자동 복원하지 않는다.
- 고위험 명령은 `Idempotency-Key`, 명시적 확인, 결과 영수증 또는 `RESULT_UNKNOWN` 복구 경로를 갖는다.
- 일회성 출입 자격 증명은 대상·패스가 바뀌거나 화면이 비활성화될 때 즉시 폐기한다.
- Product Authorization bundle은 외부 승인 전까지 `DRAFT`; 프런트는 공식 백엔드 산출물과 byte-equivalent
  snapshot을 사용한다.
- Production에서는 Workplace exact PEP를 명시적으로 활성화하지 않으면 기동 또는 readiness가 실패한다.

## 3. 설계

### 3.1 사용자 여정

- 길찾기 공유 URL에 `site`, `origin`, `destination`, `accessible`, `avoidStairs`를 모두 직렬화하고 복원한다.
- 출입 패스 패널은 destination/pass identity를 보안 경계로 사용한다. 경계가 바뀌면 pairing, credential,
  QR/NFC payload, 복사 상태와 오류를 초기화한다.
- 클립보드 성공 후에만 완료 피드백을 표시하고 실패 시 접근 가능한 오류와 재시도 방법을 제공한다.
- 반복 예약은 정책의 `allowRecurring`과 일치할 때만 노출한다. 사용자가 빈도와 종료일을 확인한 뒤
  canonical recurrence payload를 전송하며, 정책 비허용·과거 종료일·범위 초과는 클라이언트와 서버 계약에서
  모두 거부한다.

### 3.2 작업 중심 정보 구조

사용자 영역은 `시작 및 예약`과 `현장 이용`으로, 관리 영역은 `운영 대응`, `공간 및 정책`,
`서비스 운영`, `방문 및 출입`으로 구분한다. 28개 정식 메뉴의 경로·권한·view id는 그대로 두고,
한 그룹에서 찾아야 하는 선택지만 줄인다. 회의 승인과 회의 정책은 각각 운영 대응과 공간 및 정책에
배치해 사용자의 업무 목적과 같은 위치에서 찾게 한다.

### 3.3 라이프사이클과 보존

- 예약 만료·노쇼 처리는 설정 가능한 batch size와 실행 시간 예산을 사용한다.
- 데이터 잠금 범위를 batch로 제한하고, 한 실행에서 처리할 수 없는 항목은 다음 실행으로 넘긴다.
- 보존 작업은 단일 500행 실행이 아니라 시간 예산 내 반복 배치로 drain한다.
- 작업별 처리량, 남은 backlog, oldest age, retry exhaustion, retention lag를 metric으로 노출한다.
- 다중 인스턴스에서도 같은 행을 중복 소유하지 않도록 DB claim/locking 계약을 사용한다.

### 3.4 안전·예외·보안

- offline safety incident는 최대 재시도 후 `MANUAL_REVIEW_REQUIRED`와 같은 종결 가능한 상태로 전이하며,
  운영 큐에서 재시도·확인 CTA를 제공한다. 재시도 소진 항목을 `OFFLINE_QUEUED`로 영구 잔류시키지 않는다.
- 예외 콘솔은 safety, booking, connector뿐 아니라 device, service provider, refund, visit, access pass의
  결과 미확정·재시도 소진 항목을 공통 source contract로 투영한다.
- 미해결 예외는 생성 후 24시간이 지났다는 이유만으로 사라지지 않는다. 해결 시각과 보존 정책을 분리한다.
- force-cancel과 legal-hold는 같은 멱등성 저장소·충돌 규칙·영수증 계약을 사용한다.

### 3.5 릴리스·성능·관측

- 프런트 snapshot과 생성 TypeScript를 공식 backend v62 registry로 동기화하고 CI에서 drift를 차단한다.
- PR은 핵심 사용자·관리 smoke를 Chromium desktop과 mobile viewport에서 실행한다.
- 전체 Workplace E2E는 nightly와 수동 release gate에서 실행하고 live suite는 명시적 환경 계약이 없으면
  성공으로 가장하지 않고 별도 Gate 상태로 보고한다.
- `/workplace/**`는 route group별 Web Vital budget과 탐색→예약 검토→명령→영수증 funnel을 사용한다.
  분석 이벤트는 보안 감사와 분리하고 동의·보존 Gate가 닫힌 경우 전송하지 않는다.

## 4. 완료 기준

다음 조건을 모두 만족해야 코드 범위를 완료로 판정한다.

- Product Authorization sync check, TypeScript, lint, 관련 Vitest/JUnit 테스트 통과
- 사용자 URL round-trip, 민감 상태 격리, 반복 예약 정책, 클립보드 실패 테스트 통과
- 예약·보존 batch의 상한/시간 예산/잔여 backlog/다중 실행 테스트 통과
- safety retry exhaustion, 확장 exception source, production PEP, 멱등성 회귀 테스트 통과
- IA의 28개 정식 경로·권한·deep link 보존 테스트 통과
- Workplace PR smoke와 full E2E workflow의 정적 계약 테스트 통과
- 문서의 구현 상태와 자동 증거가 실제 저장소 상태와 일치

외부 Provider 자격 증명, 실제 통합 환경 부하·보안 시험, Identity/Security/Product owner 승인은 별도 릴리스
Gate다. 이 증거가 없으면 코드 완료와 관계없이 Production readiness는 `BLOCKED_EXTERNAL`을 유지한다.

## 5. 롤백과 운영 안전

- 데이터 상태 추가는 forward-compatible migration으로 배포하고 기존 값을 먼저 읽을 수 있게 한다.
- 배치 설정은 보수적인 기본값을 사용하되 `0`이나 무제한으로 해석되는 값을 허용하지 않는다.
- IA 변경은 route가 아닌 그룹 배열 변경이므로 이전 그룹 순서로 즉시 되돌릴 수 있다.
- v62 snapshot은 immutable 공식 artifact에서만 재생성한다. 수동 편집은 CI checksum에 의해 거부한다.
- exact PEP와 Provider 연계는 production에서 fail-closed이며, 장애 완화를 위해 우회 플래그를 제공하지 않는다.

## 6. 구현 및 검증 결과

### 6.1 완료된 코드 범위

- 반복 예약 생성·복구·rebook은 하나의 서버 정책 판정과 취소 시점 snapshot을 사용하며, legacy snapshot
  부재와 managed-room 정책 부재는 fail-closed 처리한다.
- safety retry exhaustion은 `MANUAL_REVIEW_REQUIRED`로 종결되고, 예외 콘솔은 9개 source의 exact count,
  250건 export 상한, 직접 detail 조회, `REPEATABLE_READ` 일관성을 사용한다.
- device, service order·adjustment·provider, visit의 owner deep link는 요청 ID와 응답의 parent identity가
  일치할 때만 열리며, access pass는 교차 사용자 노출을 막기 위해 owner URL을 만들지 않는다.
- force-cancel과 legal-hold는 elevated PEP, 필수 멱등성 키, fingerprint 충돌 검사와 durable receipt replay를
  사용한다. production exact PEP가 없으면 기동이 실패한다.
- 프런트 authority fixture는 transport contract v2의 6개 source revision을 사용하고, 예외 행 선택 직후
  owner 명령을 실행해도 마지막으로 선택한 행과 명령 대상이 분리되지 않는다.

### 6.2 자동 증거

- 백엔드 반복 예약 단위 테스트 24/24, Flyway·PostgreSQL 통합 테스트 6/6 통과
- 백엔드 Safety·예외 repository·access-pass PostgreSQL 테스트 및 PEP·멱등성·OpenAPI contract 테스트 통과
- 공식 OpenAPI exporter 47/47 및 approved snapshot check 통과; 최종 동기화 Gateway 1,769 paths,
  기존 messaging 9 paths 보존
- 프런트 OpenAPI sync/check 통과; 핵심 Workplace Vitest 18 files/83 tests와 최종 계약 보강 3 files/12 tests 통과
- 예외 콘솔 대상 E2E는 기존 통과 6건에 수정한 exact owner desktop/mobile 2/2를 더해 대상 8건을 검증했고,
  방문자 elevated 관리 대상은 기존 통과 3건과 수정한 mobile 1/1을 검증했다.
- 변경 파일 ESLint, Prettier, `git diff --check` 통과; 독립 교차 감사에서 P0/P1/P2 추가 결함 없음

### 6.3 공유 워크트리 Gate 상태

단일 Workplace smoke는 재시작 없이 170개를 끝까지 실행해 125개가 통과했다. 범위 내 실패였던 authority
fixture와 번역 키는 수정 후 대상 검증을 통과했다. 잔여 실패는 모바일 프로젝트에서 데스크톱 panel 역할과
숨김 control을 찾는 기존 중복 전제, 범위 밖 Home 진입 mock, 실행 중 Vite module load 간섭으로 분류했으며
전체 suite를 반복 실행해 결과를 가장하지 않았다.

전체 TypeScript 검사는 Workplace 오류를 모두 제거한 뒤에도 Notification, Activity, Calendar, Home, HRIS,
Messaging의 공유 워크트리 변경 때문에 non-zero다. 전체 i18n/display dictionary의 기존 HRIS·Spaces·Calendar
debt도 이 변경의 성공으로 표기하지 않는다. 이 repository-wide Gate와 외부 Provider 자격 증명, 통합 환경
부하·보안 시험, Identity/Security/Product owner 승인이 모두 확보되기 전까지 Production readiness는
`BLOCKED_EXTERNAL`이다.
