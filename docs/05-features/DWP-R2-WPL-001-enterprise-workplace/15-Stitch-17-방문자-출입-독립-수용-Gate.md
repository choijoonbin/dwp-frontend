# Stitch 17 방문자·출입 독립 수용 Gate

- 기준일: 2026-09-16
- 권위 계약: [Stitch 17 방문자·출입 구현 계약](./14-Stitch-17-방문자-출입-구현-계약.md)
- 보조 기준: [글로벌 고도화 설계](./09-글로벌-고도화-디자인-AI-프롬프트-아키텍처.md),
  [Stitch 14–23 디자인 수용 판정](./10-Stitch-14-23-디자인-수용-판정.md),
  [Stitch 14–23 수정 최종본 재수용 판정](./11-Stitch-14-23-최종본-재수용-판정.md)
- 판정 원칙: 화면이 렌더되거나 Fixture가 정상으로 보인다는 사실만으로 완료를
  판정하지 않는다. 사용자·관리자·Kiosk 수직 여정, 실제 PostgreSQL, 실제 권한,
  Provider 증거, 개인정보 제약, 장애 복구, 반응형·접근성 증거가 모두 필요하다.

## 1. 현재 기준선

2026-09-16 읽기 전용 감사에서 다음 경로를 검색했다.

- Frontend: `apps`, `libs`, `e2e`, `architecture`
- Backend: `dwp-platform-server`, `dwp-gateway`, `dwp-auth-server`,
  `dwp-platform-contracts`, `contracts`
- 검색 키워드: `/workplace/visits`, `visits:preview`, `GuestRef`,
  `CredentialProvisioningAttempt`, `VisitState`

제품 코드, 독립 테스트, 공식 PAGE·DATA·ACTION 계약은 **0건**이다. 문서와
디자인이 구현 증거를 대신하지 않는다. 이 문서의 매트릭스는 현재 통과 목록이
아니라 다음 구현 wave가 충족해야 하는 출시 Gate다.

## 2. 필수 경계와 원천 소유권

- `Visit & Access`는 방문 일정과 준비 상태만 소유한다.
- 예약 원본은 `WORKPLACE` 또는 `CALENDAR`가 소유한다. 방문 도메인은
  `ReservationReference(authority, id, version)`만 보존하고 명령 직전에 소유권과
  Version을 다시 검증한다.
- `GuestRef`는 승인된 Visitor Provider 또는 개인정보 Vault가 발급한 불투명
  참조다. 마스킹 표시값, 목적, 필드별 보존 만료 이외의 원문을 Visit Aggregate에
  저장하지 않는다.
- QR·NFC·Badge credential, 재사용 가능한 체크인 Token, Provider secret, storage key는
  DB·API·로그·Trace·감사 Snapshot·Screenshot에 남지 않는다.
- Kiosk는 사람 계정이 아닌 Device identity와 Site binding을 사용하며 제한된
  Projection만 받는다.

## 3. P0 수직 수용 매트릭스

| ID        | 여정·상태                                              | Actor·권한                                        | 필수 판정                                                                                                                                                                                                                                                                 | 실제 검증 증거                                                                                   |
| --------- | ------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| V17-P0-01 | 예약 상세에서 방문 Preview                             | Host 또는 유효한 대리 Actor                       | WORKPLACE/CALENDAR 소유자·Version, 방문 유형, Site, 시간, Zone을 실제 원천으로 검증한다. 필수 승인·NDA·신원 확인·최소 수집 필드·Provider 준비 상태와 제한 사유를 반환한다.                                                                                                | `WorkplaceVisitsPostgresTest`, `WorkplaceVisitsControllerTest`, `workplace-visit-access.spec.ts` |
| V17-P0-02 | 다른 사용자·만료된 대리 권한                           | Other user, expired delegate                      | 무권한 Actor에는 PEP 정책에 따라 방문 존재 자체를 숨기거나 축소한다. 다른 Tenant의 Visit·GuestRef·Zone·Device·Command를 Repository 조건과 DB FK 양쪽에서 차단한다.                                                                                                        | 사용자/tenant 부정 케이스가 포함된 PostgreSQL 통합 테스트                                        |
| V17-P0-03 | Preview→초대→승인→출입요청→도착→퇴실                   | Host, approver, provider, kiosk/operator          | `DRAFT → PREVIEWED → INVITED → APPROVAL_PENDING/APPROVED → ACCESS_PENDING → READY → ARRIVED → CHECKED_OUT`를 강제한다. `REJECTED`, `CANCELLED`, `ACCESS_FAILED`, `OVERSTAY`, `RESULT_UNKNOWN`을 성공으로 합치지 않는다.                                                   | 실제 PostgreSQL lifecycle 및 invalid transition 테스트                                           |
| V17-P0-04 | 중복·충돌·Timeout                                      | 모든 mutation Actor                               | 모든 쓰기는 `expectedVersion`, `Idempotency-Key`, 사유, 명시적 확인, Actor, Tenant, Correlation ID를 받는다. 동일 fingerprint는 동일 receipt, 다른 fingerprint는 충돌, 마지막 Version이 아니면 409다. Timeout 뒤 POST를 새 key로 재전송하지 않고 GET으로 상태를 복구한다. | idempotency receipt·fingerprint·version·병렬 승인 통합 테스트                                    |
| V17-P0-05 | Visitor·Access Provider 준비 상태                      | Host, operator                                    | `NOT_CONFIGURED`, `CONFIGURED_UNVERIFIED`, `READY`, `DEGRADED`, `STALE`를 분리한다. 구성/Provider 버전, 최종 성공, source/received 시각, evidence가 일치하고 fresh할 때만 `READY`다.                                                                                      | `WorkplaceVisitProviderTruthTest`, PostgreSQL evidence 테스트, partial/stale E2E                 |
| V17-P0-06 | 출입권한 발급·회수                                     | Approved host, elevated operator                  | 승인된 최소 Site·Zone·방문 시간에만 제한한다. Provider 결과 불명은 `RESULT_UNKNOWN`과 조회 경로를 반환한다. 취소·거절·퇴실은 미사용 credential 회수를 transactional outbox로 발행하고 Timeline에 결과를 보존한다.                                                         | Provider fake와 실제 repository/outbox를 결합한 PostgreSQL 테스트                                |
| V17-P0-07 | 방문 정책·출입 Zone·Provider binding·Kiosk 운영 데이터 | 관리자                                            | 각각 Version 기반 CRUD·활성·비활성과 정책 영향 Preview를 제공한다. Site·자원 유형·Zone·Provider mapping을 DB FK와 tenant predicate로 강제한다. Fixture로 정상 Provider 상태를 만들지 않는다.                                                                              | 관리 API controller·repository·PostgreSQL 테스트                                                 |
| V17-P0-08 | 방문 예외 Queue                                        | Admin view, mutation authority, elevated operator | 오늘 방문, 승인 필요, 발급 실패, Host 미응답, 장기 미퇴실을 Table+Inspector로 처리한다. Read-only는 명령을 실행할 수 없고, 고위험 approve/retry/checkout은 active Elevated access를 요구한다. 조회·검색·변경·내보내기를 감사한다.                                         | PEP/step-up/controller 테스트와 read-only·40403 E2E                                              |
| V17-P0-09 | Kiosk 도착·퇴실                                        | Bound device 또는 권한 있는 operator              | Device identity·Site binding·policy version을 서버가 검증한다. 미등록, wrong tenant/site, Offline, privacy notice 미동의, Provider 미연결, 도움 요청을 서로 다른 상태로 표시한다. 원문 PII를 Web storage나 telemetry에 남기지 않는다.                                     | `WorkplaceKioskPostgresTest`, `workplace-visit-kiosk.spec.ts`                                    |
| V17-P0-10 | 마스킹·보존·삭제                                       | Host, delegate, admin, other user                 | 원문 이름·연락처·신분증을 Aggregate/API/log/audit/outbox에 저장하지 않는다. 권한별 Masking을 적용하고 GuestRef 조회·내보내기를 별도 감사한다. 보존 만료 후 opaque ref와 검색 Token을 실제로 삭제한다.                                                                     | `WorkplaceVisitPrivacyPostgresTest`, serialized response/log negative assertion                  |

## 4. 상태·장애 표현 Gate

사용자, 관리자, Kiosk는 같은 DTO를 공유하지 않는다. 각 Projection은 필요한 최소
데이터만 반환하고 다음 상태를 독립적으로 검증한다.

| 상태           | 화면 계약                                                                          | 명령 계약                                                |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Loading        | 기존 데이터를 갑자기 지우지 않고 진행 상태를 알린다.                               | 중복 제출을 차단한다.                                    |
| Empty          | 정상 무결과와 원천 장애를 구분하고 다음 행동을 제공한다.                           | 허용된 초대/정책 생성만 노출한다.                        |
| Partial        | Visitor와 Access Provider 중 정상 원천의 데이터는 유지하고 실패한 원천만 경고한다. | 실패 원천에 의존하는 명령만 차단한다.                    |
| Stale          | Source/received 시각과 마지막 성공을 표시한다.                                     | 출입·Badge 준비 완료를 표시하지 않는다.                  |
| Read-only      | 정보와 제한 사유를 표시한다.                                                       | mutation control을 비활성화하고 서버도 403으로 차단한다. |
| Denied         | 민감한 방문 존재와 PII를 누출하지 않는다.                                          | 모든 내용 방식의 우회를 403/404 정책대로 차단한다.       |
| 409            | 새 상태를 재조회하고 사용자가 영향을 다시 검토하게 한다.                           | 이전 expectedVersion으로 명령을 실행하지 않는다.         |
| Result unknown | 실패나 성공으로 추정하지 않고 상태 조회와 수동 책임자를 제공한다.                  | 새 Idempotency-Key로 자동 재전송하지 않는다.             |
| Offline        | Kiosk가 온라인처럼 보이지 않고 대체 연락처·도움 요청을 제공한다.                   | 오프라인 입력을 승인·출입 완료로 승격하지 않는다.        |

## 5. P1 제품 품질 매트릭스

| ID        | 범위      | 통과 기준                                                                                                                                        |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| V17-P1-01 | Desktop   | 1440·1280에서 사용자 Wizard, Timeline, 관리자 Table+Inspector가 안정된 grid에 보이고 첫 viewport에 실제 상태·다음 행동이 나타난다.               |
| V17-P1-02 | Mobile    | 390·320에서 Wizard가 단계형으로 작동하고 Inspector가 독립 dialog/sheet로 열리며 수평 overflow·가림·콘텐츠 손실이 없다.                           |
| V17-P1-03 | 언어·확대 | KO/EN 긴 문구와 200% 확대에서 필수 정보·Primary action이 접근 가능하다. 날짜·시간대·수치는 공용 i18n formatter를 사용한다.                       |
| V17-P1-04 | 접근성    | 키보드만으로 모든 단계를 수행하고 visible focus, dialog focus trap/return, accessible label/error/help를 검증한다. Axe 중대·심각 위반이 0건이다. |
| V17-P1-05 | 테마·운동 | Light/dark, 고대비, reduced motion에서 정보·focus·상태가 유지되고 색상만으로 상태를 전달하지 않는다.                                             |
| V17-P1-06 | 증거      | 대표 여정의 각 viewport·KO/EN 고정 screenshot을 보존하고 overflow, blank canvas, overlap, 첫 viewport의 실제 업무를 육안 검토한다.               |
| V17-P1-07 | 운영 증거 | GuestRef 조회·Export·Retention purge, 수동 출입 처리, Credential 회수, Retry/DLQ, Provider recovery가 감사·Outbox·책임자 증거와 함께 보인다.     |

## 6. Canonical API 및 PAGE 제안

### 6.1 사용자 API

- `POST /api/platform/v1/workplace/visits:preview`
- `POST /api/platform/v1/workplace/visits`
- `GET /api/platform/v1/workplace/visits?reservationAuthority=&reservationId=`
- `GET /api/platform/v1/workplace/visits/{visitId}`
- `POST /api/platform/v1/workplace/visits/{visitId}:send-invitation`
- `POST /api/platform/v1/workplace/visits/{visitId}/access-requests`
- `POST /api/platform/v1/workplace/visits/{visitId}:cancel`

### 6.2 관리자 API

- `GET /api/platform/v1/admin/workplace/visits/exceptions`
- `GET /api/platform/v1/admin/workplace/visits/{visitId}`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:approve`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:retry-access`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:notify-host`
- `POST /api/platform/v1/admin/workplace/visits/{visitId}:confirm-checkout`
- 방문 정책·출입 Zone·Provider binding·Kiosk device CRUD와 상태 API

관리 데이터 API의 정확한 URL·DTO·nullable 계약은 임의로 만들지 않고 backend 수직
계약과 OpenAPI가 확정된 뒤 고정한다.

### 6.3 Frontend PAGE 제안

원본 계약은 관리 화면의 canonical frontend path를 지정하지 않았다. 중앙 계약을
승격하기 전에 다음 제안을 제품 정보 구조와 함께 확정한다.

| 용도             | PAGE 제안                                                                              | 비고                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 사용자 방문·출입 | `/workplace/reservations?reservation=<id>&reservationAuthority=<authority>&tab=VISITS` | 기존 `workplace.work.reservations` PAGE의 상세 Tab으로 연결하고 별도 중복 PAGE를 만들지 않는다. |
| 방문 예외        | `/workplace/admin/visits`                                                              | 오늘 방문·승인·발급 실패·미응답·미퇴실 Queue                                                    |
| 방문 정책        | `/workplace/admin/visit-policies`                                                      | 영향 Preview·Version 기반 CRUD                                                                  |
| 출입 구역        | `/workplace/admin/access-zones`                                                        | Site·Zone·Provider·방문 유형 scope                                                              |
| 방문 Provider    | `/workplace/admin/visit-providers`                                                     | Visitor·Access 연결·관측 증거·수동 책임자                                                       |
| Kiosk 장치       | `/workplace/admin/kiosk-devices`                                                       | Device identity·Site binding·Heartbeat·Privacy notice                                           |

Kiosk projection은 일반 product PAGE와 분리한 device-authenticated route로 설계한다. 실제
path는 Device identity·Gateway 정책이 확정되기 전에 임의로 공식 registry에 추가하지
않는다.

## 7. 제안 파일과 소유권

다음 파일명은 구현 착수 시 소유권과 독립 테스트 경계를 고정하기 위한
제안이다.

### 7.1 Backend

- `dwp-platform-server/src/main/java/com/dwp/services/platform/workplace/workplacevisits/`
  - `WorkplaceVisitsController.java`
  - `AdminWorkplaceVisitsController.java`
  - `WorkplaceKioskController.java`
  - `WorkplaceVisitsService.java`
  - `WorkplaceVisitsRepository.java`
- `dwp-platform-server/src/test/java/com/dwp/services/platform/workplace/workplacevisits/`
  - `WorkplaceVisitsMigrationTest.java`
  - `WorkplaceVisitsPostgresTest.java`
  - `WorkplaceVisitProviderTruthTest.java`
  - `WorkplaceVisitPrivacyPostgresTest.java`
  - `WorkplaceKioskPostgresTest.java`
  - `WorkplaceVisitsControllerTest.java`

Flyway는 이 문서 작성 시점에 `V259`까지 존재하므로 `V260`이 후보다. 다른
wave가 번호를 선점할 수 있으므로 **구현 착수 직전에 next-free 번호를 다시
확인**한다. `V260` 이름을 사전에 예약하지 않는다.

### 7.2 Frontend

- `libs/shared-utils/src/api/workplace-visits-api.ts`
- `libs/shared-utils/src/api/workplace-visits-api.test.ts`
- `e2e/workplace-visit-access.spec.ts`
- `e2e/workplace-visit-kiosk.spec.ts`
- 예약 상세의 방문·출입 Tab은 분리된 feature component로 구현하고 기존 통합 예약
  parent의 source-size Gate를 지킨다.

## 8. 실행 명령

다음 명령은 구현이 합쳐지고 공유 실행 중지가 해제된 뒤 실행한다. 현재
타 wave의 공유 Gradle·Testcontainers·dev server를 임의로 재시작하지 않는다.

### 8.1 Backend 수직 테스트

```bash
./gradlew :dwp-platform-server:test \
  --tests 'com.dwp.services.platform.workplace.workplacevisits.*'
```

이 명령은 Migration, PostgreSQL lifecycle, Tenant FK, provider truth, privacy, Kiosk,
controller를 포함해야 하며 in-memory repository 단위 테스트만으로 대체하지
않는다.

### 8.2 Product PEP·Gateway 정합성

```bash
./gradlew :dwp-platform-server:test \
  --tests com.dwp.services.platform.security.WorkplaceProductSurfacePepContractTest \
  --tests com.dwp.services.platform.security.PlatformSecurityFilterWorkplaceRoutesTest

./gradlew :dwp-gateway:test \
  --tests com.dwp.gateway.productsurface.GatewayProductSurfaceOpenApiContractTest
```

Auth registry는 생성된 버전의 exact contract/migration/step-up 테스트를 모듈별로 실행한다.
관련 없는 전체 모듈 실패를 Screen17 증거로 포장하지 않는다.

### 8.3 Frontend API·Route·E2E

```bash
yarn vitest run libs/shared-utils/src/api/workplace-visits-api.test.ts \
  apps/dwp/src/routes/rooms-routes.test.ts

DWP_FRONTEND_DEV_PORT=4326 \
E2E_BASE_URL=http://localhost:4326 \
yarn playwright test \
  e2e/workplace-visit-access.spec.ts \
  e2e/workplace-visit-kiosk.spec.ts \
  --project=chromium --workers=1
```

E2E는 1440·1280·390·320, KO/EN, 200%, keyboard, Axe, light/dark, 고대비, reduced
motion, long copy와 모든 중요 장애 상태를 skip 없이 검증한다.

### 8.4 공식 계약 동기화

```bash
yarn openapi:check
yarn authorization:check
yarn fixtures:check
yarn architecture:check
```

Backend Route, Gateway, OpenAPI, Product PEP, Frontend PAGE·DATA·ACTION·메뉴는 같은
release 버전과 checksum을 사용해야 한다. 수동으로 generated 파일을 패치하거나
baseline을 늘려 Gate를 우회하지 않는다.

## 9. 완료 우선순위

### P0 출시 차단 항목

1. Tenant·소유자·대리 권한·Device identity fail-closed
2. 원문 PII·credential·secret 저장·응답·로깅 금지와 실제 retention purge
3. 실제 PostgreSQL 전체 lifecycle·outbox·audit·tenant FK·병렬성
4. Provider truth와 `READY` 승격 제약, `RESULT_UNKNOWN` GET-only 복구
5. Idempotency fingerprint·Version·40409·step-up·고위험 명령 강제
6. Fixture가 아닌 방문 정책·Zone·Provider·Kiosk 관리 메뉴와 실제 API
7. 사용자·관리자·Kiosk 대표 여정과 공식 Route·Gateway·OpenAPI·PEP 동기화

### P1 출시 품질 항목

1. 모든 viewport·언어·확대·테마·키보드·Axe·고대비·reduced motion 증거
2. Empty·Partial·Stale·Read-only·Denied·40409·Result unknown·Offline과 수동 복구
3. KO/EN 긴 문구와 관리자 밀도, 모바일 단계형 Wizard·Inspector 증거
4. 조회·Export·Retention·Credential 회수·Retry/DLQ·Provider recovery의 운영 감사 증거

P0와 P1이 모두 통과하기 전에는 Stitch 17을 `완료`로 표시하지 않는다.
