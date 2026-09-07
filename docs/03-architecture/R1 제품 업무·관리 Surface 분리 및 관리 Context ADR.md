# R1 제품 업무·관리 Surface 분리 및 관리 Context ADR

- 상태: 승인 완료 (`accepted`), Production 활성화는 §14 Gate 적용
- 최종 기술 검증일: 2026-08-27
- 구현 Frontend Branch: `dwp-dev`
- 구현 Backend Branch: `dwp-dev`
- 적용 범위: DWP Global Shell, 모든 Business App, Tenant Control Center, Provider Support,
  Auth, Gateway와 제품별 관리 API
- 결정 Owner: Shared Experience Platform, Identity & Access, 각 Product Owner

## 1. 결정 요약

DWP는 **같은 계정 안에서 업무와 관리를 수행하되, 같은 Navigation 문맥에는 섞지 않는다.**
Work 접근이 있는 사용자는 앱에 들어오면 관리 권한 보유 여부와 무관하게 업무 Surface를
기본으로 사용한다. Work가 없고 Management만 가능한 사용자는 첫 허용 관리 Route로 진입한다.
제품 운영·설정 권한이 있는 사용자에게는 Product Header의 명시적인 Surface 전환 진입점을
제공하고, 전환 후에는 URL, Header, Sidebar, Scope 표시와 복귀 동작이 모두 다른 Product
Management Shell을 사용한다.

회사 공통 거버넌스와 제품별 관리는 다음 하이브리드 구조로 분리한다.

| 영역                   | 소유 기능                                                               | Shell                       |
| ---------------------- | ----------------------------------------------------------------------- | --------------------------- |
| Tenant Governance Hub  | 조직·ID·보안·앱 카탈로그, 관리자 지정·회수, 범위·만료, 전사 정책과 감사 | `/admin` Tenant Control     |
| Product Management     | 해당 앱의 운영 Queue, 설계, 정책, 기준정보, 연계와 제품 감사            | `/<product>/...` Management |
| Product Work           | 개인 업무, 참여, 조회, 작성, 팀 관계 기반 결정                          | `/<product>/...` Work       |
| Provider Control Plane | Tenant Estate, 상용 권한, 운영, 제한된 지원 세션                        | `/provider`                 |

초기 Product Management는 같은 Origin·SPA·제품 배포 단위 안의 별도 Route Group과 Layout으로
구현한다. 별도 Subdomain·배포는 고위험 JIT 격리나 운영 경계가 실제로 필요해질 때 후속 ADR로만
도입하며, 현재 보안 경계는 도메인이 아니라 서버 인가다.

관리자가 구성원이라는 권한 불변식은 유지한다. 다만 `WORKSPACE_MEMBER`라는 신분과
`현재 관리 작업을 수행 중`이라는 UI 문맥을 동일한 Sidebar에 누적하지 않는다. Tenant Admin 또는
Provider 역할만으로 제품 데이터·제품 설정을 자동 상속하지 않으며, Product Management 진입은
명시된 제품 권한과 범위로 별도 판단한다.

## 2. 배경과 확인된 문제

Backend는 이미 Provider Control Plane, Tenant Governance, Resource Responsibility와 Workforce
Access를 독립 권한면으로 유지했다. 변경 전 Frontend `ProductAreaLayout`은 권한 필터를 통과한 모든
Navigation Group을 하나의 배열과 Sidebar에 합쳐 표시한다. 제품 관리 Route도 다수 제품에서
구성원 `AppRouteGuard` 아래에 중첩되어 있다.

2026-08-21 변경 전 기준 정적 메뉴 169개를 전수 확인한 결과는 다음과 같다.

| 구분                               | 수량 | 현재 문제                                                     |
| ---------------------------------- | ---: | ------------------------------------------------------------- |
| 11개 주요 업무 앱 메뉴             |  121 | 업무 61, 팀 3, 제품 운영·설정 57이 제품별로 한 Sidebar에 누적 |
| 중앙 Tenant Admin Hub              |   24 | 제품 관리와 구분은 되어 있으나 일부 할당 업무가 Hub에 혼재    |
| Provider Control Plane             |   10 | 별도 Shell 유지                                               |
| Workspace·Work·Activity·Account 등 |   14 | 업무·개인 설정 Surface 유지                                   |
| 전체                               |  169 | ID와 Path 중복은 없음                                         |

위 169개는 의사결정 당시의 변경 전 역사 기준이며 삭제하거나 현재 수치로 덮어쓰지 않는다. 2026-08-28
현재 계약은 Meetings 메뉴, Calendar의 휴지통·회사 캘린더 관리, DWAI·ON AI 실행 이력과 Mail의
보관함·스팸·휴지통·내 폴더·폴더 및 규칙 메뉴, DWAI·ON AI 제안함과 Meetings AI 및 데이터
거버넌스가 추가된 **전체 187개, 12개 업무 앱, 업무 앱 메뉴 139개**다. 나머지
48개는 비제품 문맥에 속한다. 승인 Authorization Bundle v3는 4개 제품의 Exact PAGE Route 58개를
닫으며, Meetings는 DRAFT 제품이므로 해당 활성 Bundle에는 포함되지 않는다.
현재 Canonical Menu Ledger SHA-256은
`c77a266fc9e1320ba4a75d639e4dd8903b7d031610854f793e904174057b85ec`다. DWAI·ON의
`/dwaion/activity`와 `/dwaion/proposals`는 `work/work`, `dwaion.work`, `W2`에 속하며 Backend
승인 Bundle에 추가하지 않고 DRAFT PAGE로 유지한다.

현재 `adminMode: none | embedded | control-center`는 DWAI·ON만 선언하고 Runtime에서 사용하지
않는다. HCM은 권한 있는 Audience의 메뉴를 합집합으로 만들며, 일부 Wildcard Page는 Sidebar가
허용한 `MANAGE` 사용자를 Page에서 정확한 `VIEW`만 검사해 되돌리는 계약 차이도 있다. 알려진
관리 Route의 권한 실패를 제품 Home으로 조용히 보내는 동작도 제품마다 다르다.

전체 근거와 각 메뉴의 최종 분류는
[R1 제품 Surface 전체 메뉴 분류표](R1%20제품%20Surface%20전체%20메뉴%20분류표.md)를 단일 검토
기준으로 사용한다.

## 3. 용어와 서로 독립인 다섯 개 개념

역할, 화면, 대상 범위와 지원 세션을 하나의 `admin mode`로 합치지 않는다.

### 3.1 Plane: 소유권·보안 경계

| Plane               | 의미                                          | 예시                       |
| ------------------- | --------------------------------------------- | -------------------------- |
| `work`              | 제품 사용과 관계 기반 팀 업무                 | 결재함, 내 팀 휴가 승인    |
| `management`        | 한 제품이 소유하는 운영·설정 업무             | 결재 정책, HRIS 정합성     |
| `tenant-governance` | 여러 앱 또는 회사 전체에 영향을 주는 거버넌스 | 역할, 앱 관리자 지정, 감사 |
| `provider-control`  | DWP 제공자의 멀티테넌트 운영                  | Tenant Estate, Support     |
| `account`           | 개인 프로필과 선호                            | 언어, 접근성, 알림 선호    |

### 3.2 Task Kind: 메뉴가 수행하는 일의 성격

모든 정적 메뉴는 `work`, `team`, `operations`, `administration` 중 정확히 한 Task Kind를
가진다. 이 값은 전체 메뉴 분류와 제품 내 Grouping을 위한 의미 분류이지 권한이나 Route가
아니다. 같은 Plane 안에서는 한 Product Surface가 둘 이상의 Task Kind를 묶을 수 있다. 예를
들어 `approvals.admin`은 `operations`와 `administration` 메뉴를 같은 관리 문맥 안에서 Group으로
나눈다.

### 3.3 Product Surface: Route에서 결정되는 작업 문맥

Product Surface는 현재 URL에 대응하는 Header, Navigation Collection, Landing과 복귀 계약이다.
Surface ID는 `approvals.work`, `approvals.admin`, `hcm.personal`, `hcm.team`,
`hcm.operations`, `hcm.management`처럼 제품 Contract로 안정되게 유지한다. 사용자 Label은
`결재 업무`, `결재 관리`, `나`, `내 팀`, `HR 운영`, `HCM 관리`처럼 제품 언어로 번역한다.
Surface는 역할명이 아니고 권한을 만들지 않는다.

### 3.4 Scope: 현재 작업의 대상 범위

Scope는 본인, 팀, 조직, 법인, Resource Set 또는 정책 상속 Node처럼 작업 대상의 경계다.
Surface와 독립적으로 서버가 허용 목록과 기본값을 계산하며 URL에는 서버가 발급한 Opaque Key만
사용한다.

### 3.5 Access Mode: 접근이 발생한 방식

`normal`, `provider-support`, 향후 `elevated`를 사용한다. Support는 별도 Product Surface가
아니다. 지원 세션으로 `/communications/admin/content`를 열어도 Plane과 Surface는 계속
`management/operations`이며, Header의 지속 Banner와 읽기 전용 여부만 Access Mode로
추가한다.

## 4. 배치 결정 규칙

새 메뉴와 기존 메뉴 재분류는 다음 순서로 판정한다.

1. 여러 Tenant에 영향을 주면 `provider-control`이다.
2. 조직·ID·보안·라이선스·앱 카탈로그·관리자 위임·전사 감사처럼 여러 앱에 영향을 주면
   `tenant-governance`다.
3. 개인 선호와 본인 계정이면 `account`다.
4. 특정 앱 안에서 개인이 소비·작성·참여하는 작업이면 `work/work`다.
5. 실제 보고·승인 관계로 제한된 팀 작업이면 `work/team`이다.
6. 특정 앱의 예외 Queue, SLA, 전달, 품질, 복구와 일상 운영이면
   `management/operations`다.
7. 특정 앱의 Workflow·Form·정책·기준정보·Connector·수명주기 설계이면
   `management/administration`이다.

상위 회사 정책이 제품 설정을 Override하면 제품 화면에서 항목을 숨기지 않는다. 읽기 전용
Control과 함께 잠금, 정책명, 정책 소유자, 적용 Scope, 발효일과 예외 요청 또는 원문 이동
경로를 제공한다.

할당된 접근 검토처럼 `누가 관리자냐`가 아니라 `누구에게 일이 배정됐느냐`로 열리는 작업은
Tenant Admin Shell에 일반 구성원을 진입시키지 않는다. 캠페인 생성·활성·종료는 `/admin`에
유지하고, Named Reviewer의 결정 Task는 기존 `/work/queue`의 `REVIEW` Work Item으로
분리한다. 선택 상태는 Opaque Work Item ID를 사용하고 실제 결정 API는 Named Reviewer 관계를
다시 검증한다.

## 5. 공통 Product Surface 계약

`ProductManifest.adminMode`를 다음 `surfaces` 계약으로 확장한다. 구체 Type 이름은 구현 중
조정할 수 있지만 필드 의미와 불변식은 변경할 수 없다. Migration 기간의 `none`, `embedded`,
`control-center`는 배치 소유권을 설명하는 호환 Shorthand로만 유지하고 Runtime Route·Shell·권한
판정은 항상 `surfaces`를 우선한다.

```ts
type ProductTaskKind = 'work' | 'team' | 'operations' | 'administration';
type ProductPlane = 'work' | 'management';
type GovernedMenuPlane = ProductPlane | 'tenant-governance' | 'provider-control' | 'account';
type ProductScopeKind =
  | 'TENANT'
  | 'SELF'
  | 'TEAM'
  | 'ORG_UNIT'
  | 'LEGAL_ENTITY'
  | 'DOMAIN'
  | 'RESOURCE_SET'
  | 'RESOURCE'
  | 'POLICY_NODE'
  | 'TARGET_POPULATION'
  | 'SUPPORT_SESSION';

type ProductRouteMatcher = {
  kind: 'exact' | 'prefix';
  path: `/${string}`;
};

type LegacyRedirectTarget =
  | { kind: 'static'; path: `/${string}` }
  | {
      kind: 'path-map';
      entries: readonly {
        sourcePath: `/${string}`;
        targetPath: `/${string}`;
      }[];
    }
  | {
      kind: 'registered-suffix';
      sourceBase: `/${string}`;
      targetBase: `/${string}`;
      registeredRouteCatalogId: string;
    };

type LegacyRedirectDefinition = {
  id: string;
  sourceMatcher: ProductRouteMatcher;
  target: LegacyRedirectTarget;
  preserveQuery: boolean;
  preserveHash: boolean;
  maxHops: 1;
  unknownTarget: 'surface-not-found' | 'product-not-found';
};

type ProductSurfaceEntryAccess =
  | {
      type: 'capability';
      requiresProductEntitlement: boolean;
      entryCapabilityMode: 'ANY' | 'ALL';
      requiredCapabilityContractKeys: readonly [string, ...string[]];
    }
  | {
      type: 'policy';
      requiresProductEntitlement: boolean;
      accessPolicyKey: string;
    };

type ProductNavigationAccess =
  | { type: 'capability'; capabilityContractKey: string }
  | {
      type: 'capability-expression';
      mode: 'ANY' | 'ALL';
      capabilityContractKeys: readonly [string, ...string[]];
    }
  | { type: 'policy'; accessPolicyKey: string };

type ProductSurfaceNavigationItem = ProductNavigationItem & {
  taskKind: ProductTaskKind;
  access: ProductNavigationAccess;
};

type ProductSurfaceNavigationGroup = Omit<ProductNavigationGroup, 'items'> & {
  items: readonly ProductSurfaceNavigationItem[];
};

type ProductSurfaceDefinition = {
  id: string;
  plane: ProductPlane;
  labelKey: string;
  taskKinds: readonly ProductTaskKind[];
  routeMatchers: readonly ProductRouteMatcher[];
  indexPath: `/${string}`;
  navigation: readonly ProductSurfaceNavigationGroup[];
  entryAccess: ProductSurfaceEntryAccess;
  supportedScopeKinds: readonly ProductScopeKind[];
  shellProfile: 'product-work' | 'product-management';
  returnSurfaceId?: string;
};

type ProductManifest = {
  id: string;
  appKey: string;
  basePath: `/${string}`;
  surfaces: readonly ProductSurfaceDefinition[];
  legacyRedirects?: readonly LegacyRedirectDefinition[];
};

type GovernedMenuRecord = {
  menuId: string;
  path: `/${string}`;
  plane: GovernedMenuPlane;
  taskKind: ProductTaskKind;
  navigationContextId: string;
  productSurfaceId?: string;
};
```

`ProductSurfaceDefinition`은 업무 앱의 `work | management` Shell 계약이다. 이 Type을 회사 관리,
Provider 또는 Account에 억지로 확장하지 않는다. 대신 `GovernedMenuRecord`가 현재 정적 메뉴 193개
모두를 한 `GovernedMenuPlane`과 `navigationContextId`에 귀속한다. 그중 12개 업무 앱의 메뉴
146개는 `productSurfaceId`도 정확히 하나 가져야 한다. 고정 Context ID는 `home`, `catalog`,
`work.work`, `activity.work`, 각 업무 앱 Surface ID, `tenant.admin`, `provider.control`,
`account.settings`다.

모든 제품은 다음 정적 검사를 통과해야 한다.

- 정적 Menu Route 193개는 정확히 한 `navigationContextId`에 속한다.
- 12개 업무 앱 Menu Route 146개는 정확히 한 Product Surface에도 속한다.
- 나머지 47개(Home·Catalog·Work·Activity·Tenant Governance·Provider·Account)는
  `productSurfaceId` 필드를 갖지 않으며 Product Surface로 잘못 투영되면 Build를 실패시킨다.
- 등록된 Menu Item의 Task Kind는 Surface의 `taskKinds`에 포함되고 정확히 하나다.
- 모든 Navigation Item은 `capability`, `capability-expression`, `policy` 중 정확히
  한 Access Union Member를 참조한다. Expression은 Non-empty Contract Key 배열과
  `mode: 'ANY' | 'ALL'`을 명시한다.
- `entryAccess`의 필드를 생략하거나 빈 Capability 배열을 사용하면 Manifest Validation을
  실패시킨다. Management Surface의 일반적인 진입 Mode는 `ANY`이고 각 Child는 자신의 Exact
  Contract를 다시 검사한다.
- `requiresProductEntitlement`와 Scope Resolver의 권위는 `entryAccess` Union에 따라 서버
  Capability Descriptor 또는 Governed Access Policy Descriptor다. Manifest 값은
  Cross-repository CI 대조용 Projection이며 `supportedScopeKinds`만으로 인가하지 않는다.
- Surface Route Matcher는 같은 제품 안에서 모호하게 겹치지 않는다.
- `indexPath`와 모든 Navigation Path는 실제 Route가 존재한다.
- `indexPath`는 해당 Surface의 Segment-safe `routeMatchers` 중 하나에 반드시 매칭된다.
- 모든 Route ID와 Path는 솔루션 전체에서 유일하다.
- Plane이 `management`인 항목은 Work Navigation 배열에 존재할 수 없다.
- Plane이 `work`인 항목은 Management Navigation 배열에 존재할 수 없다.
- `adminMode`는 소유권 호환 읽기만 허용하고 모든 제품 전환 뒤 제거한다.
- Legacy Redirect는 Source Matcher, Canonical Target 규칙, Query·Hash 보존, 한 번의 Hop과
  Unknown Target 종료 상태를 모두 선언한다. Redirect Target이 다시 Legacy Source가 되거나
  등록되지 않은 Target으로 이동하면 Build를 실패시킨다.

공통 Scope Kind에 없는 제품 전용 범위는 자유 문자열로 추가하지 않고 서버 Scope
Resolver·OpenAPI·Manifest·Contract Test에 같은 안정 Kind를 먼저 등록한다.

Surface는 URL에서 결정한다. `?surface=admin`, React Local State 또는 Local Storage 값으로
보안·Navigation 문맥을 결정하지 않는다. Query의 `scope`는 대상 범위이고 Surface 선택이
아니다. URL·Manifest와 최신 서버 접근권한이 항상 Browser 편의 복원값보다 우선한다.

`routeMatchers`는 **Surface 소유 경계**를 판정한다. Resolver는 Path를 Normalize한 뒤
`exact` 또는 `pathname === prefix || pathname.startsWith(prefix + '/')`인 Segment Boundary에서만
Longest Match한다. `/hr/teammate`를 `/hr/team`, `/approvals/administer`를
`/approvals/admin`으로 해석하지 않는다.

`pathname === ProductManifest.basePath`는 예외적으로 어떤 Surface에도 선귀속하지 않는 중립
`product-entry(productId)`다. Resolver가 Surface Matcher보다 먼저 반환하고
`ProductRootResolver`가 최신 서버 Context로 Work 우선, Management-only 차선 규칙을 적용한다.
따라서 `/approvals`, `/hr`를 Work Prefix Match 결과로 바로 `AppRouteGuard`에 보내지 않는다.

**등록된 Page인지**는 같은 Route Definition에서 생성한
`RegisteredProductRouteCatalog`의 Exact·Dynamic Pattern으로 별도 판정한다. Catalog를
손으로 중복 작성하지 않고 Router Definition과 Build Artifact 하나를 공유하며, CI가
Manifest·Navigation·Router의 차이를 실패시킨다. Resolver 결과는 `known-route`,
`product-entry(productId)`, `unknown-surface-path(productId, surfaceId)`,
`unknown-product-path(productId)`, `outside-product`를 구분한다. 소유 Matcher는 있지만 Catalog Pattern이 없으면
`unknown-surface-path`이다.

Legacy Redirect Registry와 `RegisteredProductRouteCatalog`도 Router Definition에서 Build
Artifact로 생성한다. HCM의 11개 명시 Mapping처럼 Path별 Target이 다른 경우 `path-map`,
`/rooms/<suffix>`처럼 실제 Canonical Route가 있을 때만 옮기는 경우 `registered-suffix`를
사용한다. Query·Hash 보존은 Definition에 명시하고, 미등록 Source/Target은 Home으로 보내지
않으며 선언된 Product/Surface-local 404로 종료한다.

UI Route Catalog과 Backend Capability Registry 사이에 독립된
`ProductRouteAuthorizationContract`를 둔다. Key Namespace는
`route.<product>.<surface>.<route-path>.<kind>`이며 `route-path`는 하나 이상의 lower-kebab
점 구간이다. 비제품 Governed Route는 별도 Namespace
`route.context.<navigation-context-token>.<route-path>.<kind>`를 사용한다.
`navigationContextId`는 lower-kebab 점 구간만 허용하고, `navigation-context-token`은 각 점을
`__`로 치환한 가역 Encoding이다. Context Segment에는 `_`를 금지하므로 Decode가 유일하며
`work.work`의 Token은 `work__work`다. 별도 Token Registry나 수기 Mapping을 만들지 않는다.
Capability Contract Key와 같지 않다.

```ts
type RouteAccessProfile = {
  profileKey: string;
  precedence: number;
  activeAccessModes: readonly [
    'NORMAL' | 'ELEVATED' | 'PROVIDER_SUPPORT',
    ...('NORMAL' | 'ELEVATED' | 'PROVIDER_SUPPORT')[],
  ];
  requiredAccess:
    | { type: 'capability'; capabilityContractKey: string }
    | {
        type: 'capability-expression';
        mode: 'ANY' | 'ALL';
        capabilityContractKeys: readonly [string, ...string[]];
      }
    | { type: 'policy'; accessPolicyKey: string };
  targetBindingKinds?: readonly [
    'SELF' | 'OBJECT' | 'RELATIONSHIP' | 'TARGET_POPULATION' | 'CONFIG_SCOPE',
    ...('SELF' | 'OBJECT' | 'RELATIONSHIP' | 'TARGET_POPULATION' | 'CONFIG_SCOPE')[],
  ];
  predicatePolicyKeys?: readonly [string, ...string[]];
  responseProjectionBindings?: readonly [
    {
      apiBindingKey: string;
      projectionPolicyKey: string;
      responseSchemaKey: string;
    },
    ...{
      apiBindingKey: string;
      projectionPolicyKey: string;
      responseSchemaKey: string;
    }[],
  ];
  readOnly: boolean;
};

type GovernedApiBinding = {
  bindingKey: string;
  method: string;
  path: string;
  pathParameterConstraints?: Readonly<
    Record<
      string,
      | { kind: 'FIXED'; value: string }
      | { kind: 'ALLOWLIST'; values: readonly [string, ...string[]] }
    >
  >;
};

type GovernedServicePepBinding = GovernedApiBinding & {
  serviceKey: 'auth' | 'platform' | 'approval' | 'people' | string;
};

type GovernedRouteAuthorizationContract = {
  routeContractKey: string;
  navigationContextId: string;
  subject:
    { type: 'PRODUCT'; productKey: string; surfaceKey: string } | { type: 'GOVERNED_CONTEXT' };
  routeKind: 'PAGE' | 'DATA' | 'ACTION';
  sideEffectFree?: boolean;
  uiRouteId?: string;
  uiRoutePattern?: string;
  accessProfiles: readonly [RouteAccessProfile, ...RouteAccessProfile[]];
  gatewayApiBindings: readonly [GovernedApiBinding, ...GovernedApiBinding[]];
  servicePepBindings: readonly [GovernedServicePepBinding, ...GovernedServicePepBinding[]];
  owner: string;
  policyVersion: number;
  lifecycleState: 'ACTIVE' | 'RETIRED';
};

type ProductRouteAuthorizationContract = GovernedRouteAuthorizationContract & {
  subject: { type: 'PRODUCT'; productKey: string; surfaceKey: string };
};
```

Router Definition이 Route Key Projection을 생성하고 Cross-repository CI가 Manifest·Router·Auth
Registry·Public Gateway Method/Path·Downstream Service PEP Method/Path를 양방향 대조한다.
두 Binding은 Stable `bindingKey`로 1:1 대응하는 Non-empty Exact Allowlist이며 `/**`로 미래 API를
자동 포함하지 않는다. Client가 Key를 보내도 Permission 선택권이 생기지 않으며,
Unknown·Retired·Product/Surface/Method 불일치는 `ROUTE_DENIED`다.

PAGE만 UI Route ID·Pattern을 가지며 Browser Resolver에 참여한다. DATA는 GET/HEAD Read 또는
`sideEffectFree=true`가 고정된 비변경 POST Query를 표현하고 Response Projection을 필수로 가진다.
POST DATA는 Business State·Workflow Outbox를 바꿀 수 없고, 응답과 무관한 append-only Security
Audit만 허용한다.
ACTION은 Mutation Command이며 Response Projection을 가질 수 없다. DATA와 ACTION은 모두 UI
Pattern을 가질 수 없다. Downstream Binding은 `serviceKey`를 필수로 가져 같은 Service-local
경로가 어느 PEP·OpenAPI·Audience에 속하는지 고정한다. `platform/approval/people`은 `/v1/**`,
`auth`는 `/auth/**` Grammar를 사용한다.
권한 의미를 바꾸는 Path Parameter는 FIXED 또는 ALLOWLIST Constraint를 Public·Service Binding
Pair에 동일하게 저장하고 PEP가 실제 값과 재대조한다. 누락·양쪽 불일치·빈 Allowlist는 Build를
실패시킨다.

Product Route는 `subject.type=PRODUCT`, 비제품 Governed Route는
`subject.type=GOVERNED_CONTEXT`로 고정한다. Named Reviewer의 Work Queue는
`navigationContextId=work.work`인 비제품 Route로
등록하며 현재 Product Surface 메뉴 146개에 포함하지 않는다.
`navigationContextId`의 권위는 Contract Top-level 필드 하나뿐이며 Subject 안에 중복 저장하지
않는다. Non-product Key의 `navigation-context-token`을 위 총함수로 Decode한 값이 Top-level
`navigationContextId`와 다르거나 `_`가 포함된 Context ID·비정규 Token이면 Bundle Build를
실패시킨다.

일반 관리자, Auditor, Support, Legacy Oversight처럼 같은 Route를 다른 Projection으로 읽는
경우 Route는 서버 선택형 `accessProfiles`를 가진다. Client가 Profile을 고르지 않으며 서버는
현재 Access Mode가 `activeAccessModes`에 포함되는 허용 Profile 중 Registry의 고유 Precedence가
가장 높은 하나만 선택한다. Projection/Field
Mask와 Target Predicate는 Capability가 아니라 선택된 Profile과 Stable API Binding에 결속한다.
PAGE/DATA는 응답 Binding마다 Projection·Response Schema를 필수로 갖고 ACTION은 Read Projection을
금지한다. 동률·중복·미등록 Predicate·응답 Binding은 Build를 실패시킨다.

`predicatePolicyKeys`는 같은 Immutable Authorization Bundle의 Predicate Policy Descriptor를
참조한다. Descriptor는 Owner Service, 허용 Target Binding Kind, Versioned Evidence Schema,
Fixed Parameter/Allowlist, Route Allowlist, Owner·Version·Lifecycle을 가진다. Product Service가
Evidence 판정 권위를 유지하며 Unknown Key, Owner/Target 불일치, 빈 Allowlist와 Schema Drift는
Fail Closed다. Predicate가 여러 개인 Profile은 모두 AND로 평가한다. 각 Predicate의 Effective
Target Set은 `Profile.targetBindingKinds ∩ Descriptor.targetBindingKinds`이며 Non-empty여야 하고,
모든 Effective Target Set의 합집합은 Profile Target Set과 정확히 같아야 한다. 한 Predicate가
Profile의 모든 Target Kind를 혼자 포함할 필요는 없다. 이 Union-cover 규칙의 미충족·초과 Kind는
Build를 실패시킨다. Client는 Predicate나 Parameter를 선택하지 않는다.

## 6. Route와 Guard 계약

Product Root에는 인증과 Workspace/Support Context만 둔다. Work Route와 Management Route를
Pathless 또는 명시적 Child Route로 분리하고 각각 독립 Guard를 적용한다.

```text
/<product>
├── work routes ───────── App entitlement + object authorization
└── management routes ─── management capability + scope + object authorization
```

- Product Management는 `APP.*` 구성원 Entitlement 아래에 구조적으로 중첩하지 않는다.
- 특정 관리 업무에 Work Entitlement도 필요하면 Manifest와 서버 정책에서 `AND`를 명시한다.
- UI가 `APP.* OR ADMIN.*`를 임의 합성하지 않는다.
- `000/100` 호환 구간의 Work Shell도 대상 `APP.*`의 명시적 Allow를 요구한다. APP 행이 비어
  있다는 이유로 Work 진입을 허용하는 기존 호환 규칙을 Product Surface Route에 적용하지 않는다.
- 두 Surface Router는 `managementLegacyShell`을 필수 입력으로 받으며 Work Shell을 Management
  fallback으로 재사용하지 않는다. `requiresProductEntitlement=false`인 관리 전용 사용자는 APP
  권한 없이 관리 Shell에 들어가되 Work Shell에는 들어갈 수 없어야 한다.
- 호환 구간의 Management Index는 권한 Snapshot 로딩을 기다린 뒤 현재 사용자가 접근 가능한
  첫 Management PAGE로만 이동한다. 일반 제품 Page나 Work 기본 경로를 fallback으로 사용하지
  않으며 Query·Hash를 보존하고 후보가 없으면 `/403`으로 종료한다.
- `110/111`의 서버 Work 결정으로 호환 Guard를 통과할 때는 decision의 `productKey`,
  `surfaceKey`, `appResourceKey`가 Guard의 기대값과 모두 정확히 일치해야 한다. 다른 제품 또는
  Surface의 허용 결정을 재사용하지 않는다.
- 알려진 Route의 접근 실패는 다른 Surface로 조용히 Redirect하지 않는다.
- `SurfaceAccessState`는 `app-denied`, `surface-denied`, `route-denied`, `scope-selection-required`,
  `scope-invalid`, `expired`, `activation-required`, `step-up-required`, `sod-conflict`,
  `support-scope-denied`, `authority-unavailable`를 구분한다.
- Unknown Surface Path는 접근 가능한 Shell 안 404다. Surface 접근도 확인되지 않으면 보호된
  구조를 노출하지 않는 Product-local 404를 표시한다.
- `replace`는 Index Canonicalization과 Legacy Redirect에만 사용한다. 사용자가 Surface 또는
  Scope를 선택한 이동은 History에 남긴다.
- Surface Index는 PAGE 권한 대상으로 가장하지 않는다. Index Shell Guard보다 먼저, Scope 없는
  Sibling PAGE 판정에서 확인된 첫 허용 Child로 Query·Hash·명시 Scope를 보존해 `replace`하고,
  이동이 끝난 Exact PAGE 한 건에만 URL Scope를 결속한다.
- Direct URL, 새로고침, Browser Back/Forward와 새 Tab이 같은 Surface·Scope를 복원한다.

관리 권한만 있고 Work Entitlement가 없는 사용자의 Management Deep Link는 허용할 수 있다.
반대로 Work만 가능한 사용자는 Management Route와 API에서 403이어야 한다. `업무로 돌아가기`는
실제 Work 접근이 있을 때 마지막 허용 Route로 이동하고, 없으면 앱 카탈로그 또는 관리 가능한
앱 목록으로 이동한다.

Product Root Resolver는 모든 제품에서 다음 순서를 고정한다.

1. Work 접근이 있으면 Management 권한 보유 여부와 무관하게 Manifest 순서의 첫
   허용 Work Surface·Index로 이동한다.
2. Work가 없고 유효한 Management Context만 있으면 첫 허용 Management Surface·Child로 이동한다.
3. 둘 다 없으면 App Access State를 표시한다.

`app-denied`는 Work Route 또는 `requiresProductEntitlement=true`인 Management Contract에만
적용한다. Management-only 사용자를 Product Root의 Member Guard로 막지 않는다.

### 6.1 인가 방식과 Action 의미

각 Capability는 Permission 계열의 다음 Typed Authority Mode만 가진다.

| Mode                          | 판정 의미                                                      |
| ----------------------------- | -------------------------------------------------------------- |
| `PERMISSION`                  | 정확한 Resource·Action Permission                              |
| `PERMISSION_AND_RELATIONSHIP` | Permission과 대상 관계를 모두 요구                             |
| `PERMISSION_OR_RELATIONSHIP`  | 명시된 조회·진입 계약에서만 제한적으로 OR, 결과는 Scope Filter |

Permission이 아닌 진입 정책은 `GovernedAccessPolicyDescriptor`로 분리하고
`ENTITLEMENT | RELATIONSHIP | ENTITLEMENT_AND_RELATIONSHIP | SUPPORT_SESSION`
Authority Mode를 명시한다. Approvals·Communications·Services Work는 `ENTITLEMENT`, HCM
Team은 `ENTITLEMENT_AND_RELATIONSHIP`이며 Support를 NORMAL Grant와 합산하지 않는다.
NORMAL/ELEVATED와 PROVIDER_SUPPORT가 같은 Surface Route를 공유할 때는
`evaluationType=MODE_BRANCH`인 Policy Descriptor가 Active Access Mode별 Capability 또는
Support Policy Branch를 하나만 선택하며 Branch 결과를 합집합하지 않는다.

`MANAGE`는 전역 Wildcard가 아니다. Resource별 Versioned Implication Policy가 명시한 경우에만
`VIEW` 등 제한된 Action을 포함할 수 있다. `APPROVE`, `PUBLISH`, `EXECUTE`, `EXPORT`,
`LEGAL_HOLD`, `GRANT`, `REVOKE`와 Secret Rotation은 `MANAGE`에서 암묵 파생하지 않는다.
Navigation, Route, Gateway와 Service PEP가 같은 Implication Policy를 사용한다.

## 7. Shell과 Navigation 계약

### 7.1 Work Shell

- Sidebar에는 현재 Work 또는 Team Surface의 메뉴만 표시한다.
- 관리 메뉴 Tree, 관리 KPI와 관리용 위험 신호를 포함하지 않는다.
- 관리 가능한 사용자는 Product Header의 이름 있는 단일 `앱 관리` Link로만 Management Plane에
  진입한다. Work Header에 세부 운영·설정 Surface를 나열하지 않는다.
- 관리 권한이 없는 사용자는 비활성 관리 Control을 보지 않는다.

### 7.2 Product Management Shell

- 동일한 DWP Design System과 제품 Brand를 유지하되 별도 Navigation Collection을 사용한다.
- Header에는 Settings 계열 Icon과 `{제품명} 관리`, `관리 모드`, 현재 Tenant·Scope를 Text로
  표시한다. Compact 화면에서도 짧은 `관리`/`Manage` 상태 Token을 먼저 보존한다.
- 색상 하나로 모드를 구분하지 않는다.
- Sidebar에는 현재 Management Surface의 메뉴만 표시하고 `업무로 돌아가기`를 제공한다.
- 여러 제품·범위를 관리하면 Surface Switcher와 Scope Switcher를 시각·의미적으로 분리한다.
- Scope가 하나면 Selector를 숨기고 고정 Label만 표시한다.

Desktop과 Mobile의 `앱 관리`·`업무로 돌아가기`는 모두 직접 Native Link로 구현한다. 같은 Plane에
둘 이상의 Surface가 있을 때만 현재 Surface Button이 동일 Plane Link 목록 Disclosure를 열며,
닫을 때 Trigger로 Focus를 복원한다. Route 전환 후 Document Title과 H1을 갱신한다. Tab Panel처럼
보이더라도 `role=tab`인 Local Content 전환으로 구현하지 않는다.

Native `<a href>`는 W3C APG의 강한 권고이자 이 ADR의 제품 구현 결정이다. WCAG 수용 기준은
Name·Role·Value, Keyboard, Focus, 320 CSS px Reflow와 Status Message 의미를 별도로 검증한다.

## 8. 진입·복귀와 편의 상태

1. Work 접근이 있는 Multi-hat 사용자의 앱 진입 기본은 Work Surface다. 관리 권한이 있다는
   이유만으로 관리 Landing을 기본으로 만들지 않는다. Work Identity가 없는 Management-only
   사용자는 Product별 Root Resolver가 첫 허용 Management Route 또는 명시적 Access State를
   선택한다.
2. Work Header는 허용된 Work Surface와 최대 한 개의 `앱 관리` Link만 투영한다. 여러
   Management Surface가 있어도 Work Header에는 대표 관리 진입점 하나만 표시하고, 세부 전환은
   Management Context 안에서만 제공한다.
3. 앱 카탈로그 Card는 관리 가능한 앱에 보조 `관리` Action을 제공할 수 있다. 이 Action도
   서버 Context를 재검사한다.
4. Tenant Admin Hub의 앱 Card는 해당 앱 Management Route로 Deep Link할 수 있지만 제품
   권한을 자동 부여하지 않는다.
5. 마지막 위치 편의값은 **Management에서 Work로 돌아갈 때만** 사용한다. Work Surface의
   `tenant + user + product + surface` Key 아래 `routeId`와 허용된 비식별 Filter만
   `sessionStorage`에 저장한다.
6. 이름이 `앱 관리`인 전환은 항상 Manifest가 선언한 대표 Management Landing으로 이동한다.
   이전 Management Route를 읽어 자동 복원하지 않으며, `앱 관리`를 암묵적인 `관리 이어하기`로
   해석하지 않는다. 이는 권한·책임·Scope가 바뀐 뒤 과거의 고위험 관리 문맥으로 예기치 않게
   복귀하는 것을 막는 예측 가능성 경계다.
7. 제품이 장시간 관리 작업 재개를 제공해야 한다면 별도 이름의 명시적 `관리 이어하기` Action과
   후속 계약을 사용한다. 사용자가 Action을 실행한 시점에 Exact PAGE, 현재 Decision Revision,
   만료, Tenant·Actor·Product·Surface를 서버에 다시 검증한 뒤에만 이동한다. 저장 가능한 값은
   `routeId`뿐이며 사람·결재·요청·초안 ID, Raw URL, Filter, `scope`, Support Session과 권한
   정보는 저장하지 않는다. 검증 실패는 대표 Management Landing으로 종료하고 과거 관리 Data를
   복원하지 않는다.
8. Logout, Tenant 변경, 권한 Revision 변경과 만료 시 관련 편의값과 Query Cache를 제거한다.

## 9. 권한과 Effective Product Surface Context

### 9.1 책임과 행위 권한을 구분한다

`APP_OWNER`, `APP_CONFIG_ADMIN`, `APP_ACCESS_*`는 **책임과 범위**를 뜻한다. `ADMIN.*:VIEW`,
`UPDATE`, `APPROVE`, `MANAGE`는 **허용 행위**를 뜻한다. Frontend는 책임 코드만으로 제품별
행위 권한을 만들거나 `APP_CONFIG_ADMIN = 모든 앱 설정 가능`으로 하드코딩하지 않는다.

회사 관리자가 UI에서 선택하는 `앱 관리자` Preset은 내부적으로 다음을 원자적이고 감사
가능한 Workflow로 처리한다.

1. 앱 Resource Set과 유효기간이 있는 책임 Assignment
2. 제품별 최소 권한 Package 또는 전문 역할 Assignment
3. SoD와 자기 승인·자기 이행 Conflict 검사
4. 승인·활성화·만료·회수와 Session/Decision Revision 갱신

회사 관리 센터는 이 Preset 수명주기를 오케스트레이션하지만 제품 기능을 실행하는 장소가 아니다.
중앙에서 직접 할당할 수 있는 책임은 `APP_OWNER`, `APP_ACCESS_MANAGER`,
`APP_ACCESS_APPROVER`, `APP_ACCESS_REVIEWER` 네 개로 제한한다. `APP_CONFIG_ADMIN`, 제품 전문
Role과 그로부터 계산되는 Exact Capability는 제품별 범위에 결속하고, 실제 생성·수정·게시·운영
Action은 해당 앱 Management Workbench에서만 수행한다. Tenant Admin Hub의 Deep Link와 Preset
승인은 이 제품 권한을 암묵적으로 추가하거나 회사 센터에 제품 Action 권한을 만들지 않는다.

Approvals처럼 Designer, Publisher, Operator가 분리된 제품은 하나의 광범위한 App Admin
Preset으로 합치지 않는다. 책임은 Scope를 제한하고 제품 전문 역할은 행위를 제한한다.

W1a Approvals는 Tenant-wide 전문 Role 문자열을 Scope 증거로 사용하지 않고, 승인된
`Scoped Specialist Duty Assignment`를 Exact Capability의 독립 Authority Source로 사용한다.
Duty Assignment는 `USER | GROUP` Principal, 명시적 Resource Set, 유효기간, 검토기한, 요청·승인·
회수자, 사유, Source와 Object Version을 가진다. Audit Duty를 제외한 모든 전문 Duty는 같은
Effective User와 같은 Resource Set에 결속된 활성 `APP_CONFIG_ADMIN` 책임을 함께 요구한다.
Duty와 책임의 Principal Source는 Direct/Group으로 달라도 되지만 서로 다른 사용자나 Resource
Set의 증거를 조합하지 않는다. `APPROVAL_OPERATIONS_AUDIT`은 독립 감사를 위해
`APP_CONFIG_ADMIN`을 요구하지 않는 명시적 Policy Exception이지만, 여전히 승인된 Audit Duty와
정확한 Resource Set·Capability Mapping이 필요하다.

기존 `APPROVAL_DESIGNER`, `APPROVAL_PUBLISHER`, `APPROVAL_OPERATOR`, `AUDITOR` Global Role은
000/100 Compatibility 경로의 Permission Package와 Migration Provenance로만 유지한다. 신규
110/111 인가에서는 Global Role이나 Global Permission만으로 전문 Duty를 대신할 수 없고, 반대로
Scoped Duty는 해당 Contract에 매핑된 Exact Capability만 만든다. Auth의 명시적 `DENY`는 Role,
Principal Grant와 Scoped Duty의 모든 `ALLOW`보다 우선한다. Scope를 증명할 수 없는 Legacy
전문 Role, 모든 Legacy Auditor와 충돌 Role 조합은 자동 Grant하지 않고 Owner Review Queue에 둔다.

위임형 Product Management의 기본 허용식은 `활성 Responsibility/Resource Set AND Exact
Capability`다. Capability Descriptor는 예외만
`responsibilityRequirement = NOT_REQUIRED | LEGACY_OVERSIGHT`로 명시할 수 있다.
순수 `RELATIONSHIP`과 `SUPPORT_SESSION`은 Governed Access Policy Authority Mode이며
Responsibility를 가장하지 않는다.
Responsibility만으로 Action을 만들지 않고 Capability만으로 Scope를 넓히지 않는다.

기존 Permission-only 전문 관리자는 자동 Tenant-wide Responsibility를 받지 않는다. 기존
Scope·Owner·Validity를 증명할 수 있을 때만 같은 범위로 Backfill하고, 증명할 수 없는 사용자는
Owner 검토 Queue에 남긴다. `앱 관리자` Preset은 Idempotency Key 아래 모든 Assignment를 비활성
상태로 준비하고 전체 Validation과 Commit이 성공한 뒤에만 Effective해진다. 부분 성공은 Surface에
노출하지 않으며 회수 시 필수 Responsibility 또는 Permission Package 어느 하나가 비활성화되는
즉시 Context를 제거한다.

### 9.2 서버 정규화 계약

Frontend가 `/me.resourceRoles`, `/permissions`와 Product Relationship을 임의 결합하지 않도록
Gateway Read Model은 `EffectiveProductSurfaceContext`를 제공한다. Auth는 Role·Responsibility·
Management Grant를, Product Service는 Reporting·Delegation·Target Population을 소유한다.
Gateway가 표시용 결과를 합성해도 각 Service의 최종 인가 권위는 이동하지 않는다.

```json
{
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
          "scopeKeys": ["opaque-server-key"],
          "requiresProductEntitlement": false,
          "readOnly": true,
          "activationState": "ACTIVE",
          "validUntil": "2026-12-31T15:00:00Z"
        }
      ],
      "scopes": [
        {
          "key": "opaque-server-key",
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
```

- 한 Context는 정확히 하나의 `productKey + surfaceKey + 서버가 결정한 activeAccessMode`를
  표현한다. Active Support Session이면 같은 Session의 `NORMAL` Context를 평가·반환하지
  않는다.
- Effective Grant는 `CAPABILITY | POLICY` Discriminated Union이다. Capability Grant는
  안정 Contract Key·Resolved Exact Code·Authority·Responsibility·Scope·Validity를,
  Policy Grant는 Entitlement/Relationship/Support Policy·Scope·Validity를 결속한다. Client는 서로 다른
  Grant의 Capability·Policy·Responsibility·Scope를 교차 조합하지 않는다.
- Relationship·Support를 인공 Capability로 변환하지 않는다. Scope `readOnly`는 해당
  Scope에 유효한 Mutation Grant가 하나도 없을 때만 `true`다.
- `accessSource`는 `ENTITLEMENT | RELATIONSHIP | MANAGEMENT | SUPPORT`다. Header는 허용 Context의
  Surface만 Projection하며 Role 문자열이나 Responsibility만으로 Surface를 추론하지 않는다.
- Navigation Context Endpoint는 현재 `ALLOWED`인 Context만 반환한다. 명시적 `DENY`, 비활성,
  만료·회수와 Scope Conflict는 제거하되 Direct Route 상태 판정은 별도 서버 평가로 제공한다.
- Navigation 목록과 PAGE·DATA·ACTION Direct 판정은 각각 재계산되므로 `contextKey`와
  `decisionRevision`이 서로 다른 Opaque 값일 수 있다. Client는 문자열 동일성을 요구하지 않고
  Tenant·Actor·Product·Surface·Plane·Access Mode, 유효시간과 Direct 선택 Scope가 목록 Context의
  유일한 동일 Key·Kind Scope인지 검증한다. Client는 ACTION 평가·실행에 목록 `contextKey`를
  전송하지 않는다. 선택 Scope와 Direct Revision을 보내면 Gateway가 Exact ACTION Context를 다시
  계산한다. `STEP_UP_REQUIRED`가 Context를 비공개로 반환하는 HIGH Action도 Issuer에 목록
  `contextKey`를 보내지 않으며, Issuer가 동일 Scope·Revision으로 재평가해 얻은 Exact Context를
  Command-bound Challenge에 서명한다.
- Surface Entry가 허용 Scope를 정확히 하나의 `SELF`로 결정하고 Child Capability의
  Responsibility가 `NOT_REQUIRED`이면 Direct Route도 그 `SELF` Surface Scope를 유지한다.
  Assigned/Candidate/Object/Relationship 같은 Child Target Resolver는 선택 가능한 새 Surface
  Scope가 아니라 Product Service PEP의 대상 검증 경계이며, Gateway와 소유 서비스가 요청마다
  다시 검사한다. 다중 Scope 또는 Responsibility가 필요한 Surface에는 이 상속을 적용하지 않는다.
- Tenant ID는 Client Scope 값으로 선택하지 않고 신뢰 가능한 Gateway Context에서 받는다.
- URL `scope`와 Product API의 `contextScopeKey`는 서버가 발급한 Opaque Key만 사용하며 Gateway가
  Actor·Product·Surface와 대조해 Trusted Context로 변환한다.
- `decisionRevision`은 Auth·Policy·Relationship·Target Population·Support Revision을 포함한
  Opaque Composite Token이며 다음 API 요청에 즉시 반영한다.
- `revalidateAt`은 Grant·Scope·Session 만료와 Policy 재평가 중 가장 이른 시각이다.
- Summary나 Read Model은 Navigation 편의 계약이며 API 권한을 대체하지 않는다.
- Gateway와 각 서비스는 매 요청 Tenant, Capability, Resource Scope, Target Population,
  Field Mask와 Object State를 다시 검증한다.

Direct URL·새 Tab·만료 상태는 `productKey`, `surfaceKey`, 필수 `routeContractKey`, 선택적
`contextKey`·`contextScopeKey`를 받는 서버
평가 Endpoint가 다음 Decision 중 정확히 하나로 반환한다.

```text
ALLOWED | APP_DENIED | SURFACE_DENIED | ROUTE_DENIED | SCOPE_SELECTION_REQUIRED | SCOPE_INVALID |
EXPIRED | ACTIVATION_REQUIRED | STEP_UP_REQUIRED | SOD_CONFLICT |
SUPPORT_SCOPE_DENIED | AUTHORITY_UNAVAILABLE
```

서버는 Route Contract를 Registry의 Product·Surface·Exact Capability/Policy와 대조하고 Client가
Raw Capability Code를 선택하지 못하게 한다. 응답은 공개 가능한 만료·재요청 Metadata와 최신
Decision Revision만 포함한다. Frontend는 이를 Exhaustive
Union으로 매핑하고 알 수 없는 값은 `AUTHORITY_UNAVAILABLE`로 Fail Closed한다.

### 9.3 Tenant Admin, Support와 JIT

- `TENANT_ADMIN`은 회사 거버넌스 책임을 가지지만 제품 Management Capability를 자동 상속하지
  않는다. 기존 Seed가 Tenant Admin 전문 Role에 **명시적으로** 부여한 제품 `VIEW`는 Product와
  Security Owner가 승인한 Capability·Route·API·Field Mask·Scope Allowlist에 한해
  `LEGACY_OVERSIGHT`, Read-only 호환 권한으로 유지할 수 있다. 이는 Role Code로부터 추론한
  상속이 아니며 신규 제품에는 자동 추가하지 않는다. Mutation, Export, Secret과 고객 Content는
  제외한다. Owner와 Sunset 조건이 없는 호환 Grant는 허용하지 않으며 축소 시 영향 분석과 별도
  Migration 승인을 거친다.
- Provider Support는 승인된 Session, Tenant, Scope, Read-only/Write, 사유와 만료를 지속
  표시한다. `WORKFORCE_READ`는 HCM Operations Read-only를 열 수 있지만 HCM Management나
  쓰기를 열 수 없다.
- R1 Production의 단기 JIT와 Emergency Activation은 **모든 Scope에서 비활성화**한다. 현재
  Effective Permission Projection은 `ORG_UNIT`, `RESOURCE` Grant를 모든 서비스 PEP까지
  End-to-end로 투영하지 못하며, Approval 중 Eligibility·Policy Revision 변경을 결속하는 승인
  증거도 완료되지 않았다. Auth Service의 환경 변수 없는 Rollout Gate와 DB Trigger가 정책 활성화,
  승인 대기 Request와 Live Grant 생성을 각각 거부하고, 전환 Migration은 기존 Live/Pending 상태를
  폐기한다. 재활성화는 Exact Scope PEP, Expiry 재검증, Authority Revision Binding,
  Cross-scope 음성 Matrix와 Identity·Security Owner 승인 증거를 모두 요구한다. 앱 범위 위임은
  JIT를 가장하지 않고 기존 Responsibility + Resource Set + Validity를 사용한다.
- 고위험 변경은 Risk Registry에 따라 Step-up Authentication, 사유, 영향 Preview,
  Maker-checker, Before/After Audit와 Rollback을 요구한다. Step-up은 MFA `amr` 존재만 보지 않고
  `requiredAcr`, `maxAuthAgeSeconds`, `activationTtlSeconds`, Capability/Risk Policy ID와
  `auth_time` 또는 동등한 Freshness Evidence를 검증한다. Single-use Challenge는 Actor·
  Tenant·Capability·Scope·Target Type/ID·Expected Object Version·Canonical Method/Path·
  Idempotency Key·Payload Digest·Decision Revision에 결속하고 Domain Commit과 같은
  Transaction에서 소비한다. 정책 누락·Resolver 장애는 Fail Closed한다.
- Auth는 IdP별 `accepted AMR`를 exact lowercase closed mapping으로 검증한다. 명시된
  `pwd+otp`, `hwk`, `webauthn`, `fido`, `fido2` 또는 IdP가 직접 반환한 `mfa`만
  MFA 근거로 승격하며, 실제 AMR은 설정 Allowlist의 Subset이어야 한다. 검증된
  Step-up은 원본 AMR Token을 보존하고 Canonical `mfa`를 추가해
  `OIDC_STEP_UP` Provenance와 함께 Session·Challenge에 저장한다. `pwd`만 있는 경우,
  미지·대소문자 변형 AMR, 불완전한 설정은 Fail Closed하고 Production Readiness를
  실패시킨다. 일반 OIDC Login의 원본 AMR은 IdP가 literal `mfa`를 반환해도
  자동 승격하지 않으며, `OIDC_STEP_UP` Provenance + Canonical `mfa`가 모두 없는
  Session은 Challenge를 서명하지 않고 새 Step-up Continuation으로 전이한다.
- SoD Policy는 Policy ID, 겹치는 Resource Set·Target과 검사 시점
  `ASSIGNMENT | ACTIVATION | MUTATION`을 명시한다. Designer/Publisher, Operator/Auditor 같은
  충돌은 Tenant 전체 역할명이 아니라 같은 Resource Set·Object·Risk Policy 경계에서 판정한다.
  Assignment Phase는 이벤트가 아닌 겹치는 Resource Set의 충돌 Pair를, Mutation Phase는
  존재하는 Object/Event의 당사자·Version을 각각 독립 Predicate로 검사한다.
- 서로 다른 Approvals Resource Set은 공통 Product Root `APP.APPROVALS`만 공유한다는 이유로
  겹친 것으로 보지 않는다. 같은 Resource Set ID이거나, 서로 다른 Set이 같은 활성 비-Product
  Child `(resourceType, resourceKey)`를 공유하고 Assignment 유효시간이 겹칠 때만 Static SoD
  Overlap이다. Canonical `RS_APPROVALS`는 Root-only Pilot Scope를 허용하고, 별도 동적 Set은
  `APP.APPROVALS` Root와 하나 이상의 비-Product Child를 모두 가져야 한다.
- Duty Assignment와 Group/User/Resource Set Membership·상태·Conflict Policy 변경은 Tenant
  단위 직렬화와 지연 DB Constraint로 재검사한다. 숨은 Direct/Group 교차 충돌이나 Membership
  변경으로 새 충돌이 생기면 Transaction 전체를 거부한다. 동일 Pending Assignment의 동시
  Activation은 Expected Version CAS로 정확히 하나만 성공한다.
- Recovery Auditor는 Event의 `RS_APPROVALS`와 겹치는 유효한 Scoped Audit Duty에서만 선택하고
  Originator와 겹치는 Scoped Operator를 제외한다. Audit Duty의 Exact
  `approvals.audit.operations.read` Mapping과 Operator Evidence의 Exact
  `approvals.operations.execute` Mapping을 모두 검증한다. Global Auditor Role이나 Global
  `ALLOW`는 필요하지 않지만 명시적 `DENY`, 증거 Drift, 후보 부재는 Fail Closed한다.

### 9.4 퇴역·Legacy 권한

- 퇴역 Capability는 호환 Alias가 남아 있어도 Frontend, Gateway, Service와 Agent PEP에서
  `ALLOW` 근거로 사용할 수 없다. 특히 Aggregate `ADMIN.DWAION`은 세분 Capability 우회로
  재활성화하지 않는다.
- Permission Payload가 비거나 Registry에서 Product Contract를 찾지 못하면 신규 Product
  Management는 Fail Closed한다. 기존 App Entitlement의 Legacy Fail-open 동작을 신규 Surface
  계약으로 복제하지 않는다.
- `U_p`만 Layout·Navigation Projection을 바꾼다. `S`는 차이를 관찰하고 `E_p`는 기존/Exact
  Authority 경계를 선택하지만, 어떤 Flag도 그 자체로 Permission·Scope를 부여하거나 인가 우회
  수단이 되지 않는다.

## 10. Scope와 정책 상속

Surface Switcher는 `어떤 일을 하는가`, Scope Switcher는 `어느 대상을 관리하는가`를 답한다.
두 Control을 하나의 Dropdown으로 합치지 않는다.

| Surface          | 기본 Scope                                     |
| ---------------- | ---------------------------------------------- |
| Work             | 서버가 결정한 본인·업무 객체                   |
| Team             | 유효일 기준 실제 보고·승인 관계와 승인된 위임  |
| Operations       | 허용된 조직·법인·지역·Domain Target Population |
| Administration   | 앱·Resource Set·정책 상속 Node                 |
| Provider Support | 승인된 Tenant와 Support Scope                  |

허용 Scope가 하나면 이를 Canonical URL로 `replace`한다. 둘 이상이면 서버가 정확히 하나를
`isDefault=true`로 지정한 경우에만 자동 선택한다. 기본값이 없거나 둘 이상이면
`scope-selection-required` 상태에서 Product Data Query와 Mutation을 시작하지 않는다.
같은 Surface의 다른 PAGE로 이동할 때 현재 Opaque Scope가 그 PAGE의 신뢰 가능한 허용 Scope
집합에 있으면 Query·Hash와 함께 유지한다. 다른 Surface에서 온 Scope, 알 수 없거나 만료된 Scope는
전파하지 않으며 유효한 다른 Scope로 조용히 확대하지 않는다.

선택한 Opaque Key는 OpenAPI의 표준 `contextScopeKey` Request Parameter로 전달하며 Client가
`X-DWP-*` Header를 만들지 않는다. Gateway는 Actor·Product·Surface와 다시 대조해 Trusted
Context로 변환하고 Product Service는 실제 Object·Target Population을 재검사한다. Scope 변경은
`in-flight 취소 → 민감 Selection·Content 제거 → URL Push → 새 Scope Query` 순서로 수행한다.

URL Scope가 만료·회수됐으면 다른 Scope로 조용히 넓히지 않는다. 기존 URL을 유지한
`범위를 사용할 수 없음` 상태에서 허용 범위 선택 또는 재요청을 제공한다.

## 11. 접근·만료·오류 상태

| 조건                            | 필수 UX                                                              |
| ------------------------------- | -------------------------------------------------------------------- |
| Work App 조건 없음              | Work 또는 `requiresProductEntitlement=true` Route의 App Access State |
| Surface Capability 없음         | Product Shell 안 권한 없음, 필요 책임과 안전한 복귀                  |
| Assignment·Support Session 만료 | Query·Mutation 중단, Cache 제거, 만료 시각·재요청·복귀               |
| Scope 만료·회수                 | 자동 확대 금지, 기존 Scope 유지 상태에서 전환·재요청                 |
| 상위 정책 잠금                  | Read-only Control, 정책·원천·Scope·발효일·예외 요청                  |
| Support Read-only               | 지속 Banner, Write Control은 이유가 있는 Disabled 또는 비노출        |
| 비인가성 부분 API 실패          | 같은 Decision Revision의 성공 Section 유지, 실패 Section만 재시도    |
| Unknown Path                    | 현재 Surface 안 404                                                  |

만료 5분 전 한 번만 Polite Announcement하고 Header에 남은 시간을 표시한다. 만료 시 한 번만
알리고 Live Region을 매초 갱신하지 않는다. 만료 후 이전 Management 데이터가 화면에 남아서는
안 된다.

401/403, Decision Revision 변경, Scope/Auth Resolver 장애에서는 부분 성공도 유지하지 않는다.
처리 순서는 `in-flight 취소 → Content Clear → accessSensitive Cache 제거 → 마지막 Route 편의값
삭제 → Surface Context 재조회`다. 같은 Tenant·Actor·Access Mode의 다른 Tab에는
`BroadcastChannel` 또는 동등 계약으로 Invalidation을 전파한다. Countdown은 서버
`generatedAt`으로 계산한 Clock Offset을 사용하며 서버가 최종 만료 권위다.

### 11.1 HTTP 의미

| HTTP | 의미                                                                                    |
| ---: | --------------------------------------------------------------------------------------- |
|  401 | 인증 Identity가 없거나 유효하지 않음                                                    |
|  403 | App·Surface Capability, Opaque Scope Context, 활성화, Step-up, SoD 또는 지원 Scope 부족 |
|  404 | 실제 Resource가 없거나 다른 Tenant·허용 Scope 밖 Target을 같은 공개 Code로 은닉         |
|  409 | Decision Revision·Object Version 충돌 또는 상위 정책 잠금                               |
|  503 | Auth·Scope Resolver가 판단할 수 없어 Fail Closed                                        |

Frontend는 HTTP와 안정된 Reason Code를 함께 사용해 `SurfaceAccessState`를 결정한다. Scope 밖
Object와 실제 미존재 Object는 모두 공개 Code `RESOURCE_NOT_AVAILABLE`을 사용하고 내부 Audit만
원인을 구분한다. 현재 Actor에게 이전에 발급된 Scope의 만료는 403
`SCOPE_CONTEXT_EXPIRED`, 다른 Tenant·Actor 또는 알 수 없는 Scope Key는 404
`RESOURCE_NOT_AVAILABLE`이다. `503`에서 이전 Cached Allow로 Mutation을 계속하지 않는다.

## 12. Pilot과 Migration 결정

공식 대표 Pilot은 **Approvals + HCM**이다. Approvals가 업무/관리 이분 모델을, HCM이
개인·팀·운영·관리 다중 Surface와 Target Population을 검증한다. 두 제품을 동시에 시작하지
않고 다음 순서를 따른다.

1. `W0` 공통 Manifest, Resolver, Guard, Shell, Context API와 Telemetry 계약
2. `W0.5` Communications·Services Technical Canary
3. `W1a` Approvals 대표 Pilot
4. `W1b` HCM 대표 Pilot
5. `W2` DWAI·ON, Notifications, Spaces
6. `W3` Calendar, Workplace/Rooms, Mail, Messaging, Meetings

기존 Canonical Product Admin Path와 Query/Hash Deep Link는 유지한다. 중앙의 기존 Product
Admin Alias 14개도 대상 Product Management Path로 계속 Redirect한다. HCM은 기존
`/hr/operations/**`, `/hr/design/**`, `/hr/data/**`를 Manifest Matcher로 분리해 대규모 URL
Migration을 피하고 `/hr/manage`는 첫 허용 관리 Route를 찾는 Index로만 추가한다.

Notifications는 물리 배포 Manifest에서 `platformFeature`로 남아 있어도 Runtime 관점에서는
`APP.NOTIFICATIONS`, 독립 Product Shell과 Surface Manifest를 가진 **논리 Product**로 고정한다.
Surface 소유권과 독립 배포 여부를 결합하지 않으며 W2에서 `architecture/frontend-apps.json`에
논리 Product·Route Ownership을 명시한다.

Legacy `/rooms`는 `/workplace/home`으로 이동한다. `/rooms/<suffix>`는 동일한 Canonical
`/workplace/<suffix>` Route가 Manifest에 존재할 때만 Query·Hash를 보존해 한 번 Redirect한다.
대상이 없으면 Home으로 조용히 버리지 않고 Workplace Surface 안 404를 표시한다. HCM은 현재
Registry에 명시된 11개 `/people/**`, `/workforce/**` Source만 한 번 Redirect하고, 미등록
Subpath는 자기 자신으로 Redirect하지 않으며 HCM Surface 안 404로 끝낸다.

Rollout Control은 Shadow `S`, 제품별 Capability Enforcement `E_p`, 제품별 Native UI `U_p`의
세 축으로 분리한다. Flag와 합성 범위는 다음으로 고정한다.

| 축    | Canonical Flag                                                | 범위             | 신규 상태 합성                         |
| ----- | ------------------------------------------------------------- | ---------------- | -------------------------------------- |
| `S`   | `access.product-surfaces.context-shadow.v1`                   | Tenant-global    | 모든 제품이 같은 bit·revision을 사용   |
| `E_p` | `access.product-surfaces.capability-enforcement.<product>.v1` | Tenant + Product | 해당 제품의 Exact 인가 전환에만 사용   |
| `U_p` | `ux.product-surfaces.<product>.v1`                            | Tenant + Product | 해당 제품의 Native Surface UI에만 사용 |

`<product>`는 Checksummed Rollout Inventory의
`approvals`, `calendar`, `communications`, `dwaion`, `hcm`, `mail`, `meetings`, `messaging`,
`notifications`, `services`, `spaces`, `workplace` 중 하나다. 기존 전역
`access.product-surfaces.capability-enforcement.v1`은 전환 이력·호환 증거용 Legacy Flag로
등록 상태를 유지하지만, 신규 상태·Context Envelope·인가 결정을 합성하는 `E_p`로 사용하지 않는다.
Legacy 전역 E가 true여도 어느 제품의 `E_p`를 충족하거나 승격시키지 못한다. Context Envelope가
제품 간 동등성을 요구하는 축은 `S`뿐이며 `E_p`와 `U_p`는 제품마다 달라도 정상이다.

업무·관리 메뉴의 시각적 분리와 Work Header의 단일 `앱 관리` 진입점은 Flag와 무관한 공통 Shell
불변식이다. `U_p=0`인 Compatibility-separated Shell은 이 정보 구조를 유지하면서 `E_p=0`이면
기존 권한 가드를, `E_p=1`이면 Sibling Guard, 신규 Effective Context와 서버 PEP를 사용한다. 어떤
Rollback도 혼합 Sidebar, 기존 APP Parent Guard 또는 전역 `MANAGE` Fallback으로 돌아가지 않는다.

각 제품 `p`의 상태는 `(S,E_p,U_p)`로 독립 계산한다.

|  상태 | `S` | `E_p` | `U_p` | 허용 상태                                 |
| ----: | --: | ----: | ----: | ----------------------------------------- |
| `000` |   0 |     0 |     0 | 기존 인가 + Compatibility-separated Shell |
| `100` |   1 |     0 |     0 | Shadow + Compatibility-separated Shell    |
| `110` |   1 |     1 |     0 | 신규 인가 + Compatibility-separated Shell |
| `111` |   1 |     1 |     1 | 신규 인가 + Native Surface UI             |

`E_p ⇒ S`, `U_p ⇒ E_p`를 위반하는 조합은 Invalid로 거부한다. Local 전용 검증 Seed는 `S=1`로
고정하고 v3에 Exact PAGE 계약이 있는 `approvals`, `communications`, `hcm`, `services`만
`E_p=1,U_p=1`, 즉 `111`로 만든다. Meetings를 포함한 나머지 W2/W3 DRAFT 8개 제품은
`E_p=0,U_p=0`, 즉 `100`으로 유지한다. 불변 `product-surfaces` v3를 변경해 이 8개 제품을
억지로 포함하지 않는다.
승인 Bundle에 없는 제품이 `110` 또는 `111`로 평가되면 Gateway는 503
`AUTHORITY_RESOLUTION_UNAVAILABLE`로 Fail Closed한다.

Gateway는 짧은 Evaluation Cache와 별개인 Durable Safety Latch v2를
`tenant + product`로 유지한다. 논리 Key는
`dwp:gateway:product-surface:se-latch:v2:<tenant>:<product>`이며 `schema=2`, `productKey`,
마지막 승인 `S/E_p` bit와 각 Opaque Revision을 TTL 없이 저장한다. Provider가 두 축을 모두
권위 있게 반환할 때만 원자 승인하고, 낮은 Revision은 저장된 Snapshot을 유지하며 같은 Revision의
다른 bit는 Conflict로 Fail Closed한다.

- Provider 장애에서 v2 Snapshot이 있으면 마지막 승인 `S/E_p`를 복원하고 `U_p=0`으로 계산한다.
  따라서 `111→110`은 허용하지만 `110→100/000` 자동 강등은 금지한다.
- 새 Tenant·Product에 v2와 Legacy v1 Latch가 모두 없으면 안전한 초기 상태 `000`으로 계산한다.
- v2가 없는데 Tenant 전역 Legacy v1 Latch가 있으면 제품 귀속을 추정하지 않고
  `MIGRATION_REQUIRED`로 503 처리한다.
- Redis Cluster Cross-slot을 피하기 위해 v2 Product Key와 Legacy Tenant Key를 하나의 다중-key
  Lua로 읽지 않는다. `v2 LOAD → MISSING이면 Legacy 단일-key probe → v2 재조회` 순서로 Migration
  Race를 닫는다. 두 번째 v2의 `FOUND/CORRUPT/UNAVAILABLE`가 Legacy 결과보다 우선하고, v2가 두 번
  모두 `MISSING`일 때만 Legacy의 `MISSING/MIGRATION_REQUIRED`를 채택한다.
- v2 Corrupt·Unavailable, Invalid 조합 또는 Revision Conflict는 Cached Allow나 Legacy Policy로
  우회하지 않고 503으로 Fail Closed한다.

운영자가 인가 회귀를 승인해 `E_p=false`인 더 높은 Revision을 발행하는 것은 장애 Fallback과
구분되는 명시적 제품별 Rollback이다. `S=1`이면 상태는 `110→100`이고, Assignment·Audit와 불변
Authorization Bundle은 삭제하지 않는다. `S` 자체를 끄는 Tenant-wide 변경은 별도 승인된 더 높은
Revision이어야 한다. Production Migration의 1+11+11 Flag 기본값은 모두 Off이며, 앞의 Local Seed는
Production 활성화 증거가 아니다. 실제 Production Flag, Active Pointer와 운영 Assignment는 외부
Product·Security·Privacy 승인 전 변경하지 않는다.

### 12.1 Authorization Migration 불변식

- UI Route·Shell 이동 자체는 Role, Permission, Responsibility, Resource Set과 유효기간을
  추가·회수하지 않는다.
- 변경되지 않은 Assignment와 지원되는 Capability에 대해 신규 `EffectiveAllow`가 기존보다
  넓어지면 Blocker다.
- 의도적인 권한 축소는 영향 사용자·Role·Route·API 목록과 Product·Security Owner 승인을
  가진다.
- Shadow Evaluation으로 기존과 신규 Route·API 결정을 비교한 뒤 Canary에서 Enforcement한다.
- UI Rollback은 Navigation·Layout Projection만 되돌린다. 인가 회귀는 Assignment와 Audit를
  삭제하지 않고 직전 승인된 Versioned Capability Policy로 원자적으로 되돌린다.
- 제품별 `S × E_p × U_p`의 지원 Flag 조합별 Route·API Truth
  Table과 Rollback Rehearsal을 Canary Gate에서 통과한다.

## 13. 기각한 대안

| 대안                                | 기각 이유                                                       |
| ----------------------------------- | --------------------------------------------------------------- |
| 작은 제목으로 한 Sidebar 유지       | 권한이 많을수록 업무·관리 메뉴가 계속 누적되고 현재 문제를 유지 |
| 모든 제품 관리를 중앙 `/admin` 이동 | 앱 문맥·Preview·Deep Link와 제품 소유권이 끊기고 IA가 중복됨    |
| 별도 계정·도메인·배포               | 초기 비용과 Context 단절이 과도함. 향후 고위험 JIT에만 재검토   |
| Query 또는 Local Toggle로 Mode 전환 | 새로고침·공유·Back·감사·접근 실패 의미가 불명확                 |
| UI Menu Hide만으로 권한 통제        | 직접 URL·API·Scope 우회 방지 불가                               |
| Tenant Admin의 전 제품 자동 접근    | 최소 권한, SoD와 기존 독립 권한면 ADR에 위배                    |

## 14. 운영 활성화 및 다음 Wave 필수 Gate

다음이 승인되기 전 DRAFT 구현을 Production에서 활성화하거나 다음 Product Wave를 시작하지 않는다.

1. 본 ADR과 현재 193개 전체 메뉴 분류표 승인 — 완료
2. `EffectiveProductSurfaceContext`·Direct Evaluation OpenAPI, 오류 Reason Code와 Invalidation 계약 승인
3. Product Manifest, Governed Menu Ownership, Registered Route·Legacy Redirect Registry 정적 검사 승인
4. APP Entitlement와 Management Guard 독립 Truth Table 승인
5. HCM Organization Design 등 Granular Management Capability와 Target Population 승인
6. Scoped JIT의 End-to-end Fail-closed 검증 또는 Pilot 범위에서 명시적 비활성화
7. 감사 이벤트와 분리된 UX Telemetry 수집 계약·보존·개인정보 승인
8. Approvals/HCM Pilot 설계와 Persona×Route×Scope 수용 기준 승인 — 완료

ADR과 Pilot 설계 승인은 완료되었고 정적 계약·Unit·Chromium·Mobile Playwright 검증은 Frontend
필수 Quality Gate로 고정한다. Production 활성화는 별도 운영 승인 전까지 Off 상태를 유지한다.

Gate 2~7과 아래 Decision Register의 운영 승인 증거는
`docs/06-delivery/release-evidence/product-surface-production-readiness.json`을 단일 기계 판독
Manifest로 사용한다. 승인 Owner·승인일, 불변 Evidence checksum, 승인 OpenAPI, Rollback
Rehearsal, Test Run, Privacy와 Accessibility·Manual AT 증거 중 각 항목이 요구하는 종류가 모두
존재해야만 `COMPLETE`가 될 수 있다. 미승인 항목은 `PENDING_INTERNAL` 또는
`BLOCKED_EXTERNAL`로 유지하고 현재 Off/Compatibility/Fail-closed 통제를 함께 기록한다.

일반 개발과 Architecture Gate는 Manifest의 Schema·ID·상태 불변식만 검사하며 DRAFT 제품 때문에
실패하지 않는다. 실제 Production 활성화 판단은 별도
`yarn product-surfaces:readiness:release`가 수행하고, 하나라도 Release-required Evidence가
미완료이면 종료 코드 2로 실패한다. 문서의 `완료` 표기나 Local Seed는 이 Manifest의 승인 증거를
대신할 수 없다.

### 14.1 승인 Decision Register

| ID      | 본 문서의 제안 기본값                                                     | 승인 Owner            |
| ------- | ------------------------------------------------------------------------- | --------------------- |
| `PS-01` | 기존에 명시 Seed된 Tenant Admin Product `VIEW`만 Read-only Oversight 유지 | Security·Product      |
| `PS-02` | R1 JIT Off, 재활성화 시 `TENANT`부터 승인하고 다른 Scope는 Fail Closed    | Identity & Access     |
| `PS-03` | HCM Org Design·Controlled Export에 전용 Exact Capability 추가             | HCM·Security          |
| `PS-04` | Campaign은 `/admin`, Named Reviewer Decision은 Assigned Work로 분리       | Identity·Work         |
| `PS-05` | UX Analytics는 Audit과 Store·Schema·Retention·Access를 분리               | Privacy·Data·Platform |
| `PS-06` | Surface·Grant·Scope 결속 DTO와 Support/NORMAL Exclusive Mode              | Security·Platform     |
| `PS-07` | 위임형 관리는 Responsibility AND Capability, 입증된 기존 Scope만 Backfill | Identity·Product      |
| `PS-08` | Work 우선, Management-only 차선의 공통 Product Root Resolver              | Product·UX            |
| `PS-09` | Composite Decision Revision 전파·Trusted Context·다중 Tab Cache 제거 계약 | Security·Platform     |
| `PS-10` | v2 Exact Action과 Legacy `MANAGE` Compatibility Delta                     | Security·각 Product   |
| `PS-11` | Scope-bound SoD와 Step-up Freshness Policy 값                             | Security·Risk Owner   |

각 항목은 방향 선택이 남았다는 뜻이 아니라 Owner가 위 제안 기본값을 승인하는 Gate다. 반려 시에는
해당 항목의 대안과 전체 Menu·Guard·API·수용 기준 영향까지 이 ADR 변경으로 다시 검토한다.

## 15. 공통 수용 기준

- Work Sidebar의 Management 메뉴 수 `0`, Management Sidebar의 개인 Work 메뉴 수 `0`
- 등록 Menu Route 193개가 정확히 한 Plane·Task·Navigation Context를 가짐
- 12개 업무 앱 Menu Route 146개가 정확히 한 Product Surface를 가짐
- Work-only, Management-only, Both, Tenant Admin without product duty가 기대대로 분리됨
- Direct URL, Refresh, Back/Forward, 새 Tab이 동일 Surface와 Scope를 유지함
- Desktop과 Mobile 모두 Work Header의 Settings Icon이 포함된 단일 `앱 관리` 진입점으로 관리 모드에 전환하고,
  Management에서는 현재 관리 문맥과 업무 복귀만 노출함
- Mobile 관리 직접 링크에서도 관리 모드, 관리 전용 Navigation, 업무 복귀를 즉시 표시하고 Work
  메뉴와 혼합하지 않음
- `업무로 돌아가기`는 동일 Tenant·Actor·Product의 최신 Revision에서 허용된 마지막 Work
  `routeId`만 복원하고, 만료·Revision 변경·권한 회수 시 대표 Work Route로 안전하게 종료함
- `앱 관리`는 이전 Management 위치가 저장돼 있어도 대표 Management Landing으로 이동하며,
  자동 복원·Filter·Scope 복원이 `0건`임
- 별도 `관리 이어하기`가 도입되기 전에는 Management 마지막 위치 저장·읽기가 `0건`이고, 도입
  이후에는 명시적 사용자 Action마다 Exact PAGE·Revision·Expiry 재검증 실패 E2E가 존재함
- 권한·Scope 만료와 회수가 재로그인 없이 다음 Query·Mutation부터 반영됨
- Scope Escape, 권한 밖 Mutation, 만료 후 민감 Data 잔류 `0건`
- Support Read-only가 Management Write를 열지 않음
- 1440, 1280, 390, 320px, 200% Zoom, Keyboard, Screen Reader, High Contrast 통과
- 사용자가 5초 안에 현재 Surface와 Scope를 95% 이상 정확히 식별함
- 관리 핵심 작업 발견 시간 20% 이상 개선, 기존 구성원 핵심 작업 Median 회귀 10% 이하

### 15.1 Global-top Production Exit Criteria

다음 항목은 권고 목록이 아니라 Production Readiness Manifest가 전부 `COMPLETE`로 증명해야 하는
Release 계약이다.

1. 12개 제품 각각의 Exact `PAGE | DATA | ACTION` 계약, Gateway Binding과 소유 Service PEP가
   양방향으로 닫히고 DRAFT Route 또는 전역 `MANAGE` Compatibility를 신규 인가에 사용하지 않는다.
2. 브라우저가 만든 내부 Header를 제거하고 Gateway만 Trusted Context를 발급한다. Production
   Network Policy·Private Ingress·Workload Identity 또는 동등한 Source Attestation과
   Direct-service 우회·Replay 음성 테스트로 Confused Deputy 방지를 증명한다.
3. Tenant·Actor·Access Mode·Product·Surface·Scope·Target Population을 요청마다 결속하고,
   Cross-tenant IDOR/BOLA, Scope Escape, NORMAL·SUPPORT 권한 합집합과 만료 Revision Mutation이
   `0건`임을 자동 음성 매트릭스로 증명한다.
4. 권한 회수 후 다음 API·Mutation은 즉시 거부되고, 다중 Tab·BroadcastChannel 미지원·Tenant 및
   Access Mode 전환을 포함해 민감 UI와 Cache 제거 지연의 승인 SLO를 충족한다.
5. `frontend-apps.json`의 모든 Application·Route Prefix·Alias에 대해 실제 Production Nginx에서
   Direct URL, Refresh, Query·Hash, Back/Forward, Asset Base, Unknown Route를 전수 검증하고 Reload
   Loop와 Artifact 소유 충돌이 `0건`이다.
6. Security Audit과 UX Telemetry의 Store·Schema·Retention·Access를 분리하고, 수집 동의·철회,
   Tenant Privacy Policy와 보존·삭제 증거를 Privacy Owner가 승인한다.
7. Pilot Persona×Route×Scope, 320·390·1280·1440px, 200% Zoom, Keyboard, Screen Reader, High
   Contrast와 사용자 인지·작업시간 기준을 승인된 Browser·OS·AT Matrix 및 Manual Run으로 증명한다.
8. Authority·Redis·Cache·Event 장애의 Fail-closed Chaos Test, Rollback Rehearsal과 외부 침투
   테스트에서 Tenant Escape, IDOR/BOLA, Confused Deputy Critical·High가 `0건`이다.

## 16. 결과와 변경 통제

장점은 역할이 많은 사용자의 인지 부하를 줄이고, 독립 권한면을 URL·Shell·Guard에 반영하며,
제품별 배포 소유권과 중앙 거버넌스를 함께 유지한다는 점이다. 비용은 Manifest, Context API,
별도 Shell, Telemetry와 모든 제품 Navigation Migration이 필요하다는 점이다.

승인 후 Plane, Surface 의미, Route 권위, 중앙/제품 소유 경계 또는 권한 합성 규칙을 바꾸려면
이 ADR, 전체 메뉴 분류표, OpenAPI, Pilot 수용 기준과 Rollback 영향을 같은 변경에서 갱신한다.

## 17. 근거

- [Microsoft 365 Admin Center](https://learn.microsoft.com/en-us/microsoft-365/admin/admin-overview/admin-center-overview?view=o365-worldwide)
- [Microsoft Entra Administrative Units](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/administrative-units)
- [Atlassian Admin 역할](https://support.atlassian.com/user-management/docs/what-are-the-different-types-of-admin-roles/)
- [Google Workspace Custom Admin Roles](https://support.google.com/a/answer/2406043?hl=en)
- [Google Workspace OU 범위 관리자](https://support.google.com/a/answer/9807615?hl=en-na)
- [Slack Admin Dashboard](https://slack.com/help/articles/115005594006-Guide-to-the-Slack-admin-dashboard)
- [GitHub Enterprise 역할 경계](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-accounts-and-repositories/managing-roles-in-your-enterprise/abilities-of-roles)
- [Oracle HCM Quick Actions](https://docs.oracle.com/en/cloud/saas/human-resources/faucf/quick-actions.html)
- [SAP SuccessFactors Role-based Permissions](https://help.sap.com/docs/successfactors-platform/using-role-based-permissions/latest-role-based-permissions)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [NIST RBAC FAQ](https://csrc.nist.gov/Projects/role-based-access-control/faqs)
- [W3C Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/)
- [W3C Disclosure Navigation Example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation-hybrid/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [WCAG Reflow 이해 문서](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [WCAG Status Messages 이해 문서](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
