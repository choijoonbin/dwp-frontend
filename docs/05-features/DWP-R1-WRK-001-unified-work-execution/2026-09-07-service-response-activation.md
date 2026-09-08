# 서비스 보완 응답 — v6 활성화 검토 자료

작성일: 2026-09-07. 이 문서는 구현·검증 결과와 **미완료인 권한 릴리스**를 구분한다.
서비스 보완 API를 개발·로컬 배포했으나 tenant 1의 실제 제출 허용은 아직 완료되지 않았다.
개인 할 일 체크리스트·복수 참조·삭제 API는 로컬 개발 서버에 정상 반영됐다.

## 검토 대상

| 항목                    | 확정 값                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| 권한 번들               | `product-surfaces`, version `6`, 현재 `DRAFT`                               |
| 정확한 SHA-256 checksum | `e966b7340da431481bb9f577724224645be45ac50e169c75da1a521f2cde925a`          |
| 신규 capability         | `services.request.respond`                                                  |
| 실제 권한               | `APP.EMPLOYEE_SERVICES:UPDATE` — 소스 PEP는 VIEW도 함께 요구                |
| 권한 방식               | `PERMISSION_AND_RELATIONSHIP`, product entitlement 필수, `SELF` scope       |
| 신규 action             | `route.services.work.request-information-response.action`                   |
| 소유 product / surface  | `services` / `services.work`                                                |
| Gateway endpoint        | `POST /api/platform/v1/services/requests/{requestId}/information-response`  |
| Platform endpoint       | `POST /v1/services/requests/{requestId}/information-response`               |
| 관계 검증               | `predicate.platform.own-request.v1` 및 저장소의 tenant/requester 확인       |
| command 내용            | `values`, `message`, `version`, UUID `idempotencyKey`                       |
| 성공 상태               | `AWAITING_REQUESTER → IN_PROGRESS`, version +1, timeline·audit·receipt 저장 |

requester가 소유한 보완 요청만 제출한다. 10–2,000자의 보완 설명과 요청 생성 당시의
snapshot schema로 전체 values를 검증한다. 필수 누락·알 수 없는 필드·오래된 버전·다른
소유자·다른 tenant는 차단한다. 같은 command의 재시도는 중복 상태 변경이나 감사 기록을
만들지 않는다. 이 API는 서비스 요청의 해결·종료를 수행하지 않는다.

원본 계약: [v6 JSON](../../../../dwp-backend/contracts/product-authorization/product-surfaces-v1.bundle-v6.json).
실행 계약 상세: [backend 계약 문서](../../../../dwp-backend/docs/workspace/work-hub-source-actions-contract.md).

## 기존 영향

v5와 비교한 이번 추가는 capability 1개, action 1개이며 기존 capability·route의 의미 변경이나
삭제는 없다. `predicate.platform.own-request.v1`의 route 목록에 새 action을 추가했고 predicate
평가 방식은 유지했다. v1–v5의 immutable checksum은 보존했다. Gateway는 최신 생성된 경로
목록을 빌드 시 반영한다. 새 응답 경로의 source PEP는 Services v4 feature flag가 꺼져 있어도
항상 동작하며, 검증한 요청에만 내부 authority marker를 붙인다. 다른 경로의 기존 Platform
PEP는 계속 적용된다.

**현재 로컬 ACTIVE는 v3이므로 v6 활성화의 검토 범위는 v5→v6만으로 한정할 수 없다.**
v3→v6에는 기존 DRAFT v4/v5의 추가분도 함께 포함된다.

| 비교      | capability | route | access policy | entitlement expression | predicate policy |
| --------- | ---------: | ----: | ------------: | ---------------------: | ---------------: |
| v3 ACTIVE |         62 |   129 |            14 |                      8 |               25 |
| v6 DRAFT  |         73 |   161 |            22 |                     16 |               33 |

추가 32개 route의 product별 분포는 Dwaion 8, Calendar·Mail·Meetings·Messaging·Notifications·
Spaces·Workplace 각 3, Services 2, Communications 1이다. 기존 access policy 두 개와 own-request
predicate의 차이는 route 연결 목록 확장이다. 따라서 v6 활성화는 이미 존재하던 v4/v5 검토
상태까지 릴리스 담당자가 확인해야 한다. 업무 앱 기능 추가를 이유로 다른 제품의 DRAFT를
임의 승인하거나 ACTIVE pointer를 직접 변경하지 않았다.

개인 할 일 변경은 V228의 additive columns와 기존 Work owner API 범위다. checklist 최대100개,
source 최대10개, task version으로 배열을 원자적으로 갱신한다. 기존 singular source·status API와
배포 전 idempotency fingerprint를 보존했다. soft-delete는 기존 계획의 순번·version을 함께
갱신하고 audit/timeline/Calendar 기록을 보존한다. APP.SERVICES 오기 대신 canonical
APP.EMPLOYEE_SERVICES로 서비스 참조 권한을 정정했다.

## 로컬 반영 및 현재 차단 근거

- Platform Flyway V227/V228 적용 성공. Platform·Auth·Gateway를 재빌드·재시작했다.
- 최종 health: 8001 Auth, 8002 Platform, 8080 Gateway 모두 HTTP 200 / UP.
- Auth는 v6을 DRAFT로 import했다. ACTIVE v3은 유지했다.
- Provider의 tenant 1 실제 평가에서 Services의 shadow/enforcement/UI 모두
  `enabled=true`, `ROLLOUT_MATCH`, cohort `full`: 유효 rollout은 **111**이다.
  flag 기본값 false와 실제 tenant 적용값은 다르다.
- 실제 개인 할 일 GET 200, 없는 task 삭제 404, 읽기 전용 task 삭제 403을 확인했다.
  사용자 소유의 기존 서비스 요청은 smoke test 목적으로 제출·수정하지 않았다.
- 실제 서비스 보완 endpoint: source VIEW만 있으면 403
  `The requester Employee Services update authority is required.`
- source VIEW/UPDATE가 있어도 exact route authority가 없으면 403
  `The exact Employee Services route authority is required.`
- 현재 실행 중인 Auth에는 아래 두 목적별 릴리스 credential이 미설정이다.
  `DWP_PRODUCT_AUTHORIZATION_PROVIDER_APPROVAL_TOKEN`,
  `DWP_PRODUCT_AUTHORIZATION_PLATFORM_ACTIVATION_TOKEN`.
  릴리스 preflight를 credential 없이 호출하면 실제 HTTP 401이다.
- `ProductAuthorizationLocalPilotActivationRunner`는 v3 전용이다. 이 runner를 v6으로 바꾸거나
  다른 승인자 참조를 임의로 만들어 새 릴리스를 자동 승인하지 않았다.

secret 값은 이 문서나 테스트 보고에 기록하지 않는다.

## 정식 승인·활성화 순서

릴리스 운영자는 독립된 실제 requester, provider approver, platform activator와 검토된
change reference를 준비한다. 두 목적별 서비스 credential도 서로 다른 값으로 정식
설정되어야 한다. 일반 tenant 관리자·Work UPDATE 권한은 이 제어-plane 권한을 대신하지 못한다.

공통 내부 base:
`/internal/auth/v1/product-authorization/operations/bundles/product-surfaces`

1. **읽기 전용 사전 확인:** `GET /active`와 `GET /versions/6`.
   `X-DWP-Service-Identity: dwp-platform-server`,
   `X-DWP-Product-Authorization-Activation-Token`이 필요하다.
   ACTIVE pointer revision은 릴리스 직전에 다시 읽어 CAS에 사용한다.
   DRAFT인 v6은 승인 근거가 없으므로 governed version preflight가 승인 적격으로 처리하지 않는다.
2. **Provider 독립 승인:** `POST /versions/6/approval`.
   `X-DWP-Service-Identity: dwp-provider-server`,
   `X-DWP-Product-Authorization-Approval-Token`이 필요하다.
   body는 `checksum`, `requestedBy`, `approvedBy`, `changeRef` 네 필드다.
   checksum은 위 확정 값과 일치해야 하며 requester와 approver는 서로 달라야 한다.
   이 동작은 APPROVED로만 변경한다.
3. **Platform 활성화:** `POST /versions/6/activation`.
   Platform service identity와 Activation-Token을 사용한다.
   body는 `checksum`, `expectedRevision`, `activatedBy`, `changeRef`다.
   activator는 requester/approver 모두와 달라야 하고 changeRef는 승인 기록과 같아야 한다.
   provider-governed 승인 증거와 ACTIVE revision CAS가 모두 충족되어야 한다.
4. **활성화 후 실제 사용자 검증:** 갱신된 Services context/decision revision으로 자기 소유
   AWAITING_REQUESTER의 보완 제출을 확인하고, IN_PROGRESS/version/timeline 및 업무함 갱신을
   점검한다. stale revision·권한 상실·다른 소유자·중복 제출 차단도 재확인한다.

이 자료에는 임의의 승인자나 secret을 채워 넣은 실행 명령을 제공하지 않는다.
운영자는 실제 검토 주체와 승인된 change reference를 입력해야 한다.

## 검증 증거와 backend 보안 리뷰

최종 자동 검증: **backend 143건 / 실패 0 / skip 0**.

| 검증 묶음                                                | 테스트 수 |
| -------------------------------------------------------- | --------: |
| PlatformSecurityFilter                                   |        33 |
| 기존 ServiceCenterService                                |         8 |
| requester response 도메인                                |         8 |
| requester response PostgreSQL                            |         4 |
| Services source PEP + 실제 MVC controller                |        20 |
| 개인 할 일 service/controller/source resolver/PostgreSQL |        28 |
| Calendar PostgreSQL 연동 회귀                            |         6 |
| Auth immutable 계약·seed import                          |        23 |
| Gateway 생성 경로                                        |        13 |
| 합계                                                     |       143 |

별도 frontend shared API 테스트 11건 통과, 수정한 API/contract 파일 ESLint 통과.
canonical 계약·fixture 및 frontend sync check도 통과했다.
PostgreSQL 테스트는 Docker PostgreSQL을 실제 실행했으며 skip된 테스트는 없다.

실행 명령은 backend에서 다음과 같다.

```sh
./gradlew :dwp-platform-server:test \
  --tests 'com.dwp.services.platform.servicecenter.*' \
  --tests 'com.dwp.services.platform.security.PlatformSecurityFilterTest' \
  --tests 'com.dwp.services.platform.workhub.personal.*' \
  --tests 'com.dwp.services.platform.workhub.calendar.WorkCalendarPostgresIntegrationTest' \
  :dwp-auth-server:test \
  --tests 'com.dwp.services.auth.service.ProductAuthorizationContractValidatorTest' \
  --tests 'com.dwp.services.auth.config.ProductAuthorizationSeedLoaderTest' \
  :dwp-gateway:test \
  --tests 'com.dwp.gateway.productsurface.GeneratedProductRouteCatalogTest'
```

backend 관점의 별도 점검에서 다음을 확인했다.

- tenant·소유권·source VIEW/UPDATE·정확한 SELF scope·current/expected revision을 유지한다.
- 새 action이 기존 submit/cancel authority를 차용하지 않는다. 서버 내부 marker는 외부 header로
  주입할 수 없다. provider/support actor는 requester response를 실행할 수 없다.
- command advisory lock과 source row lock으로 동시에 같은 보완을 보내도 전이·receipt·감사는 한 번이다.
- audit 실패 시 서비스 payload/status/timeline/receipt 및 개인 task/day-plan 변경이 함께 롤백된다.
- checklist 완료가 원천 결재 승인이나 서비스 종료로 바뀌지 않는다. 삭제된 task는 과거 mutation
  receipt 재생으로 복원되지 않는다.
- rollout 전부터 존재한 개인 명령의 fingerprint에 새 null 필드가 붙어 재시도가 충돌하는 문제를
  발견·수정했고, 이전 형식 receipt를 실제 PostgreSQL에 넣은 회귀 테스트로 확인했다.
- 남은 차단은 v6의 정식 권한 릴리스다. 실제 제출이 가능하다는 완료 판정은 아직 하지 않는다.
