# Provider-Tenant 접근 고도화 개발·전환 및 출시 Gate

> 상태: Software baseline verified, Production external gates blocked
>
> 기준일: 2026-08-27
>
> 적용 범위: Auth, Gateway, Provider, Platform, People, DWP Frontend, Audit·Telemetry

## 1. 목적과 정본

이 문서는 Provider가 고객 Tenant 문제를 진단·지원할 수 있게 하면서 상시 고객 접근, 혼합
관리자 계정, 임의 Tenant 전환과 사용자 가장을 제거하는 개발·Migration·출시 Gate다.

아키텍처와 정책 정본은
[R0 Provider Control Plane 및 Tenant Estate ADR](../03-architecture/R0%20Provider%20Control%20Plane%20및%20Tenant%20Estate%20ADR.md)이다.
Tenant 내부 관리 모델은
[R0 Platform Control Plane 및 Admin Governance ADR](../03-architecture/R0%20Platform%20Control%20Plane%20및%20Admin%20Governance%20ADR.md),
일반 Role·SoD는
[R1 권한 계층 및 앱 접근 거버넌스 ADR](../03-architecture/R1%20권한%20계층%20및%20앱%20접근%20거버넌스%20ADR.md)을 따른다.
이 문서는 같은 아키텍처를 다시 정의하지 않고 구현 순서, 전환 안전성, 검증 증거와 운영 절차를
고정한다.

PT 수용 상태의 실행·증적 SSOT는
[`release-evidence/provider-tenant-acceptance.json`](release-evidence/provider-tenant-acceptance.json)이다.
아래 수용 Test Matrix는 사람이 읽는 계약 설명이며 완료 판정을 대신하지 않는다. JSON은
`PT-A01`부터 `PT-A30`까지 정확히 한 번씩 포함하고
`corepack yarn release:evidence:check`가 상태·증거·외부 저장소 리비전을 검증한다.

## 2. 출시 결과와 비목표

### 완료돼야 하는 결과

1. Provider와 Tenant Role이 같은 Principal·Session에 공존하지 않는다.
2. Provider 로그인 직후에는 Estate·운영·Redacted 진단만 가능하고 고객 홈·관리·업무 API는
   열리지 않는다.
3. STANDARD 지원은 고객 승인 증거 참조, Provider 독립 검토, 요청자 활성화, Tenant·Scope·
   시간 제한과 사후 검토를 거친다.
4. 여러 Tenant를 조사할 수 있지만 지원 Context는 Provider Operator당 모든 Browser·Device를
   합쳐 하나만 활성화되고 Context 전환에서 Cache·실시간 연결·다운로드가 섞이지 않는다.
5. 고객 화면 구조는 승인된 Preview 전용 L1 JIT Scope에서 제한 Projection으로 먼저 재현한다.
   향후 예시 Data가 필요하면 비개인 Synthetic Fixture만 허용한다.
6. Provider 계정 설정은 Provider에게 적용 가능한 보안·Session·표시·접근성·운영 알림만
   제공한다.
7. 성공·거부·오류·회수·비상 접근이 고객 본문 없이 감사·Telemetry·보존 정책에 연결된다.

### 비목표와 금지

- 실제 고객 사용자의 `sub`로 로그인하거나 사용자 Token을 발급하는 Impersonation
- Provider가 Tenant 목록의 Dropdown만 바꿔 `/admin`·개인 홈에 상시 진입하는 기능
- 실제 사용자 데이터의 복사·마스킹본을 Synthetic Fixture라고 사용하는 기능
- `PROVIDER_ADMIN` 또는 Break-glass를 SoD·고객 데이터 경계의 우회 수단으로 사용하는 기능
- 검증되지 않은 `approvalReference`를 DWP 내장 고객 승인이나 전자서명으로 표현하는 기능
- WORM, KMS/HSM, SIEM, 외부 IdP MFA가 연결되지 않은 상태를 Production 완료로 표시하는 기능

## 3. 현재 Baseline과 Gap 판정

| 영역                  | 현재 정직한 Baseline                                                                                                         | Hardening 완료 조건                                                                                           | 판정                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| Provider 전문 계정    | `provider.*@dwp.local` 역할별 Seed와 불변 Provider Plane                                                                     | 혼합 Principal 생성·Role 부여·Token 발급 자체 거부                                                            | Local software 완료  |
| 호환 Bootstrap 관리자 | `admin@dwp.local`은 V99에서 `PROVIDER_ADMIN` 전용으로 전환·Session 회수                                                      | `/admin`·Tenant authority 회귀 차단 유지                                                                      | Local software 완료  |
| STANDARD 지원         | 로컬 Fixture에서 `approvalReference`, 다른 Provider Reviewer, 요청자 활성화, 5~60분                                          | Lifecycle E2E 유지, 비로컬은 권위 있는 고객 승인 검증 전 활성화 차단                                          | Software/외부 분리   |
| 고객 승인             | 로컬에서만 명시적 Opt-in `LOCAL_REFERENCE_ONLY` Fixture                                                                      | 권위 있는 Artifact/Webhook 또는 Tenant 승인 연계 전 비로컬 활성화 차단                                        | 외부 Gate            |
| Scope                 | `TENANT_EXPERIENCE_PREVIEW`만 ACTIVE, 구성 Read/Write·Workforce Read는 RETIRED                                               | 정확한 GET Preview Route와 대상 Service 재검증, 퇴역 Scope deny-all                                           | Local software 완료  |
| Context               | 지원 Cookie와 단일 Target Tenant, A→B→A React Query Cache 격리. SSE/WebSocket·Service Worker·Download는 현재 미도입·호출 0건 | DB 단일 활성 Context와 Gateway·Service fail-closed 회귀 유지. 새 Channel 도입 전 Context-keyed 격리 Gate 필수 | Local software 완료  |
| 진단                  | 고객 본문 없는 Provider Estate·Health·Audit Metadata와 표준 Reason Code                                                      | Redaction·Correlation 계약 회귀 유지                                                                          | Local software 완료  |
| Experience Preview    | L1 JIT exact GET와 제한 Field의 v1.4 Backend Projection                                                                      | 고객 승인 연계 전 비로컬 활성화 차단, 업무 Data 0건 유지                                                      | Local software 완료  |
| Impersonation         | 미구현                                                                                                                       | 계속 금지, Token 발급 0건                                                                                     | 불변식               |
| 계정 설정             | Auth 언어와 격리된 Browser-local Provider 표시·접근성 설정                                                                   | Tenant Preference API 0회와 직접 URL safe redirect 회귀 유지                                                  | Local software 완료  |
| Audit·보존            | Provider Audit·Outbox·민감정보 최소화 계약                                                                                   | Local 증거 유지, WORM·KMS/HSM·SIEM·Legal Hold 실연계                                                          | Local 완료/외부 Gate |

위 표의 `현재 Baseline`은 구현됐다고 확인할 수 있는 범위만 설명한다. 목표 열이 문서화됐다는
이유로 기능 상태를 `완료`로 바꾸지 않는다.

## 4. 개발 Work Package

### PT-01 Principal 분리와 Role Assignment 불변식

#### 구현 계약

- Auth는 불변 `identity_plane`을 Principal의 권위 속성으로 저장하고 Built-in Role Catalog의
  `role_family=PROVIDER` 및 `PROVIDER_*` 예약 Namespace와 일치시킨다. Role 제거만으로 Plane을
  바꾸지 않으며 Provider·Tenant Role이 함께 관측되면 유효한 권한 Context가 없는 충돌 상태다.
- Role Assignment Transaction, Group Role, PIM/Privileged Grant와 Role 활성화 Trigger가 Provider
  Role과 Tenant Role·Resource Role·Workspace Entitlement의 합성을 거부한다.
- `/me`와 Access Token/Session의 서명된 Role·Revision에서 Gateway와 Service가 같은 Effective
  Plane을 파생한다. Client가 Plane을 선택하거나 Override할 수 없다.
- Gateway가 `PROVIDER_*` Role을 보조로 보는 경우는 Provider 요청을 추가로 거부하는
  deny-side defense일 뿐이다. Role을 권위 Source로 삼아 Plane을 추론하거나 허용 권한을
  부여하지 않는다. 명시적인 durable `identityPlane`이 누락되면 fail-closed한다.
- 충돌 Assignment, Legacy Session 복원과 잘못된 Token은 Default deny한다. Conflict Policy는
  `PROVIDER_TENANT_PLANE_SEPARATION`, API 거부는
  `ROLE_CONFLICT_PROVIDER_TENANT_PLANE_SEPARATION` Reason Code와 Audit를 사용한다.
- 사람 상관 ID가 필요하면 별도 `human_correlation_ref`를 사용하되 Permission 계산과 API
  Context에 참여시키지 않는다.

#### 필수 증거

- Provider→Tenant Role, Tenant→Provider Role, Resource Role·Entitlement 교차 부여 Negative Test
- 혼합 역할 DB Fixture의 Token 발급·Session 복원 거부 Test
- Provider 전용·Tenant 전용 계정의 허용 Route Matrix와 `/api/auth/me` Snapshot
- Provider가 활성 Tenant 관리자의 초기 초대를 재발급하거나 비밀번호를 바꿀 수 없는 Negative Test
- Provider API·UI·OpenAPI·Log에 활성화 Token·URL 0건, 고객 소유 전달 연계 전 초대 발급 fail-closed
- 현재 Provider 관리자 초대 Runtime은 모든 발급 시도를 `409 RESOURCE_CONFLICT`로
  fail-closed한다. 생성 OpenAPI도 성공 `200`을 제거하고 `409`
  `AdministratorInvitationConflictError`(`E1009`)만 명시하며, Contract Test가 이 계약과
  활성화 Token·Path 부재를 강제
- Production 후보 데이터의 혼합 Principal 0건 Report

### PT-02 Plane·Route·Tenant Context 강제

#### 구현 계약

- `/provider/**`, `/admin/**`, Workspace/Data Route의 Parent Guard와 각 API PEP를 분리한다.
  메뉴 숨김은 보조 수단이고 직접 URL·API도 같은 결과를 낸다.
- Provider Estate의 선택 Tenant는 Provider Query Scope로만 사용한다. 활성 지원 세션이 없는
  Provider 요청에서 내부 Tenant Header를 고객 Tenant로 바꾸지 않는다.
- Gateway는 외부 Tenant·Support Header를 제거하고 검증된 Session/Support Context에서만 내부
  Header를 생성한다. Provider 검증 장애는 `503`, 권한·Scope 실패는 정보 누출 없는 `403`이다.
- 지원 Cookie의 실제 Browser `Path`는 `/api/provider/v1/admin/`, `/api/auth/`,
  `/api/platform/v1/admin/`의 coarse Service Prefix다. Path 속성 자체를 권한으로 보지 않고,
  Gateway가 검증된 Context를 정확한 GET
  `/api/platform/v1/admin/tenant-experience-preview`에만 투영하며 나머지를 deny한다.
- 지원 Context Key는 `actorSession + supportSession + targetTenant`다. 현재 지원 화면의 격리된
  React Query Cache에 포함하고 종료 때 폐기한다. IndexedDB, Service Worker, SSE/WebSocket,
  Download와 별도 Client Store는 현재 지원 경로에서 생성·호출하지 않는다. 향후 도입할 때는 같은
  Key와 종료 폐기를 구현하고 독립 Gate를 통과해야 한다.
- Provider Operator당 활성 지원 Tenant는 모든 Browser·Device를 합쳐 하나다. DB Partial Unique
  Index로 강제하고 다른 Tenant 활성화 시 기존 세션을 자동 덮어쓰지 않고 종료 확인 또는 서버
  회수를 요구한다.

#### 필수 증거

- Tenant Header 위조·Encoded Path·Method Override·Path Prefix 우회 Test
- Provider 검증 서비스 중단, 만료·회수·Role Revision 변경의 Fail-closed Test
- Tenant A→B→A Desktop Browser와 두 Tab 동시성 E2E
- REST Context 검증과 현재 미도입 SSE/WebSocket·Service Worker·Download 시도 0건 증거. 해당
  Channel을 도입할 때는 Context Key·종료 폐기·Filename·Watermark 검증을 별도 추가한다.

### PT-03 STANDARD JIT 지원 Lifecycle

#### 현재 Release 계약

1. `PROVIDER_SUPPORT`가 Tenant, Scope, 5~60분, 사유, `approvalReference`, Idempotency Key를
   제출한다.
2. Server는 Tenant·Scope·기간·사유·승인 참조의 Request Fingerprint를 저장하고 같은 Key의
   다른 Payload를 `409`로 거부한다.
3. 요청자와 다른 `SUPPORT_ACCESS_REVIEW` 권한자가 외부 고객 승인 System of Record의 증거를
   확인하고 승인·거절 사유를 남긴다. 자기 승인은 `403`이다.
4. 승인 유효기간 안에 원 요청자만 활성화한다. Session은 승인 Scope를 확대할 수 없고 활성화
   시점부터 5~60분 TTL을 가진다.
5. 종료·회수·만료 후 다음 요청부터 거부하고 다른 Auditor가 사후 검토한다.

#### Support Scope·Route Matrix

| Scope                        | Risk | 고객 승인 참조 | Method | Canonical Route Family                                                                                          | 반환·허용 경계                               |
| ---------------------------- | ---- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `TENANT_EXPERIENCE_PREVIEW`  | L1   | 필수           | GET    | `/api/platform/v1/admin/tenant-experience-preview`                                                              | **ACTIVE.** Branding·Home 텍스트·수치·구조만 |
| `TENANT_CONFIGURATION_READ`  | L1   | 필수           | 없음   | **RETIRED·deny-all.** 전용 최소 조회 Projection 출시 전 재개 금지                                               |
| `TENANT_CONFIGURATION_WRITE` | L3   | 필수           | 없음   | **RETIRED·deny-all.** 승인·복구·감사 통제를 가진 정확한 Command 출시 전 재개 금지                               |
| `WORKFORCE_READ`             | L2   | 필수           | 없음   | **RETIRED·deny-all.** Field Mask와 신뢰 가능한 Population Provenance를 가진 정확한 Projection 출시 전 재개 금지 |

Preview Scope는 다른 Scope를 암시하지 않는다. Preview Endpoint가 Asset URL·파일명·Actor·
User/Workforce·Live Announcement를 반환하거나 다른 Method를 허용하면 Gate 실패다. Path는
정규화 뒤 Matrix와 비교하고 새 Endpoint는 Catalog·Gateway·대상 Service·Frontend Contract와
Test가 함께 배포되기 전까지 Default deny한다.

실행 승인은 **Scope Catalog와 Code Allowlist의 이중 Gate**다. Scope가
`prv_support_scope_catalog`에서 ACTIVE이면서 요청·세션에 결속되어야 하고, 동시에
Provider 정책 Code, Gateway와 대상 Service PEP의 정확한 Method+Canonical Path에 일치해야
한다. Catalog 또는 Code 한쪽만의 변경으로는 새 권한을 열 수 없다.

`approvalReference`는 외부 고객 승인 증거를 찾는 참조다. 현재 DWP가 고객 승인자의 서명,
신원과 결정 Scope를 직접 검증한다는 의미가 아니다. 로컬은 명시적 Opt-in Fixture로만 이 흐름을
검증하고, 비로컬은 권위 있는 검증기가 없으면 활성화를 차단한다.

#### 후속 Customer Approval 연계 Gate

검증 가능한 Artifact/Webhook 또는 Tenant Admin 내장 승인은 별도 Integration Decision이다.
도입할 때 Tenant, 승인자 권위, Scope, 기간, 요청 지문, 서명·Nonce·Timestamp, 회수와 Replay
방지를 검증한다. 이 기능 전에는 UI와 출시 자료에 `고객이 DWP에서 승인 완료`라고 표시하지
않는다.

#### Break-glass 계약

- 진행 중 SEV1/SEV2 Incident, 전용 Permission, 이유, 최소 Scope, 최대 30분을 요구한다.
- 고객 사전 승인만 우회하며 Allowlist, Tenant 격리, 금지 Scope, Audit와 사후 검토는 우회하지
  않는다.
- 생성 즉시 Security·On-call에 경보하고, 종료 후 24시간 안에 고객 통지·독립 사후 검토를
  완료한다. 자동 연장, Export, Secret 조회와 Impersonation은 금지한다.
- **현재 상태: unconditional fail-closed disabled.** Break-glass는 RETIRED Scope나 운영
  kill-switch로 끄는 기능이 아니다. Service Code가 무조건 `INVALID_STATE`를 반환하고 UI는
  비상 활성화를 제공하지 않는다. Incident 결속, 최근 MFA Assurance, 즉시 Alert,
  고객 통지와 Negative/E2E 증거를 갖춘 새 정책·forward 변경 없이는 Permission 보유만으로
  이 Gate를 우회할 수 없다.

#### 필수 증거

- 요청→독립 승인→요청자 활성화→허용 호출→회수/만료→사후 검토 E2E
- 자기 승인·다른 요청자 활성화·Stale Version·Fingerprint 충돌·만료 승인 Negative Test
- 활성 Preview Scope의 exact GET, 퇴역 세 Scope, 다른 Method·미등록 API 403 Test
- Break-glass unconditional `INVALID_STATE` Negative Test. 향후 별도 출시로 도입할 때
  Incident 누락, 30분 초과, 금지 작업과 미검토 Alert Test를 추가
- DB·API·UI 감사 Timeline의 Request/Session/Correlation 연결

### PT-04 Diagnostics와 Safe Experience Preview

#### 진단 계약

지원 접근 전에 다음 순서로 조사한다.

1. Estate·Subscription·Entitlement·Deployment·SLO·Incident 상태
2. Tenant·Service·Route Template·Correlation ID별 Redacted Error와 Version Drift
3. UI 구조 확인이 필요하면 `TENANT_EXPERIENCE_PREVIEW`만 가진 STANDARD JIT 요청·승인
4. 제한 Projection의 `TENANT_CONFIGURATION_ONLY` Preview
5. 사용자 동의 기반 Redacted Support Bundle
6. 그래도 필요한 경우 고객 관리자 재현·Redacted Support Bundle로 전환. 퇴역 Scope 재활성화 금지

Diagnostic Projection은 상태, Count, Version, Timestamp, 오류 분류, Redacted Resource ID와
다음 행동만 반환한다. 메일·문서·알림·결재·급여·일정 본문, 사용자 Preference, Secret과 자유
형식 Payload를 기본 응답에 포함하지 않는다.

#### Safe Preview 계약

- 권한: L1/customer approval required `TENANT_EXPERIENCE_PREVIEW`; 다른 Scope를 암시하지 않음
- Endpoint: GET `/api/platform/v1/admin/tenant-experience-preview`; 대상 Tenant는 활성 Session에서
  결정하고 Client Tenant ID를 신뢰하지 않음
- Projection: Tenant Branding·Home 구성의 텍스트·수치·구조
- 명시적 제외: Asset URL·파일명·Actor·User/Workforce·Live Announcement
- 응답 Envelope: `contractVersion=tenant-experience-preview.v1`,
  `previewMode=TENANT_CONFIGURATION_ONLY`; Asset은 configured Boolean·크기·배치 수치만
- `excludedData`: `USER_PERSONALIZATION`, `USER_CONTENT`, `WORKFORCE_DATA`,
  `LIVE_ANNOUNCEMENTS`, `ASSET_LOCATIONS`, `AUDIT_ACTOR_METADATA`
- Renderer 입력: Contract·Branding·Home Version, Locale, Viewport. 현재 Persona·업무 Fixture 입력 없음
- 금지 원천: User ID/Profile/Preference, Draft, 업무 Data API, Search, Notification, Agent/Model
- 실행: Preview 전용 Audience와 Network Allowlist, Mutation·Export·외부 Link·Webhook 차단
- 표시: 화면과 Capture에 `합성 데이터 미리보기`, Tenant·환경·Revision·생성 시각 Watermark
- 현재 증거: Contract·Branding·Home Version 화면 표시 + Support Session·Correlation 진입 Audit;
  영구 Snapshot은 저장하지 않고 Client stale 최대 10초
- 후속 Backend Evidence Gate: Snapshot ID, Fixture/Renderer Version, SHA-256과 30일 보존
- 실패: 실제 홈이나 다른 Tenant의 마지막 성공 Snapshot으로 Fallback하지 않고 명시적 오류

현재 Renderer는 실제 업무 Data를 표시하지 않고 제품 Localized Fallback과 제한 구성만 사용한다.
향후 Widget 상태 예시를 추가할 때만 제품 소유의 비개인 Synthetic Fixture를 사용하며 실제
Tenant 데이터를 샘플링·마스킹해 Fixture로 만들 수 없다.

Support Bundle은 현재 구현·활성화된 기능이 아니다. 향후 별도 출시에서는 사용자가 자신의 문제
화면에서 명시적으로 생성하고 Allowlist Field와 자동 Redaction Preview를 확인해야 한다. Case
하나에 결속하고 기본 7일·최대 30일 뒤 삭제하며, Provider가 사용자 대신 Bundle을 만들거나 범위를
확대할 수 없어야 한다. 이 후속 기능의 구현·보존·삭제 E2E는 현재 Local software 완료 수치에
포함하지 않는다.

#### 필수 증거

- PII Canary가 포함된 Tenant에서 Preview 응답·Log·Screenshot에 Canary 0건
- Preview 전용 Scope 누락·다른 Scope만 보유·POST 호출은 403이고 Endpoint Schema에 Asset URL·
  파일명·Actor·User/Workforce·Live Announcement Field가 0건인 Contract Test
- Preview Envelope Version·Mode와 여섯 `excludedData` Code가 고정된 Consumer Contract Test
- Preview 중 Data Plane·Mutation·외부 Network 호출 0건 Network Trace
- 같은 Contract·Branding·Home Version에서 허용 Field Renderer가 결정적인지 검증하는 Test
- 권한 없는 Tenant Preview, Draft Revision, 임의 User ID 입력 Negative Test
- 향후 Support Bundle 출시 Gate: 생성 동의, Redaction, 다운로드 감사, 회수·만료·삭제 E2E

### PT-05 Provider 계정 설정과 Shell

#### 구현 계약

| 메뉴                                                        | Provider 기본                               | 지원 Context                                                                     | 저장 Scope                                   |
| ----------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- |
| Profile·운영 역할                                           | 읽기                                        | `/account` 열람 금지·`/provider/support` redirect, Actor 정보는 지원 화면에 유지 | Auth Identity + Provider Operator Projection |
| 보안·MFA 상태·활성 Session                                  | Auth Session 조회·종료, MFA는 IdP 관리 안내 | `/account` 열람 금지, 지원 Session은 Provider 화면·Banner에서 종료               | Auth Provider Principal                      |
| 언어                                                        | 허용                                        | 기존 Provider 값을 표시에 적용하되 `/account` 편집 금지, 대상 Tenant Write 금지  | Auth `preferredLocale`                       |
| Theme·대비·Motion·Density·시간대·날짜·숫자 등 비민감 표시값 | 허용                                        | Provider 값을 보존·적용하되 `/account` 열람·편집 금지, 대상 Tenant Write 금지    | 격리된 Browser `localStorage`                |
| Provider Incident·승인 알림                                 | Provider 알림 계약 도입 전 숨김/읽기 기본값 | Tenant 개인 알림 설정 숨김                                                       | 후속 Provider Preference Backend Gate        |
| 개인 홈·Widget·업무 알림                                    | 숨김                                        | 숨김                                                                             | 생성 금지                                    |
| Tenant 관리형 설정·예외                                     | 숨김                                        | 숨김, `/admin` 금지                                                              | 생성·편집 금지. 현재는 읽기 전용 Preview만   |

- Frontend Navigation, 설정 Schema 응답과 Write API가 같은 Applicability Rule을 사용한다.
- Provider Context에서는 Tenant Branding과 `/api/platform/v1/personal-preferences*`를 호출하지
  않는다. Browser-local Key는 `dwp.provider-realm-preference.v2:realm:DWP_PROVIDER:user:<user>`이며 허용된
  Appearance·Accessibility·Regional 표시 Enum만 저장한다. Tenant ID, 고객 데이터, Support Session, Secret과
  보안 상태는 저장하지 않는다.
- Browser-local 값은 Cross-device Server Sync가 없음을 화면에 표시한다. Provider Principal
  Versioned Server Preference는 후속 Backend Gate이고 구현 전에는 동기화 성공으로 표현하지 않는다.
- Provider Header에는 Provider Plane을, 지원 화면에는 대상 Tenant·환경·Session·Scope·남은 시간과
  종료 명령을 텍스트로 지속 표시한다.
- 현재 MFA Assurance/등록 상태 API가 없으므로 Provider Security 화면은 검증된 MFA 상태를
  추정하지 않는다. 해당 상태 Projection과 최근 인증 증거는 Production External Gate다.
- 지원 중 Workspace, 개인 홈, 일반 Account Home Preference와 허용 Scope 밖 Admin 메뉴로
  이동하지 않는다.
- Provider의 평상 진입점은 `/provider/**`와 Profile·Security·허용 Preference를 위한 제한된
  `/account` self-service다. `/admin/**`은 활성 지원 중에도 금지한다.
- `/provider`와 `/account`의 Provider 복귀는 고정 Overview로 보내지 않고 서버가 반환한 읽기
  권한 중 Navigation 순서상 첫 허용 Surface로 이동한다. Release·Data 승인자의 정상 진입을
  위해 `ESTATE_READ`를 추가 부여하지 않는다.
- Provider에게 활성 지원 Context가 있으면 `/account` 하위 Route 전체를
  `/provider/support`로 redirect한다. 지원 전 Browser-local Provider Preference는 유지하되
  활성 지원 중에는 해당 화면을 열거나 편집할 수 없다.
- Provider가 Tenant-only `/account/settings/home`, `notifications`, `managed` 직접 URL을
  열면 Tenant API를 호출하지 않고 `/account/settings/appearance`로 safe redirect한다.

#### 필수 증거

- Provider/Tenant/지원 Context별 설정 메뉴·직접 URL·API Matrix
- Provider가 Tenant Branding·Personal Preference API를 0회 호출하고 SKAX 또는 지원 대상
  Tenant의 `(tenant_id, user_id)` 행을 만들지 않는 Network/DB Contract Test
- 서로 다른 Provider Realm·User와 Tenant 일반 사용자의 Browser Storage Key 충돌 0건 Test,
  Logout·Account Switch 정책에 따른 값 격리 Test
- 1440px, 1280px, 390px, 320px, 200% Zoom, Keyboard, High Contrast, Reduced Motion Screenshot
- 만료 60초 전 경고, 만료·회수 후 Focus 복원과 접근 가능한 상태 안내 E2E

### PT-06 Audit·Telemetry·Retention·운영 통제

아래는 Production 목표 계약이다. 현재 Baseline은 Provider 변경과 지원 Lifecycle/사용/거부를
Append-only 로컬 원장·Outbox로 기록하지만 Gateway ambient 403·검증 불가 503, Auth 로그인/MFA와
모든 409를 동일 Event Envelope로 수집하는 중앙 Denial Sink 및 외부 WORM/SIEM은 미완료 Gate다.

#### 구현 계약

- ADR 7.3의 공통 Event Schema와 보존 Class를 사용하고 Audit와 Telemetry를 분리한다.
- Audit Outbox 수락 없이 JIT 활성화, Write Scope, Break-glass와 Preview Export를 실행하지 않는다.
- 고객 승인 필요 Scope는 비로컬 환경에서 권위 있는 서명 승인 증거 검증기가 없으면 활성화하지
  않는다. 로컬 `LOCAL_REFERENCE_ONLY` 흐름은 제품 검증 Fixture이지 고객 승인 증거가 아니다.
- Metric Label은 Tenant·환경·Service·Route Template·Scope·Outcome·Reason Code만 허용한다.
  User ID, Email, 자유 형식 사유, Ticket 원문과 업무 제목을 금지한다.
- 운영 Kill Switch는 STANDARD 지원, Write Scope와 Preview Export를 독립적으로 끌 수 있고
  기존 활성 Session Revision을 갱신해 회수한다. Break-glass는 이 토글의 상태가 아니며
  현재 Service Code에서 무조건 disabled다.
- 미완료 사후 검토, Break-glass 사용, 만료 후 호출, Tenant 불일치, Scope 거부 급증과 Preview
  Data Plane 차단을 Alert한다.

#### 필수 증거

- Event Schema Consumer Contract와 Audit Outbox 장애 Test
- Token·Cookie·Header·Email·PII Canary에 대한 Log/Trace/Metric DLP Test
- 회수 효력 p99, Session TTL/Idle, 미검토 Queue와 Alert 전달 Test
- Retention 만료·Legal Hold 충돌·Support Bundle 삭제와 삭제 증거 Test
- WORM·KMS/HSM·SIEM은 실제 외부 증거가 없으면 Production Gate 미완료 표시

## 5. Data Migration과 Legacy 계정 전환

### 5.1 Preflight Inventory

변경 전에 환경별로 다음 불변식 Report를 생성하고 SHA-256과 실행 시각을 Release Evidence에
보관한다.

- Provider Role을 가진 Principal과 Tenant Role·Resource Role·Workspace Entitlement 교집합
- Provider Operator Assignment가 가리키는 Auth Principal, 고아·중복 Assignment
- 활성·만료·회수 Support Request/Session, 원장과 Scope의 고아 참조
- Provider Preference가 Tenant 개인 설정 영역에 만든 행
- Browser·Gateway가 신뢰하는 Tenant/Support Header 목록과 Route Allowlist Drift
- `admin@dwp.local` 및 광범위 Seed·운영 계정의 실제 사용·소유자·마지막 로그인

Report에 Secret, Token, Email 전체와 고객 본문을 넣지 않는다. Principal은 내부 ID와 Redacted
표시값만 사용한다.

### 5.2 Idempotent 전환 순서

1. 신규 혼합 Role Assignment와 Token 발급을 즉시 차단한다.
2. 각 Legacy 혼합 계정의 책임을 분리한다. 일반 운영자는 Provider 전용 Principal을 새로 만들고,
   호환 Bootstrap `admin@dwp.local`은 동일 Principal을 Provider 전용으로 정규화한다. 기존 Tenant
   Principal은 고객 업무가 실제 필요한 경우에만 유지한다.
3. Provider Operator Role Assignment와 운영 객체 소유권을 새 Provider Principal에 연결한다.
   과거 Audit Actor ID는 Rewrite하지 않고 상관 Mapping만 Append한다.
4. 새 Principal의 Permission·Route·알림·감사 조회를 역할별 Matrix로 검증한다.
5. 기존 Principal의 Provider Assignment를 비활성화하고 Access Revision을 증가시켜 모든
   `DWP_SESSION`을 회수한다. 현재 계약에는 별도 Refresh Token/Cookie가 없다. 아직
   유효한 `DWP_SESSION`의 rotation은 같은 Auth `sid` 세션 가족을 보존하지만 만료된
   JWT는 refresh할 수 없다.
6. Provider 전용 Preference를 필요한 Allowlist 항목만 복사한다. Tenant 개인 홈·관리형 예외·
   업무 알림은 복사하지 않는다.
7. Provider V38은 만료 시각이 지난 활성 지원 Session을 `EXPIRED`로 물질화하고, Operator별
   겹치는 활성 Session은 최신 하나만 남기고 나머지를 `REVOKED`로 전환한 뒤
   `uk_prv_support_sessions_one_active_operator` Partial Unique Index를 생성한다.
8. 혼합 Principal 0건, 고아 Assignment 0건, Operator별 활성 지원 Session 1건 이하를 확인한 뒤
   강제 DB 불변식을 활성화한다. 남은 Session도 Auth V99의 Session 회수 뒤 재인증 없이는 사용할
   수 없어야 한다.

Provider 보안 Migration 추적성은 V39~V53을 하나의 뭉뚚그린 완료로 표시하지 않고
다음 순서로 연결한다.

| Provider Migration | 보안 불변식·회수 증거                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| V39                | `WORKFORCE_READ` 퇴역, 열린 요청 취소·활성 세션 회수·Audit                 |
| V40                | 특권 지원 Audit를 `PRIVILEGED_ACCESS`/extended retention Outbox로 보존     |
| V41                | 지원 세션을 Auth `sid` 세션 가족에 결속, 결속 불가 Legacy ACTIVE 세션 회수 |
| V42                | Provider 운영 Role을 `PROVIDER_*` Namespace로 DB 강제                      |
| V43                | 임의 Scope 퇴역 시 열린 요청·활성 세션을 즉시 취소·회수하는 Trigger        |
| V44                | 광범위 `TENANT_CONFIGURATION_READ/WRITE` 퇴역                              |
| V45                | Meetings 제품 Surface를 Inventory-only·default-off Rollout 후보로 등록     |
| V46                | DB Kill Switch, Tenant 비가용, TTL·Idle 지원 세션 즉시 회수                |
| V47                | Tenant Mutation Orchestration·재시도 원장 내구화                           |
| V48                | 지원 요청을 원 Auth `sid` 세션 가족에 결속                                 |
| V49                | 요청↔세션 exact grant, 독립 결정, 불변 lifecycle·감사 원장                 |
| V50                | `SUPPORT_ACCESS_READ`를 Write/Review와 분리하고 최소 Ledger 조회 경계 적용 |
| V51                | 자동 containment actor·provenance·동시성 직렬화·V50 poison 정리 도입       |
| V52                | V51 SYSTEM 주체의 Assignment·Permission 제거, zero-authority 강제          |
| V53                | 유효 지원 권위 상실 시 요청·세션 DB containment와 주기 reconciliation      |

적용 파일과 중앙 레지스트리의 동결값은 다음과 같다.

| Migration     | SHA-256                                                            | Flyway checksum | 적용 상태 |
| ------------- | ------------------------------------------------------------------ | --------------- | --------- |
| Provider V52  | `99354b10b455a7dac4cccec0ab8d44c854cd80fa11e99a30e9f9b3f60ca43b19` | `1542396037`    | 적용·동결 |
| Provider V53  | `62031b358556e1336ff25a3b8c457a42b5c5bd31376d9673aef2c0d015e57e31` | `1931815749`    | 적용·동결 |
| Platform V202 | `fc3f2dba0604ab7d2f2689a5f2643e714bf1cc030370957d9906c7830ff947fd` | `38911951`      | 적용·동결 |
| Platform V203 | `670622b178fe2ff4fa8b43be00e2bd3cfba942763b4c2c237df31d12454320c4` | `941038123`     | 적용·동결 |
| Platform V204 | `abaced261a35324e5c292fb4ba6ad09d366cb50678270ff84b7918039c1eb78c` | `30640446`      | 적용·동결 |
| Platform V205 | `931bf5ab3f333171f3e1ec2e4844060c75e619d8bbfc1fcad9d9b18ac8d1e0d0` | `-1865229484`   | 적용·동결 |
| Platform V206 | `242eaa9c1ecac4755bfdc174ab047d648807b1bb0e3322859d46c7dbca980b13` | `1546567330`    | 적용·동결 |
| Platform V207 | `e1759a438deb1e115522b94cfacd42118da5e4e4bb52dc4bf17445c03ec06635` | `-1314302349`   | 적용·동결 |

Provider V53을 먼저 적용하고 Platform V203, V204, V205, V206, V207을 순서대로 적용한다.
이미 적용된 Migration을 수정하거나 Flyway repair로 정합성을 우회하지 않는다. V205는
Meeting·Mail 조직 코드 계약, V206은 Widget 명령 Target 계약, V207은 Widget ingress 실패 계약을
중앙 코드 레지스트리에 exact projection한다.

Migration은 같은 입력으로 재실행해도 중복 Principal·Assignment·Mapping을 만들지 않아야 한다.
실패 시 새 Principal을 삭제해 과거 증거를 훼손하지 않고 `MIGRATION_FAILED`로 비활성화해 재개한다.

### 5.3 `admin@dwp.local` 처리

- 이 전환의 Auth 기준 Migration은 `V99`다.
- 후속 Auth V100~V103은 제품 권한·Provider 분리·내구 Identity Plane·Reviewer 정리를
  순차 강제하고, 배포된 V99는 수정하지 않으며 Identity authority lock 직렬화는 V104
  forward migration으로 적용한다. V105는 모든 ACTIVE 관리자 활성화 Token을 회수하고
  `sys_account_activation_tokens`의 모든 INSERT를 DB Trigger로 차단한다. 향후 검증된
  고객 소유 OOB 전달 채널을 도입할 때도 V105를 수정하지 않고 조건부 발급을 여는
  새 Auth forward migration을 추가한다.
- 호환 Bootstrap과 Password Source 참조를 위해 `admin@dwp.local` Principal은 삭제하거나 로그인
  ID를 변경하지 않고 유지하되 표시명은 `Provider Bootstrap Administrator`로 변경한다.
- Auth Role에서 `ADMIN`을 제거하고 `PROVIDER_ADMIN`만 유지한다. Provider Operator Assignment도
  `PROVIDER_ADMIN` 하나만 남기고 Tenant Role·Resource Role·Workspace Entitlement는 0건이어야 한다.
- Role 정규화 Transaction에서 Access Revision을 증가시키고 기존 `DWP_SESSION`을 전부
  회수한다. Migration 재실행은 Revision을 불필요하게 다시 올리거나 새 Assignment를 만들지 않는다.
- 이후 `admin@dwp.local`은 `/provider/**`와 제한된 `/account` self-service만 허용하고
  `/admin`, 개인 홈과 Tenant 업무 API는 403이어야 한다. 호환 Bootstrap이라는 이유로
  지원 접근이나 SoD를 우회할 수 없다.
- Tenant 회귀는 Tenant 전용 계정, Provider 회귀는 `provider.admin@dwp.local` 또는 전문
  `provider.*` 계정으로 실행한다. SKAX Tenant Admin 대표 계정은 `hyunwoo.park@sk.com`이다.
- 양쪽 Plane을 다시 합치는 Rollback은 금지한다.

## 6. Rollout, 관측과 Rollback

| Wave                   | 변경                                                  | Entry                   | Exit                                      | 허용 Rollback                                                      |
| ---------------------- | ----------------------------------------------------- | ----------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| W0 Inventory           | 혼합 계정·Route·Session·Telemetry 관측                | Report Tool 검증        | Owner·Migration Target·예외 만료일 100%   | Report만 중단                                                      |
| W1 Assignment Guard    | 신규 혼합 Assignment·Token 차단                       | Negative Test           | 신규 충돌 0건, 기존 목록 동결             | UI만 숨김 해제 가능, 서버 Guard 유지                               |
| W2 Principal Migration | Provider 전용 Principal·Session 전환                  | 역할별 계정 준비        | 혼합 Principal·고아 Assignment 0건        | 개별 새 Principal 비활성화, 혼합 복원 금지                         |
| W3 Context·JIT         | Header Strip, 단일 Tenant Context, STANDARD Lifecycle | Read-only Shadow 일치   | A→B→A, 회수, 403/503, 사후 검토 Gate      | Write Off, Break-glass는 무조건 disabled 유지, 진단 Read-only 유지 |
| W4 Preview·Settings    | Synthetic Preview, Provider 설정 Applicability        | PII Canary·Fixture 승인 | Data Plane 호출 0건, 경계 E2E·접근성 통과 | Preview Off, 실제 Tenant 홈 Fallback 금지                          |
| W5 Production          | MFA·Audit 저장·Alert·Runbook·Pilot                    | 외부 Gate 승인          | 두 Pilot Tenant, Drill, Cross-tenant 0건  | 신규 세션 Off·기존 회수, Provider 진단만 유지                      |

각 Wave는 Provider 내부 사용자 → Internal Sandbox Tenant → Non-production Pilot Tenant → 제한된
Production Tenant 순으로 Canary한다. Tenant별 Feature Flag는 기능 권한을 부여하지 않으며 서버
Policy가 허용한 기능만 좁힐 수 있다.

즉시 Rollback 조건은 Cross-tenant 응답 1건, 지원 Actor 오기록 1건, 만료·회수 후 성공 호출,
Preview의 실제 Data API 호출, Token·고객 본문 Log 노출, 감사 유실 또는 무승인 Write다. 이 경우
신규 지원·Preview Export를 Kill Switch로 끄고 활성 Session을 회수하며 증거를 보존해 Incident를
선언한다. Provider/Tenant 역할 합성이나 Client Header 신뢰로 복구하지 않는다.

## 7. 수용 Test Matrix

2026-08-27 R1 Pilot PT 기계 원장 판정은 `COMPLETE` 28건, `PENDING_INTERNAL` 0건,
`BLOCKED_EXTERNAL` 1건, `FEATURE_DISABLED` 1건이다. 이 수치는 아래 PT-A01~PT-A30 범위의
Pilot 원장이며 ADR 9.2의 Production External Gate 전체가 완료됐다는 뜻이 아니다. 자동화가 아직 실제 시나리오를
증명하지 않는 항목은 표의 `자동 증거` 열에 목표가 적혀 있어도 완료가 아니다. 특히 WORM·SIEM·
KMS·고객 OOB·인적 승인은 저장소 테스트로 대체하지 않는다.

| ID     | 시나리오                                                   | 기대 결과                                                                                                      | 자동 증거                  |
| ------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| PT-A01 | Provider에 Tenant Role 부여                                | Transaction 403/정책 거부, Assignment 0건, Audit                                                               | Auth integration           |
| PT-A02 | Tenant에 Provider Role 부여                                | 동일                                                                                                           | Auth integration           |
| PT-A03 | Legacy 혼합 Token 발급·복원                                | 발급/복원 거부, Session 무효화                                                                                 | Auth security              |
| PT-A04 | Provider가 `/admin`, 개인 홈, 업무 API 직접 호출           | 지원 유무와 관계없이 UI는 Provider 안전 경로/404, Tenant API는 403, 데이터 0건. Exact Preview만 별도 허용      | Gateway/E2E                |
| PT-A05 | Tenant가 `/provider` 직접 호출                             | 403, Estate Metadata 0건                                                                                       | Gateway/E2E                |
| PT-A06 | Browser Tenant/Support Header 위조                         | Header 제거, 원 Context 유지 또는 403                                                                          | Gateway contract           |
| PT-A07 | STANDARD 요청 승인 참조 누락                               | 400, 요청 0건                                                                                                  | Provider integration       |
| PT-A08 | 같은 Idempotency Key·다른 Payload                          | 409, 기존 요청 불변                                                                                            | Provider concurrency       |
| PT-A09 | 요청자 자기 승인                                           | 403, 상태 불변, 거부 Audit                                                                                     | Provider integration       |
| PT-A10 | Reviewer 승인 후 다른 Operator 활성화                      | 403, Session 0건                                                                                               | Provider integration       |
| PT-A11 | 승인 요청자가 활성화                                       | 정확한 Scope·5~60분 Session 1건                                                                                | Provider E2E               |
| PT-A12 | Preview exact GET 외 호출, 퇴역 세 Scope 또는 미등록 Route | 403, 대상 Service Mutation 0건                                                                                 | Scope matrix               |
| PT-A13 | Tenant A Session으로 Tenant B 호출                         | 403, B 데이터 0건                                                                                              | Cross-tenant matrix        |
| PT-A14 | Session 만료·회수·Role Revision                            | 다음 REST·SSE 요청 거부, Cache 폐기                                                                            | Security/E2E               |
| PT-A15 | Provider 검증·Audit Outbox 장애                            | STANDARD JIT 활성화/Write 503 Fail closed, Break-glass는 별도 `INVALID_STATE`                                  | Resilience drill           |
| PT-A16 | A→B→A, 두 Tab·두 Browser·Back/Refresh                      | Operator별 활성 1건, 잔존 Cache·SSE 0건                                                                        | Browser/DB E2E             |
| PT-A17 | Break-glass 생성 시도                                      | 조건·Permission에 상관없이 `INVALID_STATE`, Session 0건                                                        | Provider integration       |
| PT-A18 | 종료 후 독립 사후 검토                                     | 요청자 검토 403, 전체 actual-use/explicit-no-use 집계와 canonical correlation, 이상징후 0건 뒤 원자적 REVIEWED | Provider PostgreSQL/E2E    |
| PT-A19 | Preview Scope 누락·다른 Scope·POST·User ID/Draft 입력      | 400/403, Snapshot 0건, 제외 Field 0건                                                                          | Preview contract           |
| PT-A20 | Preview Network Trace                                      | Data Plane·Mutation·외부 호출 0건                                                                              | Browser network            |
| PT-A21 | Preview PII Canary                                         | DOM·Screenshot·Log·Trace에 Canary 0건                                                                          | DLP visual/E2E             |
| PT-A22 | 같은 Preview Version 재실행                                | 허용 Field Renderer 동일, Client stale 최대 10초                                                               | Renderer/cache test        |
| PT-A23 | Provider 계정 설정                                         | Tenant Preference API 0회, Auth 언어·격리 Local Key만 사용, Tenant-only 직접 URL은 Appearance safe redirect    | Frontend/API E2E           |
| PT-A24 | Identity Plane 계약                                        | `/auth/me` plane 누락·unknown·Role 불일치·혼합 Role 503, 명시 TENANT/PROVIDER만 통과                           | Gateway 전체 Test          |
| PT-A25 | Internal Handler 계약                                      | 직접 `/_gateway/**` 404, Product Authorization no/user JWT 401, 전용 Service Token만 통과                      | Gateway/Auth Security Test |
| PT-A26 | 지원 중 Account/Workspace 이동                             | `/account/**`는 `/provider/support` redirect, Preference 보존·편집 금지, `/admin` 차단, Banner·종료 유지       | Frontend E2E               |
| PT-A27 | Token·Cookie·PII Log Scan                                  | 검출 0건                                                                                                       | CI DLP scan                |
| PT-A28 | Retention 만료·Legal Hold                                  | 정책대로 삭제/보류, 삭제 증거 Audit                                                                            | Scheduled-job integration  |
| PT-A29 | 혼합 Principal Migration 재실행                            | 중복 0건, 과거 Audit 불변                                                                                      | Migration integration      |
| PT-A30 | Keyboard·Mobile·200% Zoom                                  | Scope·Tenant·만료·종료를 인지·조작 가능                                                                        | Playwright visual/a11y     |

실패 응답은 대상 존재 여부를 누출하지 않는다. `403`과 `404` 정책은 Route Family별로 고정하며
같은 조건에서 UI Guard와 Server PEP가 다른 결과를 내면 Gate 실패다.

## 8. 운영 Runbook

### 8.1 Tenant 문제 조사

1. Provider 운영 지휘에서 고객 영향, Tenant·환경, Region·Cell, Service, Version과 최신 관측
   시각을 확인한다.
2. Incident·Deployment·Entitlement Drift와 Correlation 기반 Redacted 진단을 확인한다.
3. UI 구성 문제면 `TENANT_EXPERIENCE_PREVIEW`만 가진 STANDARD 요청을 만들고 고객 승인 증거
   참조와 Provider 독립 검토를 거친다.
4. 승인 후 제한 Projection의 `TENANT_CONFIGURATION_ONLY` Safe Preview로 재현하고 Session을
   종료한다.
5. 개인 상태가 의심되면 고객 사용자에게 Redacted Support Bundle을 요청한다.
6. 여전히 Tenant Admin 또는 Workforce 정보가 필요하면 고객 관리자 재현·Redacted Support Bundle로
   전환한다. 퇴역 Scope를 임시로 재활성화하지 않는다.
7. 고객 승인 증거 참조를 외부 System of Record에서 확인할 수 없으면 Reviewer는 거절한다.
8. 승인 후 요청자가 활성화하고 Banner의 Tenant·환경·Scope·TTL을 소리 내어 교차 확인한 뒤
   필요한 명령만 수행한다.
9. 결과와 Correlation ID를 Case에 연결하고 즉시 종료한다. Auditor는 전체 증거 집계가
   `READY_ACTUAL_USE` 또는 `READY_NO_USE`이고 이상징후가 0건인지 확인한 뒤 1영업일 안에
   원자적 사후 검토를 완료한다. 최근 6건 표시만 보고 완료하거나 불완전 증거를 우회하지 않는다.

### 8.2 다른 Tenant로 전환

1. 현재 지원 Session의 미저장 변경과 실행 중 작업을 확인한다.
2. 현재 Session을 종료하고 서버 상태가 `REVOKED` 또는 `COMPLETED`인지 확인한다.
3. Cache·SSE/WebSocket 정리 완료와 Provider Context 복귀를 확인한다.
4. 대상 Tenant의 별도 요청·승인·활성화를 수행한다. 이전 승인·Cookie·URL을 재사용하지 않는다.

### 8.3 의심 노출·회수 실패

1. 신규 STANDARD JIT와 Preview Export Kill Switch를 활성화한다. Break-glass는 이미
   Service Code에서 무조건 disabled이므로 유지한다.
2. 모든 활성 지원 Session Revision을 갱신·회수하고 실시간 연결을 종료한다.
3. SEV Incident를 선언하고 Audit Outbox·Gateway·대상 Service·Browser Evidence를 보존한다.
4. 영향 Tenant·환경·시간·Scope를 계산하되 고객 본문을 조사 Report에 복사하지 않는다.
5. Security·Privacy·고객 통지 정책을 실행하고, 수정 후 T1~T12 전체 Regression을 재수행한다.

## 9. 승인·책임과 출시 Evidence

| 책임                 | 승인 대상                                              |
| -------------------- | ------------------------------------------------------ |
| Product Architecture | Plane, Context, Preview·Impersonation 경계             |
| Identity/Security    | Principal 분리, MFA, Session·Break-glass, Threat Model |
| Provider Operations  | 역할·SoD, 고객 증거 검증 Runbook, Kill Switch·Drill    |
| Tenant Product Owner | Tenant Admin Scope, Preview 정확성의 한계, 고객 통지   |
| Privacy/Legal        | Support Bundle, 보존·삭제, 고객 승인 증거와 지역 정책  |
| SRE                  | Telemetry, Alert, p99 회수 효력, 복구·SIEM/WORM 증거   |

### 9.1 2026-08-27 검증 Snapshot

- Live source와 checksum이 일치하는 fresh isolated Backend 전체 `check`: 72/72 actionable
  tasks, 513 suites, 2,518 tests, 실패·오류 0, 명시적 skip 25
- Provider 전체 `check`: 229 tests, 실패·오류·스킵 0
- V53 authority containment PostgreSQL 핵심 경로: 24/24
- V52→latest migration 경로: 7/7
- 권위 reconciliation worker/service: 8/8
- Widget receiver payload/Manifest security target: 69/69, 독립 공격 검토 P0/P1 0
- Platform 전체: 798 tests, 실패·오류·스킵 0. V205→V207 PostgreSQL/Widget 경로: 84/84
- 중앙 코드 계약 Audit: 770 contracts, 3,008 active values, 904 bindings
- Agent fresh isolated V1→V20 전체: 221/221, 스킵 0. Runtime OpenAPI Snapshot과 compileall: PASS
- Provider 권한 기반 Landing resolver: 5/5. Release/Data Approver 공식 진입·Account 복귀
  Chromium Target E2E: 2/2, 권한 없는 Estate 요청 0건
- Release Evidence validator: 8/8. `--release`는 수정되거나 untracked인 동일·외부 저장소
  증거 파일을 거부한다.
- 전체 Backend OpenAPI, source-size 1,137 files, service-boundary, Flyway checksum: PASS
- PT 원장: `COMPLETE 28 / PENDING_INTERNAL 0 / BLOCKED_EXTERNAL 1 / FEATURE_DISABLED 1`

`PT-A28`의 WORM·Retention·Legal Hold 실증은 Production을 차단하는 외부 Gate다. `PT-A17`은
출시 필수 기능의 미완료가 아니라 의도적으로 fail-closed한 비활성 기능이며, 별도 정책·통제·
증거가 출시되기 전에는 활성화하지 않는다.

위 자동화 수치는 통과 당시 live source와 checksum이 같은 격리 **working-tree candidate**의
Software Gate다. 아직 Commit되지 않은 변경이나 로컬 Test Log를 불변 Release Evidence라고
부르지 않는다. 실제 Release Handoff에서는 세 저장소의 clean committed revision, 해당 revision과
일치하는 증거 파일, 보존된 Test Artifact를 연결해야 하며 검증기는 mutable/untracked 증거를
fail-closed한다.

Release Evidence에는 다음 항목을 Commit·Migration Version·환경·실행 시각·Owner와 함께 연결한다.

- PT-A01~PT-A30 Test Report와 실패 0건 요약
- 혼합 Principal·고아 Assignment·재인증 없이 사용 가능한 Legacy Session 0건 및 Operator별 활성
  지원 Session 1건 이하 Report
- Route+Method+Scope Allowlist Manifest와 Drift 검사 결과
- A→B→A Browser Trace, PII Canary, Preview Network Trace와 접근성 Capture
- STANDARD·Break-glass·회수·검증 장애 Drill Timeline과 Audit Correlation
- Log/Trace/Metric DLP Scan, Support Bundle 삭제, Retention·Legal Hold 결과
- 외부 Gate는 Provider IdP MFA, 고객 승인 System of Record Runbook, KMS/HSM, WORM, SIEM,
  Pilot Tenant 서명 증거. 연결되지 않은 항목은 `pending_external`로 남긴다.
- Provider 표시 Preference의 Cross-device Server Sync는 현재 출시 범위 밖의 별도 Backend
  계약이다. Browser-local 동작을 동기화 완료로 표시하지 않으며 현 PT 원장의
  `PENDING_INTERNAL` 항목으로 계산하지 않는다.

최종 Release 승인은 Cross-tenant 노출, 사용자 가장, 무승인 Write, 만료·회수 후 성공 호출,
민감정보 Log와 감사 유실이 모두 0건일 때만 가능하다.
