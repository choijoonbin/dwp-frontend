# Notification R3 P1/P2 Hardening Design

- 기준일: 2026-10-28
- 대상 브랜치: `dwp-dev`
- 상태: 구현 기준선
- 목표: Notification R2의 기능 범위를 유지하면서 제품 정확성, 접근성, 운영 신뢰성,
  보안, 성능, 자동 회귀를 R3 수준으로 강화한다.

## 1. 설계 원칙

1. 장애를 정상이나 `0건`으로 표현하지 않는다. 마지막 성공값, stale, unknown, partial을 구분한다.
2. 사용자에게 `적용` 또는 `저장`으로 보이는 작업은 원자적이거나 명시적인 부분 성공 결과를 제공한다.
3. 고위험 운영 경로는 fail-closed, 멱등성, 감사, 복구, readiness 증거를 함께 갖춘다.
4. 색상, hover, 시각 차트만으로 정보를 전달하지 않는다.
5. URL로 공유하거나 복귀할 가치가 있는 상태는 검증된 URL 상태로 보존한다.
6. 외부 Provider, People Snapshot, Production Kafka 증거가 없으면 활성화 성공으로 표시하지 않는다.
7. 기존 Calendar, Mail, HRIS 등 다른 제품의 진행 중 변경을 Notification 작업에 섞지 않는다.

## 2. 범위

### P1-A 사용자 제품 정확성

- 모바일 상세 필터는 별도 draft에서 편집하고 `적용` 시 한 번만 URL과 조회 범위를 변경한다.
- 닫기, Escape, backdrop은 draft를 폐기한다.
- 필터 트리거는 활성 필터 수를 접근 가능한 이름과 badge로 표시한다.
- 환경설정 자동 저장은 단일 직렬 저장 흐름을 사용한다. 저장 중 변경은 최신 의도로 합쳐지고,
  오래된 응답은 최신 draft를 덮지 않는다.
- Header Glance의 summary 실패는 `0건`이 아니라 마지막 성공값 또는 unknown/stale로 표시한다.
- `모두 읽음`은 bulk 계약을 사용하거나 부분 성공을 명시적으로 정산한다.

### P1-B 신규 Producer 계약 완결

- HRIS 직원 변경 알림의 CTA는 `requestPublicId`를 포함해 정확한 요청을 연다.
- Producer locale은 지원 locale로 제한하거나 언어별 결정적 fallback을 적용한다.
- HRIS 알림은 Backend contract/materialization과 Frontend 표시·이동을 연결한 회귀를 가진다.

### P1-C 접근성

- Noise Quality 추세는 차트와 동일한 값을 제공하는 데이터 표, 범례, 텍스트 요약을 제공한다.
- 위험 상태는 색상 외에 패턴 또는 텍스트를 사용한다.
- Saved View 아이콘·색상 이름은 사용자 언어로 제공한다.

### P1-D 보존·운영 신뢰성

- Production은 무기한 기본 TTL을 허용하지 않는다.
- 보존 정책은 tenant 기본값, 계약 override, legal hold 순서의 결정 규칙을 가진다.
- Main Outbox backlog, oldest age, dead, retry, lease loss와 scheduler last-success를 metric과
  readiness에 연결한다.
- Outbox, maintenance, SSE heartbeat는 서로를 장시간 막지 않는 scheduler 경계를 가진다.
- DLT/poison은 승인·사유·감사·제한 batch를 갖춘 redrive 계약 전까지 자동 replay하지 않는다.

### P1-E 필수 회귀

- Frontend Notification unit/E2E/visual을 별도 CI Gate로 고정한다.
- Backend Notification PostgreSQL RLS, 동시성, append-only, migration을 실제 PostgreSQL에서 실행한다.
- 최소 한 개의 대표 종단 경로는 실제 Gateway/Notification/PostgreSQL/Redis/Kafka 경계를 검증한다.

### P2-A URL·지원 가능성

- 설정의 section, diagnostics, app 선택은 검증된 URL query로 복원된다.
- 오류 correlation ID는 민감정보 없이 사용자에게 복사 가능한 지원 ID로 제공된다.
- 모바일에서도 마지막 성공 동기화 시각을 확인할 수 있다.

### P2-B 성능·유지보수

- Settings와 각 Admin route는 서로 다른 dynamic entry를 사용한다.
- Notification route별 raw/gzip chunk, 전환 시간, 30/300/1000건 목록과 burst 예산을 둔다.
- 900~1000줄의 화면 파일은 query/mutation controller, draft reducer, section view 경계로 분리한다.
- SSE leader election, handoff, cursor reset, offline/hidden, 429 Retry-After를 결정론적으로 검증한다.

### P2-C 보안·배포 안전성

- Production 환경 식별은 필수이며 누락을 local로 간주하지 않는다.
- Product Authorization v4는 승인된 bundle과 rollout 증거가 있을 때 production에서 필수다.
- Producer 인증은 rotation 가능한 key ID/dual key 또는 workload identity 경계를 제공한다.
- 외부 채널은 실제 Provider credential, callback, suppression, endpoint lifecycle과 실패 drill이
  준비될 때만 readiness가 `READY`가 된다.

## 3. 외부 의존성 경계

다음 항목은 저장소 코드만으로 Production 완료를 선언하지 않는다.

- Email, Web/Mobile Push, Teams, Slack의 실제 Provider 계정·자격증명·발신 도메인
- People Target Population Snapshot 기반 조직·Role audience
- Production Kafka HA, peak load, DR 및 장애 복구 실행 증거
- Retention, residency, legal hold, support session의 조직 승인

이번 구현은 위 의존성이 없을 때 설정과 진단을 비활성/차단 상태로 유지하고, 필요한 adapter,
readiness, audit, test seam을 제공한다. Stub 성공이나 가짜 수치로 완료 처리하지 않는다.

## 4. 데이터·상태 전이

### 모바일 필터

`persisted filters -> open draft -> edit draft -> apply -> persisted filters`

- cancel/close: `draft` 폐기
- apply: canonicalize 후 단일 `onChange`
- reset: draft만 초기화하고 apply 전에는 서버 조회를 바꾸지 않음

### 환경설정 저장

`persisted(version N) + latest intent -> serialized save -> persisted(version N+1)`

- 저장 중 추가 intent는 pending draft로 병합
- 응답은 요청 sequence가 최신일 때만 화면 정본으로 반영
- 409는 서버 최신 version에 사용자 변경 delta를 한 번 rebase
- 실패 시 마지막 서버 정본과 아직 저장되지 않은 사용자 의도를 구분해 안내

### 운영 상태

- `LIVE`: 의존성 정상, freshness/SLO 이내
- `DEGRADED`: 부분 실패 또는 backlog threshold 초과
- `STALE`: last-success가 freshness threshold 초과
- `BLOCKED`: 필수 보안·Provider·환경 설정 미충족
- `UNKNOWN`: 증거를 조회할 수 없음

## 5. 수용 기준

### Frontend

- 모바일 필터 cancel/apply, active count, URL round-trip E2E 통과
- 연속 3회 설정 변경과 역순 응답에서도 마지막 의도가 보존됨
- summary 5xx에서 기존 badge가 0으로 사라지지 않고 stale/unknown이 노출됨
- Noise chart의 모든 점을 표와 스크린리더로 확인 가능
- 320, 390, 1280, 1440px, 200%, keyboard, reduced motion, dark/high contrast 통과
- Settings/Admin route chunk가 독립 dynamic entry로 생성됨

### Backend

- HRIS `ko-KR`, `en-US`, unsupported locale의 결정적 동작과 정확한 deep link 검증
- Production TTL 0, 환경 누락, 미승인 v4, Provider 미준비는 startup/readiness에서 차단
- Outbox backlog/oldest/dead와 scheduler staleness가 metric·health에 반영됨
- PostgreSQL RLS·migration·동시성·retention·outbox 검증 통과

### CI·증적

- Notification Frontend와 Backend 전용 workflow를 필수 Gate로 실행 가능
- 실행 SHA, 테스트 수, skip 사유, visual baseline 수를 최신 완료 증적에 기록
- 외부 Gate는 코드 Gate와 별도 상태로 유지

## 6. 롤아웃 순서

1. 사용자 정확성·접근성 수정
2. HRIS 계약과 보존·환경 fail-closed 보강
3. Outbox health/readiness와 scheduler 격리
4. Notification 전용 CI와 실제 PostgreSQL Gate
5. Route 분할·SSE 제어 루프·성능 예산
6. 외부 Provider/People/Kafka 운영 증거 연결 후 채널별 점진 활성화

## 7. 완료 판정

코드로 통제 가능한 P1/P2 수용 기준과 자동 검증이 모두 통과해야 R3 내부 완료다.
외부 자격증명·조직 정책·Production 실행 증거가 필요한 항목은 `BLOCKED_EXTERNAL`로 남기며,
이를 내부 완료나 Production 출시 완료로 표현하지 않는다.
