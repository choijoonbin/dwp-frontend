# DWP-R1-CORE-006 API 권한 계약

Pilot의 Route별 실제 Seed는 [Pilot 권한 Registry Seed](10-Pilot%20권한%20Registry%20Seed.md)를
이 계약의 규범적 부속 문서로 사용한다.

## 1. 원칙

Surface Mode는 권한이 아니다. 모든 Navigation, Route, Page Action과 API는 Auth가 계산한 Exact
Capability, 대상 Scope와 객체 관계를 사용한다. Frontend Manifest는 Projection이며 Backend
인가 근거가 아니다.

```text
ALLOW =
  Authenticated
  AND TenantMatches
  AND DeclaredAuthorityPredicateMatches
  AND ScopeResolverAllowsTarget
  AND RelevantEntitlementAssignmentOrGrantIsActive
  AND ExplicitProductEntitlementRulePasses
  AND SoDPolicyPasses
  AND RiskActivationAndAssurancePasses
```

`DeclaredAuthorityPredicateMatches`는 Descriptor의 Authority Mode에 따라 Exact Capability,
Relationship, 둘의 AND·승인된 제한적 OR 또는 Support Session을 서버가 판정한다.
Product Management의 기본은 Exact Capability와 활성 Responsibility/Resource Set의 AND다.

## 2. 고정 Endpoint

### `GET /api/auth/product-surface-contexts`

현재 Actor가 바로 진입할 수 있는 Product Surface의 허용 Context만 반환한다. Auth의 Management
Grant, Work Entitlement와 Product Service의 Relationship Eligibility를 Gateway Read Model이
표시용으로 합성하되 Product Service의 최종 인가 권위는 유지한다.

```json
{
  "success": true,
  "data": {
    "contractVersion": "1",
    "decisionRevision": "opaque-revision-r42-p7-h19-s3",
    "sourceRevisions": {
      "auth": "AUTH-R42",
      "policy": "POLICY-R7",
      "productRelationship": "REL-R19",
      "targetPopulation": "POP-R12",
      "support": "SUPPORT-R3"
    },
    "activeAccessMode": "NORMAL",
    "generatedAt": "2026-08-21T09:00:00Z",
    "contexts": [
      {
        "contextKey": "opaque-effective-context",
        "productKey": "approvals",
        "surfaceKey": "approvals.admin",
        "plane": "management",
        "accessMode": "NORMAL",
        "accessSource": "MANAGEMENT",
        "appResourceKey": "APP.APPROVALS",
        "effectiveGrants": [
          {
            "grantKind": "CAPABILITY",
            "capabilityContractKey": "approvals.design.read",
            "resolvedCapabilityCode": "ADMIN.APPROVAL_DESIGN:VIEW",
            "authorityMode": "PERMISSION",
            "responsibilityRequirement": "REQUIRED",
            "responsibility": {
              "code": "APP_CONFIG_ADMIN",
              "resourceSetKey": "APPROVALS"
            },
            "scopeKeys": ["opaque-context-key"],
            "requiresProductEntitlement": false,
            "readOnly": true,
            "activationState": "ACTIVE",
            "validUntil": "2026-12-31T15:00:00Z"
          }
        ],
        "scopes": [
          {
            "key": "opaque-context-key",
            "kind": "RESOURCE_SET",
            "displayName": "전자결재",
            "isDefault": true,
            "readOnly": true,
            "validUntil": "2026-12-31T15:00:00Z"
          }
        ],
        "revalidateAt": "2026-12-31T15:00:00Z"
      }
    ]
  }
}
```

### Response 불변식

- 한 Context는 정확히 하나의 Product·Surface·서버가 결정한 Active Access Mode를 나타낸다.
- Effective Grant는 `CAPABILITY | POLICY` Discriminated Union이다. Capability Grant는
  Stable Contract Key·Resolved Exact Code·Authority Mode·Responsibility Requirement·Scope·
  Product Entitlement·Validity를, Policy Grant는 Access Policy·Entitlement/Relationship/Support
  Mode·Scope·Validity를 결속한다. Client는 다른 Grant의 필드를 조합하지 않는다.
- Relationship·Support를 인공 Capability로 변환하지 않는다.
- 명시적 DENY, 만료와 비활성 App·Resource·Capability Context는 허용 목록에서 제거한다.
- Active Support Session이면 같은 Session의 `NORMAL` Context를 평가·반환하지 않는다.
- `decisionRevision`은 Auth·Policy·Relationship·Target Population·Support Revision을 포함한
  Opaque Composite Token이며 Client는 `sourceRevisions`를 조합하지 않는다.
- `revalidateAt`은 Grant·Scope·Session 만료와 Policy 재평가 중 가장 이른 시각이다.
- Scope `readOnly=true`는 해당 Scope에 현재 유효한 Mutation Grant가 하나도 없다는 뜻이다.
- Scope가 하나면 `isDefault=true`다. 복수 Scope는 기본이 정확히 0개 또는 1개이며 두 개 이상이면
  서버 Contract Error로 Fail Closed한다.
- Opaque Context·Scope Key가 있어도 Gateway와 서비스는 Actor·Tenant·Product·Surface·Target을
  다시 계산한다.

### `POST /api/auth/product-surface-access/evaluate`

Direct URL, 새 Tab과 비허용 상태를 결정한다.

요청 Subject는 `PRODUCT`만 허용하며 Product·Surface를 둘 다 요구한다.

```json
{
  "subject": {
    "type": "PRODUCT",
    "productKey": "approvals",
    "surfaceKey": "approvals.admin"
  },
  "routeContractKey": "route.approvals.admin.policies.page",
  "contextKey": "optional-opaque-effective-context",
  "contextScopeKey": "optional-opaque-key"
}
```

유효 Identity에 대한 판정은 HTTP 200으로 다음 `decision` 중 하나를 반환한다.

```text
ALLOWED | APP_DENIED | SURFACE_DENIED | ROUTE_DENIED | SCOPE_SELECTION_REQUIRED | SCOPE_INVALID |
EXPIRED | ACTIVATION_REQUIRED | STEP_UP_REQUIRED | SOD_CONFLICT |
SUPPORT_SCOPE_DENIED | AUTHORITY_UNAVAILABLE
```

서버는 `routeContractKey`를 독립 Route Authorization Registry의
Product·Surface·Route ID/Pattern·Method와 대조하고, 해당
Child Route의 Exact Capability 또는 Policy를 Surface Entry와 함께 평가한다. Client는 Raw
Capability Code를 선택해 보내지 않는다. `contextKey`가 없는 새 Tab은 서버가 Active
Access Mode와 Context를 재계산하고, 있으면 현 Actor·Session·Revision에 속하는지 재검증한다.

`ALLOWED`는 정확히 한 Effective Context, Route Grant Reference, 선택 Scope,
`effectiveReadOnly`와 `revalidateAt`을 포함한다. 다른 Decision은 공개 가능한 `validUntil`,
`expiredAt`, `requiredAssurance`, 재요청 Policy Ref와 최신 Decision Revision만 포함하고 보호된 Scope·Object
Label을 노출하지 않는다. 알 수 없는 Decision 값은 Client에서 `AUTHORITY_UNAVAILABLE`로 Fail
Closed한다. 미인증은 401, 평가 Resolver 장애는 503이다.

### `POST /api/auth/governed-route-access/evaluate`

Product Surface가 아닌 Assigned Work의 Direct Route를 평가한다. Product Context와 합치지 않는다.

```json
{
  "subject": {
    "type": "GOVERNED_CONTEXT"
  },
  "navigationContextId": "work.work",
  "routeContractKey": "route.context.work__work.review-detail.data",
  "target": {
    "opaqueTargetRef": "opaque-work-item-reference",
    "expectedObjectVersion": "v11"
  },
  "contextKey": "optional-opaque-governed-context"
}
```

`target.opaqueTargetRef`는 Target Predicate가 있는 Governed Route에서 필수이며 서버가 Campaign·
Assignment·실제 Object로 다시 Resolve한다. `expectedObjectVersion`은 Mutation에서 필수이고 Read
평가에서는 생략할 수 있다. `contextKey`는 직전 허용 응답을 재검증하기 위한 편의 Reference일 뿐
Target이나 권한 증거가 아니며, 없거나 다른 Actor·Tenant·Revision에 속하면 서버가 최신 Context를
재평가하거나 Fail Closed한다.

허용 Decision은 `ALLOWED | ROUTE_DENIED | EXPIRED | STEP_UP_REQUIRED | SOD_CONFLICT |
AUTHORITY_UNAVAILABLE`이다. `APP_DENIED`, `SURFACE_DENIED`, Scope Selection은 반환하지 않는다.
`ALLOWED`는 `GovernedRouteAccessContext` 하나를 반환한다.

```ts
type GovernedRouteAccessContext = {
  contextKey: string;
  navigationContextId: string;
  accessSource: 'RELATIONSHIP' | 'ENTITLEMENT' | 'MANAGEMENT' | 'SUPPORT';
  accessMode: 'NORMAL' | 'ELEVATED' | 'PROVIDER_SUPPORT';
  routeGrantRef: string;
  effectiveReadOnly: boolean;
  decisionRevision: string;
  revalidateAt: string;
};
```

Named Reviewer는 `identity.named-reviewer-access.v1`의 현재 Assignment·Campaign Validity·Object
Version을 평가한다. Product Key·Surface Key·Product Scope를 생성하거나 `/admin` 접근으로
확장하지 않는다. Unknown Decision은 Client `authority-unavailable`, Resolver 장애는 503이다.

## 3. Capability Descriptor

| 필드                         | 의미                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| `contractKey`                | Manifest·Navigation·Route·Test의 영구·불변 ID                             |
| `resolvedCapabilityCode`     | 현 Policy Version의 Exact `resource:action` Mapping                       |
| `mappingVersion`             | Contract Key→Exact Action Mapping Version                                 |
| `product`                    | Product Contract Key                                                      |
| `surface`                    | 허용 Surface Key                                                          |
| `routeContractKeys`          | 해당 Action을 요구하는 Route·Method Contract                              |
| `resource`                   | Exact Resource Key                                                        |
| `action`                     | Exact Permission Code                                                     |
| `authorityMode`              | `PERMISSION`, `PERMISSION_AND_RELATIONSHIP`, `PERMISSION_OR_RELATIONSHIP` |
| `responsibilityRequirement`  | REQUIRED/NOT_REQUIRED/LEGACY_OVERSIGHT                                    |
| `scopeResolver`              | 대상 범위 판정기                                                          |
| `riskTier`                   | Step-up/JIT·Approval 근거                                                 |
| `activationPolicy`           | requiredAcr·maxAuthAgeSeconds·activationTtlSeconds·Risk Policy            |
| `sodPolicyId`                | Resource Set·Target·검사 시점을 가진 SoD Policy                           |
| `requiresProductEntitlement` | `APP.*`를 추가로 요구하는지                                               |
| `owner`                      | Product·Security 승인 Owner                                               |
| `sunsetAt`                   | Legacy Oversight·Compatibility 종료 시각                                  |
| `legacySource`               | 기존 Role·Permission·Endpoint 증거                                        |

하나의 Active `contractKey`는 한 Policy Version에서 Exact Action 하나로만 Mapping한다.
Surface Entry와 Navigation은 둘 다 Contract Key를 참조하며 Raw Capability Code를 Manifest에
중복 하드코딩하지 않는다.

Capability Descriptor는 Permission 계열의 행위 계약만 소유한다. 순수 Relationship,
Entitlement와 Provider Support Session은 Governed Access Policy Descriptor가 소유한다.

### 3.1 Governed Route Authorization Contract Registry

Capability Contract와 Route Contract는 별도 Namespace다. Product Route Key는
`route.<product>.<surface>.<route-path>.<kind>`, 비제품 Governed Route Key는
`route.context.<navigation-context-token>.<route-path>.<kind>`을 사용하고 다음 필드를
Versioned Registry에 고정한다.

| 필드                                       | 계약                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `routeContractKey`                         | 위 Product/비제품 Namespace의 영구 ID; `route-path`는 하나 이상의 lower-kebab 점 구간     |
| `navigationContextId`                      | 169 메뉴 분류표의 Governed Context 결속                                                   |
| `subject`                                  | `PRODUCT(productKey,surfaceKey)` 또는 `GOVERNED_CONTEXT`; Context ID는 Top-level에만 존재 |
| `routeKind`, `uiRouteId`, `uiRoutePattern` | PAGE/DATA/ACTION; PAGE만 Router ID·Pattern 필수                                           |
| `sideEffectFree`                           | POST DATA만 true 필수; Business State·Workflow Outbox 변경 금지                           |
| `accessProfiles`                           | 서버 선택형 Non-empty Access·Projection Profile 목록                                      |
| `gatewayApiBindings`                       | Stable Key + Public Method·Path + Typed Path Parameter Constraint                         |
| `servicePepBindings`                       | 같은 Key·Constraint + `serviceKey` + Service Exact Method·Path                            |
| `owner`, `policyVersion`, `lifecycleState` | 승인·Rollback·ACTIVE/RETIRED                                                              |

Router Definition이 Registered Route Catalog과 Key Projection을 생성하고, CI가 UI
Pattern·Auth Registry·Public Gateway Binding·Downstream Service PEP Binding을 양방향 대조한다.
두 Binding을 같은 Prefix 문자열로 추정하지 않는다. Client의 Key는
Permission 선택권이 아니다. Unknown/Retired Key, Product·Surface 불일치, Method 불일치,
다른 Route의 유효한 Capability Key 제출은 모두 `ROUTE_DENIED`다.
권한 의미를 바꾸는 Parameter는 `FIXED(value)` 또는 `ALLOWLIST(non-empty values)`로 Public·Service
Binding Pair에 동일하게 저장하고 PEP가 실제 값과 대조한다. `surfaceKey`, HCM `domain`, Code Set,
Event Type의 Constraint 누락·불일치·빈 Allowlist는 Registry Build를 실패시킨다.
Service-local Path Grammar는 `platform/approval/people=/v1/**`, `auth=/auth/**`로 고정하고
`serviceKey`의 OpenAPI와 맞지 않으면 실패한다.

PAGE만 Browser Resolver에 참여한다. DATA는 GET/HEAD Read 또는 `sideEffectFree=true`인 POST
Query이고 응답 Projection을 필수로 가진다. POST DATA는 응답과 무관한 append-only Security Audit만
기록할 수 있다. Business State·Workflow Outbox를 바꾸거나 ACTION이 Response Projection을 가지면
Registry Build를 실패시킨다. ACTION은 Mutation이며
DATA/ACTION에 `uiRouteId/uiRoutePattern`이 있으면 Registry Build를 실패시킨다.

각 Access Profile은 고유 `profileKey`, 고유 `precedence`, Non-empty `activeAccessModes`, 정확히 한 Access Union Member,
optional Non-empty `targetBindingKinds`, Non-empty `predicatePolicyKeys`, `readOnly`를 가진다.
복합 범위는 Kind 배열과 Predicate를 AND하고 하나만 선택하지 않는다. PAGE/DATA는
응답을 가진 모든 Stable API Binding Key마다 `projectionPolicyKey + responseSchemaKey` Pair를
필수로 가지며 ACTION은 Read Projection Binding을 금지한다.
Client Request에는 Profile Key·Predicate를 받지 않는다. 서버가 현재 Active Access Mode와 일치하는
허용 Profile 중 고유
Precedence가 가장 높은 하나를 선택하고 `routeGrantRef`로만 회신한다. 동률·중복·미등록
Projection·Predicate는 Fail Closed다. 같은 Route의 Full Management, Auditor, Provider Support와
Legacy Oversight Projection을 이 방식으로 분리한다.

`predicatePolicyKeys`는 같은 Bundle의 Predicate Policy Registry를 참조한다. 각 Descriptor는
Owner Service, Target Binding Kind, Evidence Schema Key, Typed Fixed Parameter/Allowlist,
Route Allowlist, Owner·Version·Lifecycle을 필수로 가진다. Product API가 실제 Object·Relationship·
Target Population을 평가하고 Opaque Decision만 반환한다. Unknown Key, Evidence Schema Drift,
Target Kind·Owner 불일치는 503/Registry Build Fail Closed다. 복수 Predicate는 전부 AND이며 각
Predicate는 Profile Target Set과 자신의 허용 Target Set의 Non-empty 교집합만 소비한다. 모든
교집합의 합집합이 Profile Target Set과 정확히 같아야 하고, 한 Descriptor가 전체 Target Set을
혼자 포함하도록 요구하지 않는다.

Route Seed에서 `requiredAccess`를 읽어 Capability와 Policy Descriptor의 `routeContractKeys`를
정렬된 Exact 역참조로 생성한다. Direct Capability와 Expression Member뿐 아니라 MODE_BRANCH
Policy의 Capability Branch가 요구하는 Key도 해당 Route를 역참조한다. Descriptor→Route와
Route→Descriptor가 양방향으로 같지 않거나 Unknown·Retired Route가 섞이면 Bundle Build를
실패시킨다.

### 3.2 Governed Access Policy Descriptor

Policy Grant는 다음 Authority Mode를 명시한다.

| Mode                           | 의미                                                         |
| ------------------------------ | ------------------------------------------------------------ |
| `ENTITLEMENT`                  | App Entitlement 기반 Work 진입                               |
| `RELATIONSHIP`                 | Named Assignment·Self 등 서버 관계                           |
| `ENTITLEMENT_AND_RELATIONSHIP` | App Entitlement와 Reporting·Delegation·Target Population AND |
| `SUPPORT_SESSION`              | NORMAL Grant와 합산하지 않는 승인 Support Session            |

Descriptor는 `accessPolicyKey`, `navigationContextId`, Authority Mode와 Product/Surface Subject,
`requiresProductEntitlement`, Versioned Entitlement Expression Key, Relationship·Scope Resolver,
Route Contract Key, Support Scope, Owner·Policy Version·Lifecycle을 가진다. Approvals·Communications·Services Work는
`ENTITLEMENT`, HCM Team은 `ENTITLEMENT_AND_RELATIONSHIP`로 표현한다. Policy Grant는
`policyDecisionRef`를 포함하되 Resolver 내부 Evidence를 Client에 노출하지 않는다.

Product Policy는 `productKey + surfaceKey + Non-empty surfaceEntryKeys`를 모두 갖는다. Named
Reviewer 같은 비제품 Policy는 두 Key를 모두 null, `surfaceEntryKeys=[]`, 안정
`navigationContextId`를 필수로 갖는다. 한쪽 Key만 있거나 비제품 Policy가 Surface Entry를 가지면
Registry Build를 실패시킨다.

Policy는 `evaluationType=SINGLE | MODE_BRANCH`를 가진다. `MODE_BRANCH`의 각 Branch는
`activeAccessMode` 하나와 다음 중 하나를 결속한다.

- NORMAL/ELEVATED: `resultGrantKind=CAPABILITY`, ANY/ALL Capability Contract Key,
  Responsibility Requirement
- PROVIDER_SUPPORT: `resultGrantKind=POLICY`, `authorityMode=SUPPORT_SESSION`, Non-empty
  Support Scope

현재 서버 Active Mode와 일치하는 Branch 하나만 평가하고 다른 Branch와 합산하지
않는다. Communications의 `communications.management-entry.v1`,
`communications.content-route-access.v1`과 HCM `hcm.operations-overview-read.v1`이 이
계약을 사용한다. 결과 Context는 NORMAL이면 CAPABILITY Grant, SUPPORT면 Read-only
POLICY Grant 하나만 담는다.

OpenAPI는 이를 Discriminated Union으로 생성한다. SINGLE은 Top-level `authorityMode`와 조건에
맞는 Entitlement Expression/Relationship/Support Scope만 가지며 `modeBranches`를 금지한다.
MODE_BRANCH는 Non-empty `modeBranches`만 가지며 Top-level `authorityMode`,
`entitlementExpressionKey`, `supportScopes`를 금지한다. SINGLE `SUPPORT_SESSION` 외의
`supportScopes`, Unknown Branch Mode, 중복 Active Mode와 빈 Branch는 422/Registry Build Fail이다.

### 3.3 Pilot Governed Access Policy Registry

다음 Key는 모두 Owner·Policy Version·Lifecycle을 가진 Active Descriptor다. 명시된
Surface Entry·Route 외의 Consumer를 추론하지 않는다.

- `communications.work-access.v1`
  - SINGLE / ENTITLEMENT / `requiresProductEntitlement=true`
  - Entitlement Expression `COMMUNICATIONS_WORK_ACCESS_V1` = `APP.COMMUNICATIONS:VIEW`, Scope `SELF`
  - Surface `communications.work`; Route Keys `route.communications.work.home.page`,
    `route.communications.work.for-you.page`, `route.communications.work.all.page`,
    `route.communications.work.required.page`, `route.communications.work.saved.page`
  - Dynamic Route Keys `route.communications.work.for-you-story.page`,
    `route.communications.work.all-story.page`, `route.communications.work.required-story.page`,
    `route.communications.work.saved-story.page`
  - Self Action Keys `route.communications.work.event.action`,
    `route.communications.work.reader-state.action`,
    `route.communications.work.acknowledgement.action`,
    `route.communications.work.reaction.action`
- `communications.management-entry.v1`
  - MODE_BRANCH / `requiresProductEntitlement=false` / Scope `RESOURCE_SET`
  - NORMAL: Capability `communications.content.read`, Responsibility REQUIRED
  - PROVIDER_SUPPORT: Policy SUPPORT_SESSION, Scope `TENANT_CONFIGURATION_READ` 또는
    `TENANT_CONFIGURATION_WRITE`, 결과 Read-only
  - Surface Entry `communications.management`
- `communications.content-route-access.v1`
  - 위 Management Entry와 동일한 MODE_BRANCH
  - Route Key `route.communications.management.content.page`
- `services.work-access.v1`
  - SINGLE / ENTITLEMENT / `requiresProductEntitlement=true`
  - Entitlement Expression `SERVICES_WORK_ACCESS_V1` = `APP.EMPLOYEE_SERVICES:VIEW`, Scope `SELF`
  - Surface `services.work`; Route Keys `route.services.work.home.page`,
    `route.services.work.discover.page`, `route.services.work.my.page`,
    `route.services.work.drafts.page`, `route.services.work.my-detail.page`,
    `route.services.work.draft-detail.page`
  - Self Action Keys `route.services.work.request-create.action`,
    `route.services.work.draft-update.action`, `route.services.work.draft-submit.action`,
    `route.services.work.request-cancel.action`
- `approvals.work-access.v1`
  - SINGLE / ENTITLEMENT / `requiresProductEntitlement=true`
  - Entitlement Expression `APPROVALS_WORK_ACCESS_V1` = `APP.APPROVALS:VIEW`, Surface Scope
    `SELF`; Task/Request는 Child DATA/ACTION의 `targetBindingKinds`로 별도 재검사
  - Surface Entry `approvals.work`; Policy Route Keys `route.approvals.work.home.page`,
    `route.approvals.work.home-preference.data`,
    `route.approvals.work.home-preference-update.action`
  - 나머지 Work Child는 7.1의 Exact Capability/Expression Route Contract를 사용한다.
- `hcm.personal-access.v1`
  - SINGLE / ENTITLEMENT_AND_RELATIONSHIP / `requiresProductEntitlement=false`
  - Entitlement Expression `HCM_PERSONAL_SURFACE_ACCESS_V1` = ANY(`APP.HCM:VIEW`,
    `APP.PEOPLE_DIRECTORY:VIEW`); Relationship `SELF_PERSON_BINDING`; Scope `SELF`
  - Surface Entry `hcm.personal` 전용이며 Child Route 권한을 만들지 않는다.
- `hcm.personal-core-access.v1`
  - SINGLE / ENTITLEMENT_AND_RELATIONSHIP / `requiresProductEntitlement=false`
  - Entitlement Expression `HCM_PERSONAL_CORE_ACCESS_V1` = `APP.HCM:VIEW`
  - Relationship `SELF_PERSON_BINDING`; Scope `SELF`
  - Route Keys `route.hcm.personal.home.page`, `route.hcm.personal.me.page`,
    `route.hcm.personal.time.page`, `route.hcm.personal.absence.page`,
    `route.hcm.personal.benefits.page`, `route.hcm.personal.pay.page`,
    `route.hcm.personal.talent.page`, `route.hcm.personal.home-preference.data`
  - Self Action Keys `route.hcm.personal.time-entry-update.action`,
    `route.hcm.personal.time-submit.action`, `route.hcm.personal.absence-create.action`,
    `route.hcm.personal.absence-withdraw.action`,
    `route.hcm.personal.talent-goal-update.action`,
    `route.hcm.personal.home-preference-update.action`
- `hcm.directory-access.v1`
  - SINGLE / ENTITLEMENT_AND_RELATIONSHIP / `requiresProductEntitlement=false`
  - Entitlement Expression `HCM_DIRECTORY_ACCESS_V1` = ANY(`APP.HCM:VIEW`,
    `APP.PEOPLE_DIRECTORY:VIEW`); Relationship `SELF_PERSON_BINDING`; Scope `SELF`
  - Route Keys `route.hcm.personal.directory.page`, `route.hcm.personal.organization.page`,
    `route.hcm.personal.directory-person-detail.data`
- `hcm.personal-services-access.v1`
  - SINGLE / ENTITLEMENT_AND_RELATIONSHIP / `requiresProductEntitlement=false`
  - Entitlement Expression `HCM_PERSONAL_SERVICES_ACCESS_V1` =
    ALL(`APP.HCM:VIEW`, `APP.EMPLOYEE_SERVICES:VIEW`)
  - Relationship `SELF_PERSON_BINDING`; Scope `SELF`
  - Route Key `route.hcm.personal.services.page`
- `hcm.team-access.v1`
  - SINGLE / ENTITLEMENT_AND_RELATIONSHIP / `requiresProductEntitlement=false`
  - Entitlement Expression `HCM_TEAM_PRODUCT_ACCESS_V1`; Relationship
    `DIRECT_REPORT_OR_APPROVED_DELEGATION`; Scope `TEAM/ORG_UNIT`
  - `HCM_TEAM_PRODUCT_ACCESS_V1` = ANY(`APP.HCM:VIEW`,
    `APP.WORKFORCE_MANAGEMENT:VIEW`), Owner HCM+Security, Version 1, ACTIVE
  - Surface Entry `hcm.team`; Policy Route Key `route.hcm.team.home.page`
  - Time/Absence Child Page·Action은 Surface Entry Policy와 별도로 8절의
    `PERMISSION_AND_RELATIONSHIP` Exact Capability Route Contract를 요구한다.
- `hcm.operations-access.v1`
  - MODE_BRANCH / `requiresProductEntitlement=false` / Scope `ORG_UNIT/LEGAL_ENTITY`
  - NORMAL: Capability ANY `hcm.operations.workforce.read`,
    `hcm.operations.time.read`, `hcm.operations.absence.read`,
    `hcm.operations.benefits.read`, `hcm.operations.pay.read`,
    `hcm.operations.talent.read`;
    Responsibility NOT_REQUIRED; Product Target Population 필수
  - PROVIDER_SUPPORT: Policy SUPPORT_SESSION, Scope `WORKFORCE_READ`, Read-only
  - Surface Entry `hcm.operations`
- `hcm.operations-overview-read.v1`
  - 위 Operations Entry와 동일한 MODE_BRANCH와 Scope
  - Route Key `route.hcm.operations.overview.page`
- `hcm.operations-workforce-read.v1`
  - 위 Operations Entry와 동일한 MODE_BRANCH와 Scope
  - NORMAL은 `hcm.operations.workforce.read`와 Workforce Target Population을 요구하고,
    PROVIDER_SUPPORT는 `WORKFORCE_READ` Session의 Read-only Policy Grant를 반환
  - Route Keys `route.hcm.operations.people.page`,
    `route.hcm.operations.assignments.page`
- `identity.named-reviewer-access.v1`
  - SINGLE / RELATIONSHIP / `requiresProductEntitlement=false`
  - Resolver `NAMED_REVIEWER_ASSIGNMENT`, Governed Route Scope Resolver
    `ASSIGNED_WORK_ITEM`, `targetBindingKinds=[OBJECT]`
  - Route Keys `route.context.work__work.review-detail.data`,
    `route.context.work__work.review-decision.action`

Named Reviewer Route는 `navigationContextId=work.work`, Product/Surface 없음인 Governed Route다.
Product Surface Registry나 121개 업무 앱 Menu 소유권으로 투영하지 않는다.
`navigationContextId`는 `_`가 없는 lower-kebab 점 구간만 허용하며 비제품 Key의
`navigation-context-token=work__work`는 점↔`__` 총함수로 `work.work`에 유일하게 역해석되어야
한다. Subject에 Context ID를 중복 저장하거나 Key Token과 Top-level Context가 다르면 Bundle
Build를 실패시킨다. 별도 Token Registry는 두지 않는다.

모든 Entitlement Expression은 Key, Typed `ANY | ALL` Tree, Exact App Entitlement Leaf,
Owner, Version, Lifecycle을 Registry에 고정한다. Empty Tree·Unknown/Retired Leaf·빈 Permission
Payload는 Fail Closed다. 모든 Capability ANY 목록은 생성 Registry에서 각각의 불변
Capability Contract Key로 확장하고 Runtime Wildcard를 사용하지 않는다.

Pilot Work Expression은 다음 8개만 Version 1 ACTIVE로 시작한다.

| Expression Key                    | Exact Tree                                          |
| --------------------------------- | --------------------------------------------------- |
| `COMMUNICATIONS_WORK_ACCESS_V1`   | `APP.COMMUNICATIONS:VIEW`                           |
| `SERVICES_WORK_ACCESS_V1`         | `APP.EMPLOYEE_SERVICES:VIEW`                        |
| `APPROVALS_WORK_ACCESS_V1`        | `APP.APPROVALS:VIEW`                                |
| `HCM_PERSONAL_SURFACE_ACCESS_V1`  | ANY(`APP.HCM:VIEW`,`APP.PEOPLE_DIRECTORY:VIEW`)     |
| `HCM_PERSONAL_CORE_ACCESS_V1`     | `APP.HCM:VIEW`                                      |
| `HCM_DIRECTORY_ACCESS_V1`         | ANY(`APP.HCM:VIEW`,`APP.PEOPLE_DIRECTORY:VIEW`)     |
| `HCM_PERSONAL_SERVICES_ACCESS_V1` | ALL(`APP.HCM:VIEW`,`APP.EMPLOYEE_SERVICES:VIEW`)    |
| `HCM_TEAM_PRODUCT_ACCESS_V1`      | ANY(`APP.HCM:VIEW`,`APP.WORKFORCE_MANAGEMENT:VIEW`) |

각 행의 Owner는 해당 Product + Security, `policyVersion=1`, `lifecycleState=ACTIVE`다. 다른
`APP.*` Leaf를 이름 유사성으로 추가하지 않는다.

### Capability Authority Mode

| Mode                          | 허용식                                                           | 사례                         |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| `PERMISSION`                  | Exact Permission                                                 | 제품 운영 개요 조회          |
| `PERMISSION_AND_RELATIONSHIP` | Exact Permission AND Resource 관계                               | Scoped App Access Fulfilment |
| `PERMISSION_OR_RELATIONSHIP`  | 별도 승인된 조회 Route에서만 제한적 OR, 결과는 서버 Scope Filter | Read-only Resource Summary   |

위임형 Product Management는 기본적으로 활성 Responsibility/Resource Set과 Exact Capability를
모두 요구한다. 예외는 Descriptor의 `NOT_REQUIRED` 또는 만료·Owner·Allowlist가 있는
`LEGACY_OVERSIGHT`만 허용한다. Responsibility만으로 Action을 만들지 않고 Capability만으로 Scope를
넓히지 않는다. 순수 `RELATIONSHIP`과 `SUPPORT_SESSION`은 Governed Access Policy로 평가하며
Responsibility를 가장하지 않는다.

Named Reviewer Relationship은 `/work/queue`의 Assigned Work만 허용하며 `/admin` Campaign
Dashboard나 Tenant Navigation을 열지 않는다.

## 4. ProductSurfaceGuard Truth Table

| 주체 상태                             | `APP.X` |    Exact Capability | Responsibility 규칙 | Scope | `requiresProductEntitlement` | 결과                             |
| ------------------------------------- | ------: | ------------------: | ------------------- | ----: | ---------------------------: | -------------------------------- |
| 미인증                                |    무관 |                무관 | 무관                |  무관 |                         무관 | 401                              |
| 일반 구성원                           |   Allow |                없음 | 무관                |  없음 |                         무관 | Work Allow, Management 403       |
| Tenant Admin Role만                   |  정책값 |                없음 | 없음                |  없음 |                         무관 | `/admin`만, Management 403       |
| 승인된 Legacy Oversight               |    무관 |      Allowlist VIEW | `LEGACY_OVERSIGHT`  | Match |                        false | Allowlist Route/API/Field Read만 |
| Product Admin, Work Entitlement 없음  |    Deny |               Allow | REQUIRED 충족       | Match |                        false | Management Allow, Work 403       |
| 위와 동일                             |    Deny |               Allow | REQUIRED 충족       | Match |                         true | Management 403                   |
| Permission만, Descriptor REQUIRED     |    무관 |               Allow | Responsibility 없음 | Match |                        false | Management 403                   |
| Permission만, Descriptor NOT_REQUIRED |    무관 |               Allow | 예외 명시           | Match |                        false | 해당 Exact Capability만 Allow    |
| App A Admin                           |    무관 |               Allow | App A만 충족        | App A |                         무관 | App A Allow, App B Deny          |
| Responsibility만 있음                 |    무관 |                없음 | Match               | Match |                         무관 | Relationship 전용 외 403         |
| JIT/Step-up 미활성·만료               |    무관 |               Allow | 정책값              | Match |                         무관 | Typed Decision, Product API 403  |
| Provider, Support Session 없음        |    무관 |                무관 | 무관                |  무관 |                         무관 | Tenant/Product 403               |
| Provider + Active Support             |    무관 | 일반 권한 합산 금지 | `SUPPORT_SESSION`   | Exact |                         무관 | 승인 Route/API만 Allow           |

Product Root의 `AppRouteGuard` 안에 Management Route를 중첩하지 않는다. Work와 Management는
Sibling Branch에서 독립 판단한다. Root는 Work 접근이 있으면 Work, Work가 없고 Management만
있으면 첫 허용 Management Child, 둘 다 없으면 App Access State다.

## 5. HTTP와 Reason Code

| HTTP | Reason Code                        | 의미                                                        |
| ---- | ---------------------------------- | ----------------------------------------------------------- |
| 401  | `AUTHENTICATION_REQUIRED`          | 유효 Identity 없음                                          |
| 403  | `APP_ENTITLEMENT_REQUIRED`         | 명시적 Work/App 조건 부족                                   |
| 403  | `SURFACE_CAPABILITY_REQUIRED`      | Product Management Capability 부족                          |
| 403  | `ROUTE_CAPABILITY_REQUIRED`        | 해당 Route·Method의 Exact Capability 또는 Policy 부족       |
| 403  | `ASSIGNMENT_EXPIRED`               | Responsibility 또는 Role Assignment 만료                    |
| 403  | `ACTIVATION_REQUIRED`              | Eligible이나 JIT 미활성                                     |
| 403  | `STEP_UP_REQUIRED`                 | Fresh Assurance 부족                                        |
| 403  | `SOD_CONFLICT`                     | Static/Dynamic SoD 충돌                                     |
| 403  | `SUPPORT_SCOPE_REQUIRED`           | 승인 Support Scope 부족                                     |
| 403  | `SCOPE_CONTEXT_EXPIRED`            | 현재 Actor에게 발급됐던 Opaque Scope가 만료·회수            |
| 404  | `RESOURCE_NOT_AVAILABLE`           | 실제 미존재 또는 다른 Tenant·Actor·허용 Scope 밖 Target/Key |
| 409  | `DECISION_REVISION_CONFLICT`       | Composite 인가 Revision 변경                                |
| 409  | `OBJECT_VERSION_CONFLICT`          | Optimistic Version 충돌                                     |
| 409  | `POLICY_LOCKED`                    | 상위 정책이 해당 변경을 잠금                                |
| 409  | `STEP_UP_CHALLENGE_REPLAY`         | 이미 소비된 Challenge/Nonce 재사용                          |
| 409  | `STEP_UP_CHALLENGE_MISMATCH`       | Challenge와 Target·Version·Command·Payload·Revision 불일치  |
| 422  | `JIT_SCOPE_UNSUPPORTED`            | Pilot에서 미지원하는 `ORG_UNIT`, `RESOURCE` JIT Scope       |
| 503  | `AUTHORITY_RESOLUTION_UNAVAILABLE` | Auth/Scope 판단 불가, Fail Closed                           |

다른 Tenant·Actor·Scope 밖 Object와 실제 미존재 Object는 Client에 같은 404 Code를 반환한다.
내부 Audit만 `TARGET_OUTSIDE_SCOPE`와 `RESOURCE_NOT_FOUND`를 구분한다. 현재 Actor에게 이전에
발급됐다는 사실이 이미 알려진 Scope의 만료만 403으로 구분하며 Scope 이름·대상은 응답에
노출하지 않는다.

## 6. Action Implication

v2 Surface는 Registry의 Exact Action Resolver만 사용한다. 현재 Frontend의 전역 `MANAGE`
Fallback은 Legacy Product Compatibility Adapter 안에 격리하고 Product별 Mapping·Shadow Delta가
승인된 뒤 제거한다. Pilot Route가 Legacy Helper를 호출하면 Contract Test를 실패시킨다.

| Exact Action     | `MANAGE`에서 자동 파생         |
| ---------------- | ------------------------------ |
| `VIEW`           | Product Policy가 명시한 경우만 |
| `CREATE`         | 금지                           |
| `UPDATE`         | 금지                           |
| `APPROVE`        | 금지                           |
| `PUBLISH`        | 금지                           |
| `EXECUTE`        | 금지                           |
| `EXPORT`         | 금지                           |
| `LEGAL_HOLD`     | 금지                           |
| `GRANT`/`REVOKE` | 금지                           |

Navigation, Direct Route와 API가 같은 Implication Resolver를 사용해야 한다. `MANAGE`를 직접
요구하는 기존 Endpoint는 그 Route·Method만 명시하고 다른 Action으로 파생하지 않는다.

### 6.1 Technical Canary Exact Contract

Canary도 Surface Flag `111`에서 현재 UI의 Read·Mutation이 고아 Route가 되지 않도록 10 Registry
Seed의 PAGE/ACTION 전부를 투영한다. Work Mutation은 Work Entitlement Policy와 Self/Object
Predicate를 다시 검사한다. Management는 다음 Exact Capability를 사용한다.

| Contract Key                     | Exact Mapping                             | Responsibility / Scope         |
| -------------------------------- | ----------------------------------------- | ------------------------------ |
| `communications.content.read`    | `ADMIN.COMMUNICATIONS:VIEW`               | REQUIRED / `RS_COMMUNICATIONS` |
| `communications.content.create`  | `ADMIN.COMMUNICATIONS:CREATE`             | REQUIRED / `RS_COMMUNICATIONS` |
| `communications.content.update`  | `ADMIN.COMMUNICATIONS:UPDATE`             | REQUIRED / `RS_COMMUNICATIONS` |
| `communications.content.publish` | `ADMIN.COMMUNICATIONS:APPROVE`            | REQUIRED / `RS_COMMUNICATIONS` |
| `communications.content.archive` | `ADMIN.COMMUNICATIONS:MANAGE`, Route 한정 | REQUIRED / `RS_COMMUNICATIONS` |
| `services.catalog.read`          | `ADMIN.SERVICE_CATALOG:VIEW`              | REQUIRED / `RS_SERVICES`       |
| `services.catalog.create`        | `ADMIN.SERVICE_CATALOG:CREATE`            | REQUIRED / `RS_SERVICES`       |
| `services.catalog.update`        | `ADMIN.SERVICE_CATALOG:UPDATE`            | REQUIRED / `RS_SERVICES`       |
| `services.operations.read`       | `ADMIN.SERVICE_OPERATIONS:VIEW`           | REQUIRED / `RS_SERVICES`       |
| `services.operations.update`     | `ADMIN.SERVICE_OPERATIONS:UPDATE`         | REQUIRED / `RS_SERVICES`       |

기존 Services Transition의 POST→`MANAGE` 검사는 Shadow에서만 비교하고 v2 PEP는
`services.operations.update`를 검사한다. Request Transition은 추가로
`predicate.platform.assigned-service-request.v1`과 Object Version을 AND해 현재 Actor에게 할당된
요청만 허용한다. `MANAGE`를 다른 Services Action으로 확장하지 않는다.

| Route Contract                                 | UI Path                         | Public Gateway Binding                                                                                     | Service PEP Binding                                                              | Route Access                                    | NORMAL / SUPPORT 판정                                                                                        |
| ---------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `route.communications.management.content.page` | `/communications/admin/content` | `GET /api/platform/v1/admin/announcements`                                                                 | `GET /v1/admin/announcements`                                                    | Policy `communications.content-route-access.v1` | NORMAL은 `communications.content.read` + `RS_COMMUNICATIONS`; SUPPORT는 승인 Configuration Session Read-only |
| `route.services.management.catalog.page`       | `/services/admin/catalog`       | `GET /api/platform/v1/admin/services/catalog`; `GET /api/platform/v1/services/catalog`                     | `GET /v1/admin/services/catalog`; `GET /v1/services/catalog`                     | Capability `services.catalog.read`              | `RS_SERVICES` / 미지원                                                                                       |
| `route.services.management.operations.page`    | `/services/admin/operations`    | `GET /api/platform/v1/admin/services/requests`; `GET /api/platform/v1/admin/services/requests/{requestId}` | `GET /v1/admin/services/requests`; `GET /v1/admin/services/requests/{requestId}` | Capability `services.operations.read`           | `RS_SERVICES` / 미지원                                                                                       |

`communications.management-entry.v1`과 `communications.content-route-access.v1`은 둘 다
Active Access Mode를 분기하는 Policy다. Support Session은 같은 Context의 NORMAL Capability를
합치지 않으며 모든 Management Mutation Profile은 Support Mode에서 403이다. 기존 `MANAGE` 보유자의 Read
호환이 필요하면 이 세 Route Contract에만 Versioned VIEW Implication을 명시하고 Shadow Delta·Owner
승인을 받아야 하며 다른 Action으로 확장하지 않는다. 전체 Method·Path는 10 Seed가 권위다.

### 6.2 Provider Support Projection 계약

Provider Support Profile은 Full DTO Schema를 재사용하지 않는다. 아래 전용 DTO와 Field Allowlist를
같은 Bundle에 등록하고 모든 Schema는 `schemaVersion=1`, `additionalProperties=false`, Build 시점
OpenAPI Schema Hash를 가진다. 표에 없는 Field는 이름이 같아도 Default-deny다.

| Projection Policy / Response DTO                                        | 허용 Field Path                                                                                                                 |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `communications.support.content.v1` / `CommunicationSupportContentV1`   | `data[]`: `{communicationId,title,lifecycleState,publishAt,expireAt,audienceSummary,acknowledgementRequired,version,updatedAt}` |
| `hcm.support.operations-overview.v1` / `HcmSupportOperationsOverviewV1` | `data`: `{generatedAt,scopeSummary,workerCount,assignmentCount,exceptionCount,healthStates[]}`                                  |
| `hcm.support.workforce-list.v1` / `HcmSupportWorkforceListV1`           | `data[]`: `{personRef,displayName,workerStatus,organizationName,businessTitle,assignmentKey}`                                   |
| `hcm.support.org-summary.v1` / `HcmSupportOrgSummaryV1`                 | `data[]`: `{organizationRef,name,parentOrganizationRef,status,headcount}`                                                       |
| `hcm.support.assignment-list.v1` / `HcmSupportAssignmentListV1`         | `data[]`: `{personRef,displayName,assignmentKey,businessTitle,organizationName,workerStatus}`                                   |

Communication Body·Attachment·Audience Member ID, HCM Email·전화·주소·보상·급여·국가 식별자·원본 오류·
Draft Scenario·Connector·Credential Reference와 Mutation Link는 금지한다. Provider Support는
`route.hcm.operations.person-detail.data` Profile을 갖지 않으므로 개인 상세는 항상 거부한다.

### 6.3 HCM Personal·Directory Projection 계약

Personal/Directory의 Self·Visible-person Route도 전용 Projection을 사용한다.

| Projection Policy / Response DTO                                | 허용 범위                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `hcm.personal.time.v1` / `HcmSelfTimeV1`                        | Actor 본인의 Time Card·Entry·Status·Version·허용 Action만                                  |
| `hcm.personal.absence.v1` / `HcmSelfAbsenceV1`                  | Actor 본인의 Leave Balance·Request·Status·Version만                                        |
| `hcm.personal.benefits.v1` / `HcmSelfBenefitsV1`                | Actor 본인의 Benefit Enrollment·Plan Display Field만                                       |
| `hcm.personal.pay-statement.v1` / `HcmSelfPayStatementV1`       | Actor 본인의 Masked Pay Statement Summary만; 타인·운영 Field 금지                          |
| `hcm.personal.talent.v1` / `HcmSelfTalentV1`                    | Actor 본인의 Goal·Career Item·Status·Version만                                             |
| `hcm.directory.list.v1` / `HcmDirectoryListV1`                  | 공개 Directory Field `{personRef,displayName,businessTitle,organizationName,workLocation}` |
| `hcm.directory.organization.v1` / `HcmDirectoryOrganizationV1`  | 공개 Organization `{organizationRef,name,parentRef,headcount}`                             |
| `hcm.directory.person-detail.v1` / `HcmDirectoryPersonDetailV1` | 해당 Tenant Directory Policy가 Visible로 판정한 공개 Profile Field만                       |

각 “본인” Projection은 Product Service의 Actor↔Person Binding을 다시 확인하고 Client가 보낸
`personId`로 Self를 결정하지 않는다. Directory-only Actor에게 Personal Core Projection을 발급하지
않는다.

## 7. Approvals Capability Matrix

### 7.1 Approvals Work Route Contracts

Surface Entry `approvals.work-access.v1`을 먼저 평가한 뒤 각 Child Route는 아래 Access Union
Member 하나를 별도로 평가한다. Public Binding은 `/api/approvals`, Service PEP Binding은
`serviceKey=approval`의 `/v1`이며 10 Seed가 열거한 양쪽 Method·Path를 각각 저장한다. Prefix나
“동일 Suffix” 문자열은 Registry에 저장하지 않는다.

| Route Contract                                 | UI Path                          | Exact Public Gateway Binding                                                                                                     | Route Access                                                                                              |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `route.approvals.work.home.page`               | `/approvals/home`                | `GET /api/approvals/v1/home`                                                                                                     | Policy `approvals.work-access.v1`                                                                         |
| `route.approvals.work.home-preference.data`    | Home preference data             | `GET /api/platform/v1/home-preferences/surfaces/{surfaceKey}`; fixed `surfaceKey=approval-home`                                  | Policy `approvals.work-access.v1`; Self + Expected Version                                                |
| `route.approvals.work.inbox.page`              | `/approvals/inbox`               | `GET /api/approvals/v1/tasks`                                                                                                    | Capability `approvals.work.task.read`                                                                     |
| `route.approvals.work.completed.page`          | `/approvals/completed`           | `GET /api/approvals/v1/tasks`                                                                                                    | Capability `approvals.work.task.read`                                                                     |
| `route.approvals.work.task-detail.data`        | Inbox/Completed Drawer Data      | `GET /api/approvals/v1/tasks/{taskId}`                                                                                           | Capability `approvals.work.task.read`                                                                     |
| `route.approvals.work.request-new.page`        | `/approvals/requests/new`        | `GET /api/approvals/v1/catalog/forms`                                                                                            | Expression ALL `approvals.work.request.create`, `approvals.work.request.update`                           |
| `route.approvals.work.form-template.data`      | Request Form Template Data       | `GET /api/approvals/v1/catalog/forms/{formId}/template`                                                                          | Expression ALL `approvals.work.request.create`, `approvals.work.request.update`; Published Form Predicate |
| `route.approvals.work.request-drafts.page`     | `/approvals/requests/drafts`     | `GET /api/approvals/v1/requests`                                                                                                 | Capability `approvals.work.request.read`                                                                  |
| `route.approvals.work.request-submitted.page`  | `/approvals/requests/submitted`  | `GET /api/approvals/v1/requests`                                                                                                 | Capability `approvals.work.request.read`                                                                  |
| `route.approvals.work.request-needs-info.page` | `/approvals/requests/needs-info` | `GET /api/approvals/v1/requests`                                                                                                 | Capability `approvals.work.request.read`                                                                  |
| `route.approvals.work.request-archive.page`    | `/approvals/requests/archive`    | `GET /api/approvals/v1/requests`                                                                                                 | Capability `approvals.work.request.read`                                                                  |
| `route.approvals.work.request-detail.data`     | Request Drawer Data              | `GET /api/approvals/v1/requests/{requestId}`; `GET /api/approvals/v1/requests/{requestId}/detail`                                | Capability `approvals.work.request.read`                                                                  |
| `route.approvals.work.delegations.page`        | `/approvals/delegations`         | `GET /api/approvals/v1/delegations`; `GET /api/approvals/v1/delegations/candidates`; `GET /api/approvals/v1/workflows/published` | Expression ANY `approvals.work.delegation.read`, `approvals.work.delegation.manage`                       |

Mutation은 별도 ACTION Route Contract로 `POST /requests`, `PUT /requests/{requestId}/draft`,
home preference update, submit/withdraw/information-response, task claim/decision, delegation
create/revoke를 각 Exact CREATE/UPDATE/APPROVE/MANAGE Contract와 결속한다. PAGE Key를 Mutation
Method에 제출하거나
Action Key를 Browser URL Resolver에서 사용하면 `ROUTE_DENIED`다.

Approvals Work Capability Descriptor는 다음 Exact Mapping을 가진다. 모두
`authorityMode=PERMISSION`, `responsibilityRequirement=NOT_REQUIRED`, `riskTier=LOW`,
Surface Entry `approvals.work-access.v1`과 Object Predicate를 추가로 요구한다.

| Contract Key                       | Exact Mapping                       | Scope Resolver                         |
| ---------------------------------- | ----------------------------------- | -------------------------------------- |
| `approvals.work.task.read`         | `ACTION.APPROVAL_TASK:VIEW`         | Assigned/Candidate/Delegated Task      |
| `approvals.work.task.update`       | `ACTION.APPROVAL_TASK:UPDATE`       | Claimable Task                         |
| `approvals.work.task.approve`      | `ACTION.APPROVAL_TASK:APPROVE`      | Decidable Task + Self-approval SoD     |
| `approvals.work.request.read`      | `ACTION.APPROVAL_REQUEST:VIEW`      | Own Request                            |
| `approvals.work.request.create`    | `ACTION.APPROVAL_REQUEST:CREATE`    | Self + Published Form                  |
| `approvals.work.request.update`    | `ACTION.APPROVAL_REQUEST:UPDATE`    | Own Request + Expected Version         |
| `approvals.work.delegation.read`   | `ACTION.APPROVAL_DELEGATION:VIEW`   | Actor-owned Delegation                 |
| `approvals.work.delegation.manage` | `ACTION.APPROVAL_DELEGATION:MANAGE` | Actor-owned Delegation + Policy Window |

`predicate.approval-task-claimable.v1`은 Task가 PENDING·미할당이고 Actor가 Candidate Role 또는
유효 Delegation에 속할 때만 허용한다. `predicate.approval-task-decision.v1`은 현재 Assignment 또는
유효 Candidate/Delegation과 Object Version을 요구하고 Requester와 Actor가 같으면 Self-approval을
거부한다. UI Role 문자열은 Predicate 입력이 아니다.

| Route·Action                 | Method       | Exact Capability                    | 추가 Predicate                              |
| ---------------------------- | ------------ | ----------------------------------- | ------------------------------------------- |
| Admin Overview               | GET          | `ADMIN.APPROVAL_OPERATIONS:VIEW`    | Bound Scope                                 |
| Workflow/Form Read           | GET          | `ADMIN.APPROVAL_DESIGN:VIEW`        | Bound Scope                                 |
| Workflow/Form Create         | POST         | `ADMIN.APPROVAL_DESIGN:CREATE`      | Expected Version/Idempotency                |
| Workflow/Form Update         | PUT/PATCH    | `ADMIN.APPROVAL_DESIGN:UPDATE`      | Expected Version                            |
| Workflow/Form Publish        | POST command | `ADMIN.APPROVAL_DESIGN:PUBLISH`     | Maker ≠ Publisher, Fresh Step-up            |
| Policy Read                  | GET          | `ADMIN.APPROVAL_POLICY:VIEW`        | Bound Scope                                 |
| Policy Draft Update          | PUT/PATCH    | `ADMIN.APPROVAL_POLICY:UPDATE`      | Expected Version                            |
| Policy Publish               | POST command | `ADMIN.APPROVAL_POLICY:PUBLISH`     | Maker-checker, Fresh Step-up                |
| SLA/Delivery Read            | GET          | `ADMIN.APPROVAL_OPERATIONS:VIEW`    | Bound Scope                                 |
| SLA/Delivery Recovery        | POST command | `ADMIN.APPROVAL_OPERATIONS:EXECUTE` | Event-bound Operator·Originator·Auditor SoD |
| Signature Configuration Read | GET          | `ADMIN.APPROVAL_SIGNATURE:VIEW`     | Secret Masking                              |

Tenant Admin Role만으로 위 Capability를 추론하지 않는다. 기존 Seed에 명시된 VIEW가 있으면
Read-only Oversight로 유지할 수 있으나 Mutation은 전문 역할과 Exact Action을 요구한다.

Approvals Management의 Stable Contract Key→Exact Mapping은 다음과 같다. 모두 Product
Management Scope에서 평가하며 `full-management`의 기본 Responsibility는 REQUIRED다.

| Contract Key                      | Exact Mapping                       | Risk / SoD                             |
| --------------------------------- | ----------------------------------- | -------------------------------------- |
| `approvals.operations.read`       | `ADMIN.APPROVAL_OPERATIONS:VIEW`    | LOW                                    |
| `approvals.design.read`           | `ADMIN.APPROVAL_DESIGN:VIEW`        | LOW                                    |
| `approvals.design.create`         | `ADMIN.APPROVAL_DESIGN:CREATE`      | LOW                                    |
| `approvals.design.update`         | `ADMIN.APPROVAL_DESIGN:UPDATE`      | LOW                                    |
| `approvals.design.publish`        | `ADMIN.APPROVAL_DESIGN:PUBLISH`     | HIGH / `SOD-APR-DESIGN-PUBLISH-V1`     |
| `approvals.policy.read`           | `ADMIN.APPROVAL_POLICY:VIEW`        | LOW                                    |
| `approvals.policy.update`         | `ADMIN.APPROVAL_POLICY:UPDATE`      | LOW                                    |
| `approvals.policy.publish`        | `ADMIN.APPROVAL_POLICY:PUBLISH`     | HIGH / `SOD-APR-POLICY-PUBLISH-V1`     |
| `approvals.operations.execute`    | `ADMIN.APPROVAL_OPERATIONS:EXECUTE` | HIGH / `SOD-APR-OPS-AUDIT-V1`          |
| `approvals.signature.read`        | `ADMIN.APPROVAL_SIGNATURE:VIEW`     | LOW / forced read-only                 |
| `approvals.audit.operations.read` | `ADMIN.APPROVAL_OPERATIONS:VIEW`    | LOW / NOT_REQUIRED, auditor projection |

Legacy Oversight Key는 아래 7.3 Allowlist에서만 정의하며 위 일반 Key와 재사용하지 않는다.

#### 7.1.1 W1a Scoped Specialist Duty Authority

W1a의 Approvals Management Exact Capability는 Global 전문 Role이 아니라 아래 Scoped Duty
Assignment를 Authority Source로 사용한다. 이 표는 Canonical v2 Capability Descriptor의
`contractKey → resolvedCapabilityCode`와 1:1로 검증하며 별도 Wildcard나 `MANAGE` Implication을
허용하지 않는다.

| Duty Code                     | Exact Capability Contract                       | 책임 규칙                              | 충돌 Duty                     |
| ----------------------------- | ----------------------------------------------- | -------------------------------------- | ----------------------------- |
| `APPROVAL_DESIGN_DRAFT`       | `design.read`, `design.create`, `design.update` | 같은 Set `APP_CONFIG_ADMIN` REQUIRED   | `APPROVAL_DESIGN_PUBLISH`     |
| `APPROVAL_DESIGN_PUBLISH`     | `design.read`, `design.publish`                 | 같은 Set `APP_CONFIG_ADMIN` REQUIRED   | `APPROVAL_DESIGN_DRAFT`       |
| `APPROVAL_POLICY_DRAFT`       | `policy.read`, `policy.update`                  | 같은 Set `APP_CONFIG_ADMIN` REQUIRED   | `APPROVAL_POLICY_PUBLISH`     |
| `APPROVAL_POLICY_PUBLISH`     | `policy.read`, `policy.publish`                 | 같은 Set `APP_CONFIG_ADMIN` REQUIRED   | `APPROVAL_POLICY_DRAFT`       |
| `APPROVAL_OPERATIONS_EXECUTE` | `operations.read`, `operations.execute`         | 같은 Set `APP_CONFIG_ADMIN` REQUIRED   | `APPROVAL_OPERATIONS_AUDIT`   |
| `APPROVAL_OPERATIONS_AUDIT`   | `audit.operations.read`                         | `NOT_REQUIRED`, 명시적 Audit Exception | `APPROVAL_OPERATIONS_EXECUTE` |
| `APPROVAL_SIGNATURE_READ`     | `signature.read`                                | 같은 Set `APP_CONFIG_ADMIN` REQUIRED   | 없음                          |

표의 축약 Contract는 모두 `approvals.` Prefix를 가진다. Duty-Capability Mapping은 Permission
Catalog FK와 `resourceKey:permissionCode` Generated Column으로 물리화하며 Canonical v2의 11개
Approvals Management Contract, 13개 Duty-Contract Association과 Build에서 Exact Match해야 한다.

Duty Assignment 계약은 다음과 같다.

- Principal은 `USER | GROUP`, Source는 `MANUAL | GROUP | IAM | PROVISIONING | AGENT |
MIGRATION`, Lifecycle은 `PENDING_APPROVAL | ACTIVE | DENIED | REVOKED | EXPIRED`다.
- `resourceSetId`, 선택적 `responsibilityAssignmentId`, `validFrom/validTo`, `reviewDueAt`,
  요청·승인·회수 Evidence, 사유와 Version을 저장한다. 요청자와 승인자는 달라야 하며 승인·회수는
  Expected Version CAS를 사용한다.
- Audit Exception 외 Duty는 `responsibilityAssignmentId`가 가리키는 활성
  `APP_CONFIG_ADMIN`이 같은 Effective User와 같은 Resource Set에 결속되어야 한다. Duty와 책임이
  각각 Direct/Group이어도 이 User+Set Intersection이 같으면 허용하고, Principal·Set을 교차 조합하지
  않는다.
- Effective Duty가 합성한 Exact Permission과 `SCOPED_*@<resourceSetKey>` Wire Token은 해당
  Duty·Contract·Resolved Capability·Resource Set Hash에 결속한다. 명시적 Permission `DENY`가
  합성 `ALLOW`보다 우선한다.
- Canonical `RS_APPROVALS`는 Pilot Root-only Set을 허용한다. 동적 Set은
  `APP.APPROVALS` Product Root와 하나 이상의 비-Product Child를 가져야 하며, Scope Key는 Duty의
  실제 Set에서 생성한다.

### 7.2 Approvals Legacy Exact Action Migration

기존 Effective Allow를 Role 이름으로 포괄 복제하지 않고 아래 입증된 Endpoint에만 같은
Scope·Validity로 Mapping한다. Shadow Delta와 Product·Security Owner 승인 후 원자적으로
전환한다.

| 기존 Role·Permission                                   | v2 Contract→Exact Action                                        | 호환 범위                                          |
| ------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------- |
| `APPROVAL_DESIGNER`, DESIGN `VIEW`, `CREATE`, `UPDATE` | `approvals.design.read`, `create`, `update` → 동일 Exact Action | 현 Workflow/Form Endpoint 동작 보존                |
| `APPROVAL_PUBLISHER`, DESIGN `APPROVE`                 | `approvals.design.publish` → `PUBLISH`                          | Workflow/Form `/publish`만                         |
| `APPROVAL_PUBLISHER`, POLICY `APPROVE`                 | `approvals.policy.publish` → `PUBLISH`                          | Policy `/publish`만                                |
| `APPROVAL_PUBLISHER`, POLICY `MANAGE`                  | `approvals.policy.update` → `UPDATE`                            | `PUT /v1/admin/policies/{id}`만; Publish 추론 금지 |
| `APPROVAL_OPERATOR`, OPERATIONS `MANAGE`               | `approvals.operations.execute` → `EXECUTE`                      | `POST /v1/admin/operations/events/{id}/retry`만    |
| `APPROVAL_OPERATOR`, OPERATIONS `UPDATE`               | Mapping 없음                                                    | 현 PEP에서 사용되지 않음을 Shadow로 확인 후 Retire |
| 모든 나머지 Legacy `MANAGE` Fallback                   | Mapping 없음                                                    | v2 Route/API Deny                                  |

현재 Signature Admin API는 GET만 존재하므로 Pilot이 신규 Update·Secret Rotation을 추가하지
않는다. 후속 Endpoint는 별도 기능 설계·Risk Policy·Exact Action 승인 후 추가한다.

전환 중 Global 전문 Role Conflict Policy를 즉시 Retire하지 않는다. 000/100 Compatibility 경로는
기존 Role/Permission Allow와 Exact Scoped Duty Token을 모두 인식하되 Scoped Token의 한 Contract를
다른 Duty로 확대하지 않는다. 110/111 신규 PEP는 Scoped Duty와 Canonical Exact Mapping을
필수로 하고 Global Role/Permission만 있는 사용자를 거부한다. Scoped Duty는 Global Role을 요구하지
않으므로 서로 겹치지 않는 Designer/Publisher 또는 Operator/Auditor Set은 Global Conflict의
False Deny 없이 공존할 수 있다. Legacy Fallback 제거와 110→000 Rollback Rehearsal이 끝난 별도
Forward Migration에서만 Global Conflict Retirement를 검토한다.

### 7.3 Tenant Admin Legacy Oversight Allowlist

Pilot은 기존 Seed의 명시적 Tenant Admin Product `VIEW`를 전부 자동 상속하지 않고
다음 Read-only Allowlist만 `LEGACY_OVERSIGHT`로 유지한다. 모든 항목의 Owner는
`Approvals + Security`, Sunset은 `2027-02-28T14:59:59Z`이며 변경은 새 Policy Version을
요구한다.

| Route Contract                                        | 정확한 Service PEP Method·Path                                                         | Legacy Oversight Capability Contract  | Field Mask Policy                           | Scope                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------- | ----------------------------- |
| `route.approvals.admin.overview.page`                 | `GET /v1/admin/overview`                                                               | `approvals.oversight.overview.read`   | `approvals.oversight.summary.v1`            | Current Tenant `RS_APPROVALS` |
| `route.approvals.admin.workflows.page`                | `GET /v1/admin/workflows`, `GET /v1/admin/workflows/{workflowId}`                      | `approvals.oversight.design.read`     | `approvals.oversight.workflow-metadata.v1`  | Current Tenant `RS_APPROVALS` |
| `route.approvals.admin.forms.page`                    | `GET /v1/admin/forms`, `GET /v1/admin/forms/{formId}`, `GET /v1/admin/form-categories` | `approvals.oversight.design.read`     | `approvals.oversight.form-metadata.v1`      | Current Tenant `RS_APPROVALS` |
| `route.approvals.admin.forms-workflow-reference.data` | `GET /v1/admin/workflows`, `GET /v1/admin/workflows/{workflowId}`                      | `approvals.oversight.design.read`     | `approvals.oversight.workflow-metadata.v1`  | Current Tenant `RS_APPROVALS` |
| `route.approvals.admin.policies.page`                 | `GET /v1/admin/policies`, `GET /v1/admin/policies/{policyId}/versions`                 | `approvals.oversight.policy.read`     | `approvals.oversight.policy-metadata.v1`    | Current Tenant `RS_APPROVALS` |
| `route.approvals.admin.operations.page`               | `GET /v1/admin/operations`                                                             | `approvals.oversight.operations.read` | `approvals.oversight.operations.v1`         | Current Tenant `RS_APPROVALS` |
| `route.approvals.admin.signatures.page`               | `GET /v1/admin/signatures`                                                             | `approvals.oversight.signature.read`  | `approvals.oversight.signature-metadata.v1` | Current Tenant `RS_APPROVALS` |

`/**` 또는 Controller Prefix만으로 호환을 열지 않는다. 위에 없는 신규 GET Child Route는
Legacy Oversight에서 기본 403이며 새 Registry Version 승인 전에 자동 포함되지 않는다.

위 일곱 Oversight Contract Key는 각각 같은 Product Exact VIEW Code에 Mapping하더라도
`LEGACY_OVERSIGHT` Requirement·Field Mask·Sunset을 가진 별도 Descriptor다. 일반
`approvals.design|policy|operations|signature.read`와 Key를 재사용하지 않는다. Page Route
Access는 다음 서버 선택형 Profile로 고정한다.

| Route                    | Profile / Precedence     | Required Access                       | Projection / Read-only                             |
| ------------------------ | ------------------------ | ------------------------------------- | -------------------------------------------------- |
| Overview                 | `full-management` / 300  | `approvals.operations.read`           | Full Admin DTO / false                             |
| Overview                 | `legacy-oversight` / 100 | `approvals.oversight.overview.read`   | `approvals.oversight.summary.v1` / true            |
| Workflows                | `full-management` / 300  | `approvals.design.read`               | Full Workflow Admin DTO / false                    |
| Workflows                | `legacy-oversight` / 100 | `approvals.oversight.design.read`     | `approvals.oversight.workflow-metadata.v1` / true  |
| Forms                    | `full-management` / 300  | `approvals.design.read`               | Full Form Admin DTO / false                        |
| Forms                    | `legacy-oversight` / 100 | `approvals.oversight.design.read`     | `approvals.oversight.form-metadata.v1` / true      |
| Forms workflow reference | `full-management` / 300  | `approvals.design.read`               | Full Workflow Admin DTO / false                    |
| Forms workflow reference | `legacy-oversight` / 100 | `approvals.oversight.design.read`     | `approvals.oversight.workflow-metadata.v1` / true  |
| Policies                 | `full-management` / 300  | `approvals.policy.read`               | Full Policy Admin DTO / false                      |
| Policies                 | `legacy-oversight` / 100 | `approvals.oversight.policy.read`     | `approvals.oversight.policy-metadata.v1` / true    |
| Operations               | `full-management` / 300  | `approvals.operations.read`           | Full Operations DTO / false                        |
| Operations               | `auditor` / 200          | `approvals.audit.operations.read`     | `approvals.audit.operations.v1` / true             |
| Operations               | `legacy-oversight` / 100 | `approvals.oversight.operations.read` | `approvals.oversight.operations.v1` / true         |
| Signatures               | `full-management` / 300  | `approvals.signature.read`            | Full masked Signature Admin DTO / true             |
| Signatures               | `legacy-oversight` / 100 | `approvals.oversight.signature.read`  | `approvals.oversight.signature-metadata.v1` / true |

Access Profile은 Client 입력이 아니다. 같은 Actor가 여러 Profile을 충족하면 서버가 위 고유
Precedence로 하나를 선택한다. `auditor`는 Operations Page·GET만 허용하며 Overview, Workflow,
Form, Policy, Signature와 모든 Mutation은 거부한다.
Profile `readOnly=true`는 강제 Read-only다. `false`여도 최종 Context/Scope `readOnly`는 현재
유효한 Mutation Grant가 없으면 반드시 true이며 Profile 값만으로 Write를 만들지 않는다.

Field Mask는 기존 Domain DTO를 응답 후 임의로 숨기는 방식이 아니라 다음 전용
Projection DTO를 직렬화한다. 표기 `data[]` 및 `data.items[]`는 OpenAPI Schema의 배열
세그먼트이며 임의 이름 Wildcard가 아니다. 등록되지 않은 필드는 필드명이 비슷해도
Default-deny다.

| Mask / Projection DTO                                    | 허용 Schema Field Path                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `summary.v1` / `ApprovalOversightAdminPulseV1`           | `data.publishedWorkflows`, `data.draftWorkflows`, `data.activeRequests`, `data.overdueTasks`, `data.failedIntegrations`, `data.assurance[].key`, `data.assurance[].state`, `data.assurance[].exceptions`                                                                                                                                                                                |
| `workflow-metadata.v1` / `ApprovalOversightWorkflowV1`   | List `data[]`, Detail `data`: `{workflowId, workflowKey, nameKo, nameEn, category, dataClassification, lifecycleState, currentVersion, slaMinutes, version, updatedAt}`만 허용                                                                                                                                                                                                          |
| `form-metadata.v1` / `ApprovalOversightFormV1`           | Form List `data[]`, Detail `data`: `{formId, formKey, categoryId, categoryKey, categoryNameKo, categoryNameEn, nameKo, nameEn, formKind, lifecycleState, currentVersion, fieldCount, routeCount, usageCount, version, updatedAt}`; Category List `data[]`: `{categoryId, categoryKey, parentCategoryId, nameKo, nameEn, iconKey, sortOrder, lifecycleState, formCount, version}`만 허용 |
| `policy-metadata.v1` / `ApprovalOversightPolicyV1`       | Policy List `data[]`: `{policyId, policyKey, nameKo, nameEn, policyType, enforcementMode, severity, lifecycleState, version, pendingReview, pendingEnforcementMode, pendingSeverity, pendingLifecycleState, pendingAt}`; Version List `data[]`: `{policyVersionId, versionNumber, enforcementMode, severity, lifecycleState, submittedAt, publishedAt}`만 허용                          |
| `operations.v1` / `ApprovalOversightOperationsV1`        | `data`: `{generatedAt}`; `data.signals[]`: `{key, state, titleKo, titleEn, count}`; `data.integrationDeliveries[]`: `{outboxId, eventType, status, attemptCount, manualRetryCount, availableAt, publishedAt, createdAt, lastRetriedAt}`만 허용                                                                                                                                          |
| `audit.operations.v1` / `ApprovalAuditorOperationsV1`    | `data`: `{generatedAt}`; `data.signals[]`: `{key, state, count}`; `data.integrationDeliveries[]`: `{eventType, status, attemptCount, manualRetryCount, availableAt, publishedAt}`만 허용; Object ID·오류 원문·Mutation Link 금지                                                                                                                                                        |
| `signature-metadata.v1` / `ApprovalOversightSignatureV1` | `data[]`: `{providerId, providerKey, displayName, providerType, lifecycleState, credentialConfigured, lastHealthCheckedAt, version}`만 허용                                                                                                                                                                                                                                             |

각 Projection은 `schemaVersion=1`, Build에서 생성한 OpenAPI Schema Hash와 `additionalProperties=false`를
Registry에 보존한다. Domain DTO에 필드가 추가되어도 Projection과 Hash가 같은 변경에서
승인되지 않으면 노출되지 않는다. `definition`, `schema`, `routeDefinition`, `rule`,
`pendingRule`, `changeReason`, `reviewComment`, `ownerGroupRef`, `requestId`, `lastError`,
`capabilities`, 결재 본문·요청자·결재자·첨부·Comment·Credential/Secret Reference는 모두
금지다. Mutation·Export·Secret은 항상 Deny다. 전용 Projection·Schema Hash·Field
Contract Test가 준비되지 않으면 `LEGACY_OVERSIGHT` Grant는 `DISABLED`로 시작한다.

## 8. HCM Capability Matrix

| Contract/Policy Key                                                        | Route·Action                       | Method          | Exact Capability/Policy                                     | Scope·Predicate                                   |
| -------------------------------------------------------------------------- | ---------------------------------- | --------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| `hcm.personal-access.v1`                                                   | Personal Surface Entry             | Evaluate        | Personal Entry Policy                                       | Self Person; Child Grant 생성 금지                |
| `hcm.personal-core-access.v1`                                              | Home/Me/HR Domain Read·Self Action | GET/PUT/POST    | `APP.HCM:VIEW` + Self Relationship                          | Self Person/Object + Field Mask/Version           |
| `hcm.directory-access.v1`                                                  | Directory/Organization Read        | GET             | ANY `APP.HCM:VIEW`, `APP.PEOPLE_DIRECTORY:VIEW`             | Visible Person + Directory Field Mask             |
| `hcm.personal-services-access.v1`                                          | HR Services Read                   | GET             | ALL `APP.HCM:VIEW`, `APP.EMPLOYEE_SERVICES:VIEW`            | Self + Service Request Field Mask                 |
| `hcm.team.{domain}.read`                                                   | Team Time/Absence Read             | GET             | `DATA.HR_{DOMAIN}:VIEW`                                     | Reporting/Delegation AND Target Population        |
| `hcm.team.{domain}.approve`                                                | Team Time/Absence Decision         | POST command    | `DATA.HR_{DOMAIN}:APPROVE`                                  | Reporting/Delegation AND Target Population        |
| `hcm.operations-overview-read.v1`                                          | Operations Overview                | GET             | `DATA.WORKFORCE:VIEW` 또는 `SUPPORT_SESSION` Policy         | Target Population; Support Read-only              |
| `hcm.operations-workforce-read.v1`                                         | Workforce People/Assignments Read  | GET             | `DATA.WORKFORCE:VIEW` 또는 `SUPPORT_SESSION` Policy         | Workforce Target Population; Support Read-only    |
| `hcm.operations.{domain}.read`                                             | Domain Operations Read             | GET             | `DATA.HR_{DOMAIN}:VIEW`                                     | Domain + Target Population                        |
| `hcm.operations.{domain}.approve`                                          | Domain Decision                    | POST command    | `DATA.HR_{DOMAIN}:APPROVE`                                  | Domain + Target Population                        |
| `hcm.org-design.read`                                                      | Organization Design Read           | GET             | `ACTION.WORKFORCE_ORG_DESIGN:VIEW`                          | Configuration Scope                               |
| `hcm.org-design.create`, `hcm.org-design.update`                           | Organization Design Create/Update  | POST/DELETE     | `ACTION.WORKFORCE_ORG_DESIGN:CREATE`, `UPDATE`              | Expected Version                                  |
| `hcm.org-design.approve`                                                   | Organization Design Approval       | POST command    | `ACTION.WORKFORCE_ORG_DESIGN:APPROVE`                       | Approver ≠ Maker + Expected Version               |
| `hcm.org-design.publish`                                                   | Organization Design Publish        | POST command    | `ACTION.WORKFORCE_ORG_DESIGN:PUBLISH`                       | Maker-checker + Step-up                           |
| `hcm.reference.read`, `hcm.reference.update`                               | Reference Data Read/Update         | GET/PUT         | `ACTION.WORKFORCE_REFERENCE:VIEW`, `UPDATE`                 | Configuration Scope + Version                     |
| `hcm.reference.publish`                                                    | Reference Data Publish             | Post-Pilot 예약 | `ACTION.WORKFORCE_REFERENCE:PUBLISH`                        | Pilot Active Route/Grant 없음                     |
| `hcm.integration.read`, `hcm.integration.create`, `hcm.integration.update` | Integration Read/Create/Update     | GET/POST/PUT    | `ACTION.WORKFORCE_DATA_OPERATIONS:VIEW`, `CREATE`, `UPDATE` | Configuration/Object Scope; Secret Field Deny     |
| `hcm.integration.execute`                                                  | Integration Test                   | POST command    | `ACTION.WORKFORCE_DATA_OPERATIONS:EXECUTE`                  | Step-up if external write                         |
| `hcm.integration.rotate-secret`                                            | Integration Secret Rotation        | Post-Pilot 예약 | `ACTION.WORKFORCE_DATA_OPERATIONS:ROTATE_SECRET`            | 승인 Secret Writer 전 Active Row 없음             |
| `hcm.controlled-export.read`                                               | Controlled Export Page Read        | GET             | `ACTION.WORKFORCE_CONTROLLED_EXPORT:VIEW`                   | Export Scope Summary, no row data                 |
| `hcm.controlled-export.preview`                                            | Controlled Export Preview          | POST DATA       | `ACTION.WORKFORCE_CONTROLLED_EXPORT:VIEW`                   | Side-effect-free Business Query + masked response |
| `hcm.controlled-export.create`                                             | Controlled Export Create           | POST            | `ACTION.WORKFORCE_CONTROLLED_EXPORT:EXPORT`                 | Export Population + CRITICAL Step-up              |
| `hcm.controlled-export.cancel`                                             | Controlled Export Cancel           | PATCH           | `ACTION.WORKFORCE_CONTROLLED_EXPORT:EXPORT`                 | Object + Expected Version                         |
| `hcm.controlled-export.retry`                                              | Controlled Export Retry            | PATCH           | `ACTION.WORKFORCE_CONTROLLED_EXPORT:EXPORT`                 | Object + CRITICAL Step-up                         |

`{domain}`은 Runtime Wildcard가 아니다. Pilot Registry 생성 시 Team은 `time`, `absence`,
Operations Read는 `time`, `absence`, `benefits`, `pay`, `talent`, Decision은 Pilot에 실제 Route가
있는 `time`, `absence`만 별도 불변 Contract Key로
확장한다. Team과 Operations가 같은 Exact Permission을 Resolve하더라도 Contract Key·Surface·
Target Predicate를 공유하지 않는다.

`hcm.operations.{domain}.update`는 Pilot Active Descriptor가 아니다. 실제 Remediation UI·API가
추가되는 Wave에서 Exact Route/Method·Fixture와 함께 새 Bundle Version으로 등록한다.

Brace 표기는 문서 압축용이며 Canonical Registry에는 다음 Exact Key·Code를 각각 물리화한다.

| Stable Contract Key              | Exact Mapping             |
| -------------------------------- | ------------------------- |
| `hcm.team.time.read`             | `DATA.HR_TIME:VIEW`       |
| `hcm.team.time.approve`          | `DATA.HR_TIME:APPROVE`    |
| `hcm.team.absence.read`          | `DATA.HR_ABSENCE:VIEW`    |
| `hcm.team.absence.approve`       | `DATA.HR_ABSENCE:APPROVE` |
| `hcm.operations.workforce.read`  | `DATA.WORKFORCE:VIEW`     |
| `hcm.operations.time.read`       | `DATA.HR_TIME:VIEW`       |
| `hcm.operations.time.approve`    | `DATA.HR_TIME:APPROVE`    |
| `hcm.operations.absence.read`    | `DATA.HR_ABSENCE:VIEW`    |
| `hcm.operations.absence.approve` | `DATA.HR_ABSENCE:APPROVE` |
| `hcm.operations.benefits.read`   | `DATA.HR_BENEFITS:VIEW`   |
| `hcm.operations.pay.read`        | `DATA.HR_PAY:VIEW`        |
| `hcm.operations.talent.read`     | `DATA.HR_TALENT:VIEW`     |

각 Team Key는 `PERMISSION_AND_RELATIONSHIP`, 각 Operations Key는 `PERMISSION`이다. 이름이 비슷한
Team/Operations Key를 합치지 않는다.

Responsibility Requirement는 다음처럼 고정한다. `hcm.org-design.*`, `hcm.reference.*`,
`hcm.integration.*`은 `REQUIRED APP_CONFIG_ADMIN@RS_HCM_CONFIG`와 해당 Configuration/Resource
Scope를 AND한다. `hcm.operations.*`는 `NOT_REQUIRED`이지만 Product Service Target Population을
반드시 요구한다. `hcm.controlled-export.*`도 `NOT_REQUIRED`이며 승인 Export Population·Dataset
Version·Field Mask가 Scope를 대신 좁힌다. Tenant Admin Role이나 `DATA.WORKFORCE:MANAGE`를 이
Responsibility·Scope의 대체 증거로 사용하지 않는다.

Operations Overview와 Workforce 조회 Route는 각각
`hcm.operations-overview-read.v1`, `hcm.operations-workforce-read.v1` Policy로 NORMAL에서
`hcm.operations.workforce.read`, Support Mode에서 승인 `WORKFORCE_READ` Session을 평가한다.
둘을 같은 Grant로 합치거나 Support를 인공 Capability로 변환하지 않는다.

Pilot 전 `DATA.WORKFORCE:MANAGE`를 Export나 다른 Action의 대체 권한으로 사용하지 않는다.
Controlled Export는 감사·Watermark·사유·Fresh Step-up을 함께 요구한다.

`WORKFORCE_READ` Support는 Operations Read-only만 허용한다. Organization Design, 기준정보,
연계 변경과 Export를 열지 않는다.

## 9. JIT·Step-up·SoD

### 9.1 Pilot Step-up Policy Registry

| Policy ID                 | requiredAcr       | maxAuthAgeSeconds | activationTtlSeconds | Challenge                                                                                                                  |
| ------------------------- | ----------------- | ----------------: | -------------------: | -------------------------------------------------------------------------------------------------------------------------- |
| `STEPUP-MGMT-HIGH-V1`     | `urn:dwp:acr:mfa` |               600 |                  900 | Actor·Tenant·Risk Policy·Capability·Scope·Target·Object Version·Canonical Command Digest·Decision Revision 결속, Nonce 1회 |
| `STEPUP-MGMT-CRITICAL-V1` | `urn:dwp:acr:mfa` |               300 |                  300 | 위 결속 + 항상 Single-use, 재사용 409                                                                                      |

- `HIGH`: Approvals Workflow/Form·Policy Publish, Delivery Retry, HCM Org Publish,
  외부 Write를 발생시키는 Integration Execute
- `CRITICAL`: Controlled Export. Integration Secret Rotation은 승인 Secret Writer가 없어 Post-Pilot
  미등록 예약
- Routine Read와 Draft·일반 Update는 Step-up을 자동 요구하지 않지만 Exact Action,
  Object Version, 사유와 Audit를 유지한다.

Challenge는 `auth_time` 또는 동등 Freshness Evidence를 평가하고 MFA `amr` 존재만으로
통과하지 않는다. Auth는 Challenge ID, Nonce, Actor, Tenant, Risk Policy, Capability,
Scope, Target Type·ID, Expected Object Version, Canonical Public Command Key·Method·Path,
Idempotency Key, Canonicalized Payload Digest, Decision Revision, Issuer와 Audience를 서명한다.

IdP `accepted AMR`는 exact lowercase closed mapping이다. Auth는 실제 AMR이 이 Allowlist의
Subset이고 `pwd+otp`, `hwk`, `webauthn`, `fido`, `fido2` 또는 명시 `mfa` 중 하나를
충족할 때만 원본 Token을 보존한 Canonical AMR에 `mfa`를 추가하고
Session을 `OIDC_STEP_UP` Provenance로 표시한다. `pwd` Only·미지·대소문자 변형·중복은
거부한다. 명시된 조합을 완성할 수 없는 Provider는 Production Readiness에서
거부한다. 일반 Login이 저장한 원본 AMR은 literal `mfa`를 포함해도 Step-up으로
승격하지 않고, `OIDC_STEP_UP` Provenance + Canonical `mfa`가 모두 있을 때만
Challenge를 서명한다. 나머지는 재인증 Continuation을 요구한다.

Approval과 People Service는 각자 `(challenge_id, nonce)` Unique Replay Ledger를 소유하고,
검증된 Ledger Insert와 Domain Mutation을 같은 Local Transaction으로 Commit한다. Auth DB와
Product DB의 분산 Transaction은 요구하지 않는다. Audience는 정확한 Product Service와
Command Contract에 결속한다. Target·Version·Method·Path·Capability·Payload·Decision Revision
중 하나라도 바뀌면 409 `STEP_UP_CHALLENGE_MISMATCH`이며 Ledger/Domain Row를 만들지 않는다.
TTL은 기반 Assignment·Support Session 만료를 넘지 못한다. Signature/JWK·Challenge Resolver
장애는 503 Fail Closed, Local Ledger Unique 충돌과 소비 Nonce 재사용은 409다.

### 9.2 Pilot SoD Policy Registry

| Policy ID                   | Phase                 | Bound Conflict                                                                                                                                                        |
| --------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOD-APR-DESIGN-PUBLISH-V1` | ASSIGNMENT + MUTATION | Assignment: 겹치는 Resource Set의 Design Draft/Publish Pair 금지; Mutation: 같은 Version의 `makerId != publisherId`                                                   |
| `SOD-APR-POLICY-PUBLISH-V1` | ASSIGNMENT + MUTATION | Assignment: 겹치는 Policy Scope의 Draft/Publish Pair 금지; Mutation: 같은 Version의 `makerId != publisherId`                                                          |
| `SOD-APR-OPS-AUDIT-V1`      | ASSIGNMENT + MUTATION | Assignment: 겹치는 Resource Set의 Operator/Auditor Pair 금지; Mutation: 정확한 Outbox Event의 `operatorId != eventOriginatorId` AND `operatorId != assignedAuditorId` |
| `SOD-HCM-ORG-APPROVAL-V1`   | MUTATION              | 같은 Config Scope·Organization Version의 `approverId != makerId`                                                                                                      |
| `SOD-HCM-ORG-PUBLISH-V1`    | MUTATION              | 같은 Config Scope·Organization Version의 `makerId != publisherId`                                                                                                     |

Static Assignment Predicate는 Event가 아닌 겹치는 Resource Set의 Responsibility Pair를
판정한다. Dynamic Mutation Predicate는 이미 존재하는 Object/Event ID·Version과 당사자 ID를
같은 승인 Policy Version에서 판정한다. 각 Phase는 독립 Predicate Key와 Evidence Schema를
가지고 Audit에 Policy ID·Phase·Version을 남긴다. Scope·Object가 겹치지 않으면 Tenant 전체
Role 이름만으로 충돌을 만들지 않는다.

Approvals Static Overlap은 다음 총함수로 고정한다.

```text
OVERLAP(left, right) =
  left.resourceSetId == right.resourceSetId
  OR EXISTS active shared non-product child(resourceType, resourceKey)
```

서로 다른 Set의 공통 `APP.APPROVALS` Product Root만으로는 Overlap이 아니다. 충돌 Duty의 유효
시간창도 겹쳐야 하며 Direct Assignment, Group Assignment와 서로 다른 Group Membership을 동일
Effective User 기준으로 펼친 뒤 판정한다. Assignment·Resource Set Member·Group Member·User/Group/
Resource Set 상태·Conflict Policy의 INSERT/UPDATE/DELETE는 Tenant Advisory Lock과 Deferred DB
Constraint 아래 재검사하고 새 충돌을 만드는 Transaction을 `SOD_CONFLICT`로 거부한다.

Recovery Auditor Resolver는 Event `RS_APPROVALS`와 위 규칙으로 겹치는
`APPROVAL_OPERATIONS_AUDIT`만 후보로 삼고 Originator와 해당 Audit Scope에 겹치는
`APPROVAL_OPERATIONS_EXECUTE` 보유자를 제외한다. Audit과 Operator Evidence는 각각
`approvals.audit.operations.read → ADMIN.APPROVAL_OPERATIONS:VIEW`,
`approvals.operations.execute → ADMIN.APPROVAL_OPERATIONS:EXECUTE`와 Exact Match해야 한다.
Audit Duty 자체가 Authority Source이므로 Global `AUDITOR` Role·Global `ALLOW`는 요구하지 않지만,
동일 Resource Permission의 명시적 `DENY`, Evidence Revision Drift, 후보 부재는 503
`AUTHORITY_RESOLUTION_UNAVAILABLE`로 Fail Closed한다.

`SOD-HCM-REFERENCE-PUBLISH-V1`은 Reference Draft/Publish Lifecycle이 별도 기능 ADR로 승인될 때
처음 제안하는 Post-Pilot 예약 Symbol이며 Pilot Registry Row·Grant·Fixture에는 존재하지 않는다.

### 9.3 JIT Scope

- 단기 JIT는 `TENANT` Scope만 지원한다. `ORG_UNIT`과 `RESOURCE` JIT는 Scope-aware PEP가 완성될
  때까지 HTTP 422 `JIT_SCOPE_UNSUPPORTED`로 Request·Grant Record 생성 전에 거부하고
  Denied Audit만 남긴다.
- App Scope는 기존 Responsibility + Resource Set + Validity를 사용한다.
- 정책 누락·Resolver 장애는 Fail Closed한다.

## 10. Gateway와 Service PEP

1. Gateway는 Client의 모든 `X-DWP-*` Identity·Permission·Scope Header를 제거한다.
2. OpenAPI의 `contextScopeKey`를 Actor·Product·Surface와 대조하고 Scope-aware 정규화 Grant
   Reference 또는 동등한 Trusted Context를 재생성한다.
3. Gateway와 Service는 모든 Governed Request에서 최신 Decision Revision·Validity를 확인한다.
4. State-changing Request는 `expectedDecisionRevision`을 요구하고 Domain Mutation 전에 불일치
   409를 반환한다.
5. Gateway는 Route/Method에 대응하는 Exact Capability를 검사한다.
6. Product Service는 Tenant, Target Scope, Object Relationship, Field Mask와 State를 다시 검사한다.
7. Governed Response는 최신 Decision Revision을 공통 Envelope/Metadata로 반환하고 HTTP Context는 Shared
   Cache에 저장하지 않는다.
8. Revocation Event는 Auth·Gateway·Frontend Cache를 `tenant+actor+accessMode`로 무효화한다.
9. Denial도 Stable Reason Code와 Correlation ID로 Audit한다.
10. Auth 또는 Scope Resolver 장애·Invalidation 전달 실패 때 Cached Allow로 진행하지 않는다.
11. Support Session 중 NORMAL Write를 합산하지 않는다.
12. 퇴역 `ADMIN.DWAION` 같은 Aggregate Capability를 Frontend, Gateway, Service, Agent PEP 어디서도
    다시 허용하지 않는다.

## 11. Cross-repository Contract Test

- Frontend Surface·Navigation의 Capability Contract Key가 Registry에 존재한다.
- Registry의 Active Capability가 Gateway Route/Method 또는 관계 전용 Resolver에 연결된다.
- Gateway Mapping의 Capability가 Service PEP에서 재검사된다.
- Retired Capability는 모든 Projection에서 제거된다.
- OpenAPI Error Reason Code와 Frontend `SurfaceAccessState`가 일치한다.
- Product별 Work Entitlement AND 여부가 Manifest와 Backend Policy에서 동일하다.
- Permission Payload가 비어 있으면 신규 Product는 Fail Closed한다.
- Responsibility A + Capability B + Scope C의 교차 조합이 거부된다.
- Flag On/Off가 같은 Effective Context·Guard·PEP Authorization Decision을 낸다.
- Support와 NORMAL 권한을 동시에 가진 Fixture에서도 Support Context가 NORMAL Write를 합치지 않는다.
- Named Reviewer Relationship만으로 `/admin/**` 어느 Route도 열리지 않는다.
- 미지원 Scoped JIT 거부 후 Request·Grant Row는 0이고 Denied Audit만 1건이다.
- Scope 밖 Target과 실제 미존재 Target은 Client에 같은 404 Code를 반환한다.
