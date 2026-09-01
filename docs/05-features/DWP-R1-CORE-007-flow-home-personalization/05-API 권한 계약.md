# DWP-R1-CORE-007 API·권한 계약

> 상태: Implemented · API/Security approval pending
>
> 구현 상태: Phase 1·2 API·permission paths implemented; frontend integration verified
>
> 승인 상태: Platform API, Notification API, Security·Privacy 승인 대기
>
> 기준일: 2026-08-24

## 1. 원칙

- 1차는 기존 Endpoint와 Preference Schema v5를 호환 유지한다.
- Home은 여러 Domain의 읽기 모델을 조합하지만 각 원천의 권한 검사를 우회하지 않는다.
- Frontend Audience Filter, Widget 숨김, App Dock 배치는 보안 통제가 아니다.
- 쓰기 API는 Session, CSRF, Tenant·User Context, 낙관적 `version`을 모두 검증한다.
- 부분 장애는 Section 또는 Badge 단위로 격리한다.
- Home Preference에는 실행 코드와 업무·메일·알림 본문을 받지 않는다.

## 2. 1차 API Inventory

| Method | Gateway Path                                           | 권한                               | 목적                               | 변경                         |
| ------ | ------------------------------------------------------ | ---------------------------------- | ---------------------------------- | ---------------------------- |
| `GET`  | `/api/platform/v1/home/overview`                       | 로그인 사용자                      | 업무·일정·소식·활동·추천 통합 조회 | 기존 계약 유지, OpenAPI 보강 |
| `GET`  | `/api/platform/v1/communications`                      | 로그인 사용자                      | 일반 소식·사용자 Action Snapshot   | Action 필드 Additive         |
| `GET`  | `/api/platform/v1/home-experience`                     | 로그인 사용자                      | Tenant Home 설정·Variant 조회      | Policy v3 Additive           |
| `GET`  | `/api/platform/v1/home-preferences`                    | 로그인 사용자                      | Workspace Home 개인 설정 조회      | v5 유지, 복구 상태 Additive  |
| `PUT`  | `/api/platform/v1/home-preferences`                    | 로그인 사용자, CSRF                | 개인 Layout 저장                   | v5 유지, 검증·409 보강       |
| `POST` | `/api/platform/v1/home-preferences/reset`              | 로그인 사용자, CSRF                | 조직 기본값 복원                   | 기존 계약 유지               |
| `GET`  | `/api/platform/v1/workspace/apps`                      | `WORKSPACE_APPS_VIEW`              | Entitled App·사용 신호 조회        | 기존 계약 유지               |
| `POST` | `/api/platform/v1/workspace/apps/{appId}/launch`       | 앱별 View 권한, CSRF               | 앱 실행·최근 사용 기록             | 기존 계약 유지               |
| `GET`  | `/api/notifications/v1/summary/by-app`                 | 로그인 사용자                      | 앱별 실시간 알림 Count             | 신규 Additive                |
| `POST` | `/api/platform/v1/home/recommendations/{key}/feedback` | 로그인 사용자, CSRF                | 명시적 추천 피드백                 | 기존 계약 유지               |
| `POST` | `/api/platform/v1/observability/home-events`           | 로그인 사용자, CSRF 예외 승인 필요 | 허용 목록 기반 Home Metric 수집    | 신규, 승인 대기              |

내부 서비스의 실제 Controller Prefix는 `/v1`이며 Gateway가 `/api/platform` 또는
`/api/notifications`를 부여한다. `X-DWP-Tenant-ID`, `X-DWP-User-ID`, Role·Permission Header는
Browser 값을 신뢰하지 않고 Gateway가 검증된 Session에서 재생성한다.

## 3. Home Experience Policy v3

### 3.1 응답

`GET /api/platform/v1/home-experience`의 `compositionPolicy`를 Additive 확장한다.

```json
{
  "schemaVersion": 3,
  "experienceVariant": "CLASSIC",
  "personalCustomizationEnabled": true,
  "governedZones": [
    {
      "zoneKey": "announcements",
      "placement": "CANVAS",
      "visible": true,
      "size": "compact",
      "height": "short",
      "sortOrder": 20
    }
  ]
}
```

Runtime Variant는 응답 원문이 아니라 다음 서버 결정값이어야 한다.

```text
DWP_HOME_FLOW_ENABLED=false                    -> CLASSIC
DWP_HOME_FLOW_ENABLED=true + Policy CLASSIC    -> CLASSIC
DWP_HOME_FLOW_ENABLED=true + Policy FLOW_V1    -> FLOW_V1
Policy 누락·파손·미지원 Version                -> CLASSIC
```

Tenant Admin이 Composition을 게시하는 기존 API는 v3을 검증하고 Revision·Audit Event를 남긴다.
Variant 변경은 일반 사용자 API에서 허용하지 않는다.

### 3.2 Rolling Compatibility

- 신 Backend는 Policy v1·v2·v3을 모두 읽는다.
- 구 Frontend는 `experienceVariant`를 무시할 수 있다.
- 신 Frontend는 필드가 없으면 `CLASSIC`으로 처리한다.
- v3 게시 UI는 신 Backend 배포 후에만 활성화한다.

## 4. Home Preference v5

### 4.1 조회

```http
GET /api/platform/v1/home-preferences
```

정상 응답은 현재 공통 `ApiResponse.data` Envelope를 유지한다.

```json
{
  "data": {
    "schemaVersion": 5,
    "surfaceKey": "workspace-home",
    "customized": true,
    "integrityStatus": "VALID",
    "layout": {
      "appLayout": {
        "version": 1,
        "groups": {},
        "folders": {},
        "hiddenAppIds": []
      },
      "presentation": "balanced",
      "widgets": [
        {
          "widgetKey": "command-rail",
          "visible": true,
          "size": "large",
          "height": "short"
        }
      ]
    },
    "version": 4,
    "updatedAt": "2026-08-21T00:30:00Z",
    "warnings": []
  }
}
```

`integrityStatus`와 `warnings`는 Additive다.

- `VALID`: 저장값을 그대로 사용
- `RECONCILED`: 신규 Registry 기본값을 안전하게 보완
- `RECOVERED`: 저장값이 유효하지 않아 기본 Layout을 반환했지만 현재 Version으로 저장·Reset 가능

저장 행이 없으면 `customized=false`, `version=0`, `integrityStatus=VALID`인 기본값을 반환한다.

### 4.2 저장

```http
PUT /api/platform/v1/home-preferences
Content-Type: application/json
X-Correlation-ID: optional
```

```json
{
  "layout": {
    "appLayout": {
      "version": 1,
      "groups": {},
      "folders": {},
      "hiddenAppIds": []
    },
    "presentation": "balanced",
    "widgets": [
      {
        "widgetKey": "command-rail",
        "visible": true,
        "size": "large",
        "height": "short"
      }
    ]
  },
  "version": 4
}
```

서버는 다음을 신뢰하지 않는다.

- Client가 보낸 Tenant·User ID
- Widget 또는 App의 권한 보유 주장
- App Route·Icon·Badge·알림 Count
- AI 추천의 승인 여부 주장

Preference 저장은 Layout만 처리한다. 앱 실행 권한은 실행 시점에 Workspace API가 다시 확인한다.

### 4.3 저장 충돌

수기 Version 비교뿐 아니라 동시 신규 생성과 JPA 낙관적 잠금 Race도 동일하게 처리한다.

```json
{
  "code": "E1009",
  "message": "The resource conflicts with its current state."
}
```

Frontend는 사용자 Draft를 버리지 않고 최신 서버값과 차이를 보여준 뒤 `다시 적용` 또는 `취소`를
선택하게 한다. 자동 Last-write-wins는 금지한다.

### 4.4 초기화

```http
POST /api/platform/v1/home-preferences/reset
```

```json
{ "version": 4 }
```

`customized=false`일 때 UI는 Reset을 비활성화한다. 저장 행이 없는데 직접 호출한 경우 `404`,
Version이 다르면 `409`, Tenant가 개인화를 막으면 `403`이다.

### 4.5 Flow 고정 Zone과 개인 Action Queue 저장 규칙

- `My App Dock`의 Page 위치와 관리형 공지는 개인 Preference API의 저장 대상이 아니다.
- `appLayout`은 Dock 내부 App·Folder·숨김·순서만 저장한다.
- 관리형 공지는 Home Experience의 `governedZones`와 Revision·Audit API로만 변경한다.
- `command-rail`은 `PERSONAL` Widget이며 Flow Renderer에서 `action-queue`와 1:1로 매핑한다.
  사용자는 숨김·복원하고 개인 Canvas 순서를 이동할 수 있으며, 크기는 `large|full`,
  높이는 `short|standard`만 허용한다.
- Flow Editor는 Action Queue의 표시·순서·크기·높이 변경을 동일한 `command-rail`
  Entry로 저장하고 다시 읽었을 때 손실 없이 복원한다.
- Device Layout Overlay API는 기존 저장 Key `command-rail`만 기록한다. Flow 클라이언트
  Adapter는 화면 별칭 `action-queue`와 저장 Key를 모두 해석한 뒤 단일 `command-rail` 폭
  설정으로 정규화한다.
- `zoneOrder`, `fixedZones`, `managedZoneOverrides`, `now.visible` 등 미등록 필드는
  `400 E1001 INVALID_HOME_LAYOUT`로 거부한다.
- 직접 API로 저장한 유효한 `command-rail` 값도 동일한 개인화 검증을 거쳐 Flow Action Queue에
  적용된다.

Contract Test는 Action Queue의 숨김·이동·`large|full`·`short|standard` round-trip,
legacy Device Layout Overlay Key 호환, 고정 Zone 변조 거부와 Classic Rollback 복원을 포함한다.

## 5. Home Overview 부분 장애 계약

```json
{
  "status": "AVAILABLE",
  "source": "DWP_CALENDAR",
  "generatedAt": "2026-08-21T00:30:00Z",
  "data": {},
  "reason": "PARTIAL_SOURCE_UNAVAILABLE"
}
```

| Status        | UI 계약                             | Retry  |
| ------------- | ----------------------------------- | ------ |
| `AVAILABLE`   | 데이터와 Freshness 표시             | 불필요 |
| `FORBIDDEN`   | 권한 없음 상태, 데이터·Count 미표시 | 금지   |
| `UNAVAILABLE` | 해당 Region Error와 재시도          | 허용   |

Recommendation은 `recommendationSection`을 정식 계약으로 사용하고 Deprecated 평면
`recommendations` 배열은 Rolling 배포가 끝날 때까지 유지한다. `generatedAt`과 Widget Manifest의
`freshnessSeconds`로 Stale 여부를 판단하며, Stale 데이터를 현재 상태처럼 표현하지 않는다.

### 5.1 Communications Action Snapshot

```http
GET /api/platform/v1/communications?scope=for-you&size=8
```

```json
{
  "featured": {},
  "items": [],
  "actionableItems": [],
  "summary": {
    "total": 18,
    "unread": 10,
    "required": 1,
    "saved": 0,
    "criticalUnread": 2,
    "actionable": 3
  },
  "generatedAt": "2026-08-24T07:00:00Z"
}
```

- `required`는 확인 필수·미확인 항목만 센다. 읽지 않은 Critical을 자동 포함해 기존 의미를
  바꾸지 않는다.
- `criticalUnread`는 전체 활성 피드의 읽지 않은 Critical 수다.
- `actionable`은 확인 필수·미확인과 Critical·미확인의 ID 합집합 수다.
- `actionableItems`는 `scope`, `query`, `type`과 일반 `featured + items` 표본에 독립적인
  Action-first Slice다. 일반 표본 밖의 Critical도 포함한다.
- 전체 Count와 상세 ID는 DB에서 계산하고 동일한 `REPEATABLE_READ` Transaction Snapshot을
  사용한다. 일반 활성 피드는 최대 100건, 응답과 Action Slice는 요청 `size`를 1~48로 제한한다.
- Home Rail과 `/communications/for-you`의 Action Rail은 `actionableItems`를 우선 소비한다.
  목적 화면은 이를 기존 Required Fallback과 ID로 병합하고 일반 소식 DOM에서는 제거해 화면·
  Keyboard 중복을 만들지 않는다.
- 신규 Summary 필드와 `actionableItems`는 Additive다. 구버전 서버 응답에서는 기존 `required`와
  현재 응답 항목을 사용하는 Rolling Fallback을 유지한다.

## 6. 앱별 알림 Summary

### 6.1 요청

```http
GET /api/notifications/v1/summary/by-app
```

Query Parameter로 임의 Tenant·User 또는 앱 목록을 받지 않는다. Notification Request Context의
로그인 사용자를 기준으로 집계한다.

### 6.2 응답

```json
{
  "data": {
    "partial": false,
    "unavailableSources": [],
    "apps": [
      {
        "appKey": "messaging",
        "totalUnread": 6,
        "actionableUnread": 2,
        "urgentUnread": 0,
        "lastActivityAt": "2026-08-21T00:29:45Z"
      }
    ],
    "changeVersion": "128",
    "counterVersion": "54",
    "generatedAt": "2026-08-21T00:30:00Z"
  }
}
```

검증 규칙:

- Count는 0 이상 정수다.
- `appKey`는 Notification Type의 관리형 `owner_app_key`다.
- 앱당 한 행만 반환한다.
- 사용자 알림이 없는 앱은 생략한다.
- 데이터 원천 일부가 실패하면 `partial=true`와 관리형 Code만 반환한다.
- 제목, 본문, Notification ID, Thread ID는 포함하지 않는다.
- Frontend Query의 `staleTime`과 `refetchInterval`은 각각 30초다. 비활성 Tab에서
  배경 Polling을 강제하지 않는다.
- `generatedAt`은 현재 시각 기준 ±30초의 독립 Freshness Gate를 통과해야 한다.
  Parse 불가·오래된 응답·과도한 미래 시각은 실패다.

Frontend의 Home App Registry는 `notificationSourceKey`를 명시한다. Entitled App에만 Count를
결합하며 미등록 Key는 버리고 Telemetry Counter만 올린다. 권한 없음, 최초
Query Error, Refetch Error, `generatedAt` Freshness 실패 중 하나라도 발생하면 이전 성공
Cache를 현재 Badge로 보이지 않고 Badge·Metadata 전체를 숨긴다. 정적 숫자나 다른
Home Overview Count로 대체하지 않는다. Fresh·Healthy Partial 응답은 성공 App만
유지한다.

## 7. Home 행동 Telemetry API

신규 수집기는 Security·Privacy 승인을 받은 경우에만 구현한다. 승인이 없으면 1차 Release Gate에서
해당 API를 제외하고 기존 Web Vital과 Server Metric만 사용한다.

```http
POST /api/platform/v1/observability/home-events
```

```json
{
  "events": [
    {
      "eventName": "home.edit_saved",
      "surfaceKey": "workspace-home",
      "sectionKey": "app-dock",
      "entryMethod": "button",
      "actionType": "save",
      "viewportBucket": "1440",
      "durationBucket": "5s-30s",
      "changeCount": 4,
      "occurredAt": "2026-08-21T00:30:00Z"
    }
  ]
}
```

Server Allowlist:

- Event: `assets/home-analytics-event.schema.json`의 `eventName` Enum만 허용
- 속성: 같은 Schema의 관리형 Enum·Bucket과 `changeCount`, `occurredAt`만 허용
- 필수 속성: `eventName`, `surfaceKey=workspace-home`, `occurredAt`
- 요청당 최대 20 Event
- 자유 Text, URL Query, 사용자·업무·알림 ID, Folder명, 검색어 금지
- 수집 실패는 사용자 Workflow를 막지 않음

후보 Event는 `home.viewed`, `home.section_state`, `home.app_launched`,
`home.action_opened`, `home.flowline_item_opened`, `home.signal_opened`,
`home.edit_started|changed|undone|redone|saved|cancelled`, `home.preference_conflict`,
`home.recommendation_feedback`다. 계약의 기준은 이 문서의 예시가 아니라 JSON Schema다. Privacy 승인 전
`flow-home-api-delta.openapi.yaml`에 수집 Endpoint를 포함하거나 Runtime Route를 만들지 않는다.

## 8. 인증·인가

| 경계               | 서버 강제 규칙                                                   |
| ------------------ | ---------------------------------------------------------------- |
| Session            | Gateway가 Auth Service에서 검증                                  |
| Tenant             | Gateway가 내부 Tenant Header 재생성, Client Assertion 불신       |
| User               | 로그인 User Header만 사용                                        |
| Widget 데이터      | 각 Domain Service가 Permission·대상 범위를 재검사                |
| App 실행           | 현재 App Catalog·Resource Permission을 실행 시 재검사            |
| 개인화             | Tenant `personalCustomizationEnabled`를 Platform Server에서 검사 |
| Variant 게시       | Tenant Admin 전용, CSRF·Version·Revision·Audit 필수              |
| Notification Count | Notification Service의 사용자 Projection 범위                    |
| AI Layout 제안     | 읽기 제안만 허용, 저장은 사용자 확인 후 Preference API 호출      |

Audience나 숨김 상태로 API 접근을 허용하지 않는다. 역할을 잃은 Widget 설정은 데이터 유출 없이
비활성 상태로 보존할 수 있지만 해당 Domain API는 계속 권한을 거부해야 한다.

## 9. Error Contract

| HTTP  | Code             | 조건                                 | Client 처리                |
| ----- | ---------------- | ------------------------------------ | -------------------------- |
| `400` | `E1001`          | Layout·Variant·App Folder 검증 실패  | 해당 항목 강조, Draft 유지 |
| `401` | 인증 Code        | Session 없음·만료                    | 로그인 복구 흐름           |
| `403` | 권한 Code        | 개인화 금지·Domain 권한 없음         | 제어 숨김, 권한 상태 표시  |
| `404` | `E1004`          | 초기화할 행·등록 Recommendation 없음 | 최신 상태 재조회           |
| `409` | `E1009`          | Preference 또는 Policy Version 충돌  | Diff·재적용 선택           |
| `422` | 관측성 검증 Code | 허용되지 않은 Metric/Event           | Workflow와 분리            |
| `500` | `E1000`          | 예상하지 못한 서버 오류              | Correlation ID와 재시도    |
| `503` | 가용성 Code      | 원천 전체 일시 장애                  | 해당 Region만 Degrade      |

OpenAPI에는 성공 응답뿐 아니라 위 오류 응답, Required Field, Enum, 최대 크기를 명시한다.

## 10. OpenAPI·Client Generation Gate

`HomePreferenceResponse`와 Phase 2 API는 생성 OpenAPI에 다음 계약을 반영했다.

- `AppLayoutPayloadV1`, `AppFolderV1` Typed DTO
- `HomeExperienceVariant`, `HomePreferenceIntegrityStatus` Enum
- Response 필드 Required Mode
- `updatedAt`의 `OffsetDateTime` 통일
- `400|403|404|409` 응답 Annotation
- Backend OpenAPI 재생성
- `libs/api-contracts` Type 재생성
- 수기 `shared-utils` Type과 생성 Contract 일치 Test
- Gateway Public OpenAPI와 서비스 OpenAPI Path·Schema Diff 0건

현재 근거:

- `dwp-backend/contracts/openapi/platform.json`
- `libs/api-contracts/openapi/gateway-public.json`
- `libs/shared-utils/src/api/home-preference-api.ts`

CORE-007 후보 증분 계약:

- `docs/05-features/DWP-R1-CORE-007-flow-home-personalization/assets/flow-home-api-delta.openapi.yaml`
- `docs/05-features/DWP-R1-CORE-007-flow-home-personalization/assets/home-analytics-event.schema.json`

## 11. 2차 API 계약

다음 Endpoint는 Phase 2 구현과 생성 OpenAPI가 따르는 Resource 경계다.

```text
GET    /api/platform/v1/home-views?surfaceKey=workspace-home
POST   /api/platform/v1/home-views
GET    /api/platform/v1/home-views/{viewId}
PUT    /api/platform/v1/home-views/{viewId}
POST   /api/platform/v1/home-views/{viewId}/reset
DELETE /api/platform/v1/home-views/{viewId}
POST   /api/platform/v1/home-views/{viewId}/activate
PUT    /api/platform/v1/home-views/{viewId}/widgets/{widgetKey}/configuration
GET    /api/platform/v1/home-views/{viewId}/device-layouts
PUT    /api/platform/v1/home-views/{viewId}/device-layouts/{deviceClass}
GET    /api/platform/v1/home-views/{viewId}/revisions
POST   /api/platform/v1/home-views/{viewId}/revisions/{revisionId}/restore
GET    /api/platform/v1/home-templates
POST   /api/platform/v1/home-templates
PUT    /api/platform/v1/home-templates/{templateId}
POST   /api/platform/v1/home-templates/{templateId}/publish
POST   /api/platform/v1/home-templates/{templateId}/revoke
POST   /api/platform/v1/home-templates/{templateId}/apply
POST   /api/platform/v1/home-composer/proposals
GET    /api/platform/v1/home-composer/proposals/{proposalId}
POST   /api/platform/v1/home-composer/proposals/{proposalId}/apply
POST   /api/platform/v1/home-composer/proposals/{proposalId}/undo
```

삭제는 활성 기본 View와 마지막 View에 허용하지 않으며, Reset·Restore와 Template 적용은 새
Revision과 감사 Event를 생성한다.

- Reset은 `version`과 UUID `Idempotency-Key`를 요구한다. 조직 기본 Layout과
  `customized=false`를 저장하고 Widget Configuration·Device Overlay를 같은 Transaction에서
  제거한다. Reset 직전 상태는 Full Snapshot Revision으로 남기며 Classic Dual Write Reset도 같은
  의미를 지킨다.
- Widget Configuration은 Registry가 선언한 Source·Field·Filter Preset만 저장한다.
- Device Layout은 `desktop|mobile` 같은 승인 Device Class Overlay이며 공통 의미·DOM 순서를
  바꾸지 않는다.
- Template 작성·게시·회수는 소유권, Audience, Lifecycle, Revision과 Audit를 분리한다.
- Composer Proposal은 `06-AI Agent 계약.md`의 상태 머신, 단일 사용 승인, Version 검증과 Undo를
  따른다.

요청·응답 Schema와 Error Response는 생성 OpenAPI에 반영됐다. Retention·Rate Limit 운영값과
사람 승인은 Phase 2 G2·G3에서 확정하며, 코드 구현과 자동 검증이 `release-ready`를 의미하지는
않는다.

## 12. 승인·Contract Test

- [ ] Platform API Owner: Policy v3·Preference 복구·409 계약
- [ ] Notification API Owner: 앱별 Summary·부분 장애·SLO
- [ ] Gateway Owner: Route, Session, CSRF, 내부 Header
- [ ] Security·Privacy: Telemetry Allowlist·Count 노출 범위
- [ ] Frontend: 생성 Contract와 Runtime Type 일치
- [ ] QA: 구·신 Client/Backend Rolling Compatibility Matrix

연결된 자동 Contract Test는 통과했지만 위 사람 승인이 끝나기 전에는 Release-ready로 표시하지
않는다.
