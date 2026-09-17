# Stitch 17 방문자·출입 구현 계약

- 기준일: 2026-09-16
- 디자인 기준: Stitch 17 최종 시안과
  [글로벌 고도화 설계](./09-글로벌-고도화-디자인-AI-프롬프트-아키텍처.md)
- 완료 판정: 화면의 존재나 Demo 데이터가 아니라 아래 사용자·관리자·Kiosk 수직 여정과 운영 증거가
  모두 통과한 경우

## 1. 경계와 소유권

`Visit & Access`는 방문 일정과 준비 상태를 소유한다. 예약 원본은 `WORKPLACE` 또는 `CALENDAR`가
계속 소유하며 방문 도메인은 `ReservationReference(authority, id, version)`만 보존한다.

방문자 원문 이름·연락처·신분증은 이 Aggregate에 저장하지 않는다. `GuestRef`는 승인된 Visitor
Provider 또는 개인정보 Vault가 발행한 불투명 참조, 마스킹 표시값, 목적, 필드별 보존 만료만 가진다.
QR·NFC·Badge credential과 재사용 가능한 체크인 토큰은 저장·응답·로그·감사 Snapshot에 포함하지
않는다. Access Control Provider가 짧은 만료와 회수를 책임지고 앱에는 발급 시도와 결과 증거 참조만
남긴다.

## 2. 실제 데이터와 관리 메뉴

Fixture만으로 정상 상태를 만들 수 없다. 다음 데이터는 각각 실제 관리 메뉴와 Version 기반 쓰기
API를 가진다.

| 관리 메뉴   | 소유 데이터                                                              | 필수 명령                                            |
| ----------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| 방문 정책   | 방문 유형, 필수 승인·NDA·신원 확인, 허용 시간, 최소 수집 필드, 보존 기간 | 생성, 수정, 활성·비활성, 영향 Preview                |
| 출입 구역   | Site·Zone, 접근 수준, Provider 매핑, 허용 방문 유형                      | 생성, 수정, 활성·비활성                              |
| 공급자 연결 | Visitor·Access Control 구성 참조와 관측 증거                             | 연결 검사, 상태 조회, 책임자·수동 절차 설정          |
| 방문 예외   | 승인 대기, 발급 실패, 호스트 미응답, 장기 미퇴실                         | 승인·거절, 재시도, 호스트 알림, 수동 처리, 퇴실 확인 |
| Kiosk 장치  | Device identity, Site binding, 정책 버전, Heartbeat, Privacy notice      | 등록, Binding, 활성·폐기, 도움 요청 처리             |

공급자 상태는 `NOT_CONFIGURED`, `CONFIGURED_UNVERIFIED`, `READY`, `DEGRADED`, `STALE`를 구분한다.
구성 버전과 관측 버전, 마지막 성공, Source/Received timestamp, 증거 참조가 일치하지 않으면
`READY`가 될 수 없다.

## 3. 수명주기와 명령

방문 상태는 `DRAFT → PREVIEWED → INVITED → APPROVAL_PENDING/APPROVED → ACCESS_PENDING →
READY → ARRIVED → CHECKED_OUT` 흐름을 사용하며 `REJECTED`, `CANCELLED`, `ACCESS_FAILED`,
`OVERSTAY`, `RESULT_UNKNOWN`을 정상 완료와 분리한다.

주요 명령은 모두 `expectedVersion`, `Idempotency-Key`, 사유, 명시적 확인, Actor, Tenant,
Correlation ID를 받는다. Timeout 뒤 동일 명령을 재전송하지 않고 명령 또는 방문 상태를 조회한다.

1. 방문 Preview는 예약 소유권·Version, 방문 유형, Site, 시간, 접근 구역을 검증하고 필요한 승인,
   문서, 최소 개인정보, Provider 준비 상태와 제한 사유를 반환한다.
2. 초대 생성은 Preview Snapshot과 GuestRef만 소비하며 초대 발송·문서·승인·출입·Badge·호스트 알림
   단계별 Timeline을 만든다.
3. 출입 요청은 승인된 최소 Site·Zone과 방문 시간에 한정한다. Provider 결과 불명은 재시도 성공으로
   위장하지 않고 `RESULT_UNKNOWN`과 상태 조회 경로를 반환한다.
4. 도착·퇴실은 Kiosk Device identity 또는 권한 있는 운영자 명령으로만 기록한다. Provider credential
   성공이 없으면 `READY`를 표시하지 않고 수동 안내와 책임자를 제공한다.
5. 취소·거절·퇴실은 미사용 credential 회수 시도를 Outbox로 발행하고 결과를 Timeline에 보존한다.

## 4. Canonical API와 화면 연결

### 사용자

- `POST /api/platform/v1/workplace/visits:preview`
- `POST /api/platform/v1/workplace/visits`
- `GET /api/platform/v1/workplace/visits?reservationAuthority=&reservationId=`
- `GET /api/platform/v1/workplace/visits/{visitId}`
- `POST /api/platform/v1/workplace/visits/{visitId}:send-invitation`
- `POST /api/platform/v1/workplace/visits/{visitId}/access-requests`
- `POST /api/platform/v1/workplace/visits/{visitId}:cancel`

예약 상세의 `방문 및 출입` Tab은 이 API만 사용한다. Host 본인과 허용된 대리 Actor만 원문에 가까운
마스킹 정보를 볼 수 있고, 다른 사용자는 방문 존재까지 포함해 권한 정책에 따라 축소한다.

### 관리자

- `GET /api/platform/v1/admin/workplace/visits/exceptions`
- `GET /api/platform/v1/admin/workplace/visits/{visitId}`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:approve`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:retry-access`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:notify-host`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:confirm-checkout`
- 방문 정책·출입 구역·공급자 Binding·Kiosk 장치 CRUD와 상태 API

관리자 목록과 Inspector는 역할별 Masking을 적용하고 조회·검색·변경·내보내기를 감사한다. 고위험
명령은 현재 Elevated access를 요구한다.

### Kiosk

- Device identity와 Site binding을 서버가 검증하는 제한된 Projection만 제공한다.
- Offline, 장치 미등록, Privacy notice 미동의, Provider 미연결, 도움 요청 상태를 독립적으로 표현한다.
- 체크인 입력은 접근 가능한 Label·오류·대체 연락 수단을 제공하고 원문 PII를 브라우저 저장소나
  Telemetry에 남기지 않는다.

## 5. 실패·보안·감사 계약

- 사용자 목록, 관리자 예외, Kiosk Projection은 각기 다른 응답 DTO와 권한 계약을 사용한다.
- Tenant가 다른 Visit·GuestRef·Zone·Device·Command를 FK와 Repository 조건 양쪽에서 차단한다.
- GuestRef 조회와 내보내기는 별도 감사 이벤트를 남기고 보존 만료 뒤 참조와 검색 토큰을 삭제한다.
- Provider Secret과 storage key는 API에 노출하지 않는다.
- 초대·출입·알림 Provider 쓰기는 Inbox/Outbox, 중복 제거, Retry/DLQ, Result unknown 조회를 제공한다.
- Loading, Empty, Partial, Stale, Read-only, Denied, 409, Result unknown, Offline과 수동 복구 행동을
  화면에서 검증한다.

## 6. 완료 증거

1. 실제 PostgreSQL에서 Preview→초대→승인→출입 요청→도착→퇴실과 취소·회수를 검증한다.
2. 중복 Idempotency, Fingerprint 충돌, Version 충돌, 병렬 승인, Provider timeout 뒤 상태 조회,
   Tenant FK 격리를 검증한다.
3. 미연결 Visitor/Access Provider가 `READY`가 되지 않고 수동 책임자 안내를 반환한다.
4. 방문 정책·출입 구역·공급자·Kiosk 관리 메뉴로 화면에 필요한 데이터를 실제 생성·수정할 수 있다.
5. 1440·1280·390·320, 한국어·영어, 200% 확대, 키보드, Axe, 고대비, Reduced motion과 긴 문자열을
   검증하고 고정 Screenshot을 남긴다.
6. Backend Route, Gateway, OpenAPI, Product PEP, Frontend PAGE·DATA·ACTION 계약과 실제 메뉴 도달성이
   같은 버전을 사용한다.
