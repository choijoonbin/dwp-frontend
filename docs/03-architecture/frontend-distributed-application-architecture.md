# Frontend distributed application architecture

## Decision

DWP uses an application shell with independently owned product applications. Product applications align to backend bounded contexts and are composed by same-origin routes behind the enterprise ingress. They do not import another product application's implementation or call another application directly.

The shell owns authentication bootstrap, navigation, error boundaries, localization bootstrap, and product discovery. It must not own product business rules. Shared libraries contain stable platform primitives only and cannot become a cross-product data or workflow layer.

## Runtime rules

- Browser API traffic uses the same-origin `/api/**` Gateway contract.
- Product-to-product workflows are coordinated through backend APIs or versioned domain events.
- Each product application has its own build, test, release evidence, artifact, rollback, and route ownership.
- Route composition is the default because it preserves independent deployment without coupling the platform to a bundler-specific federation runtime.
- A product can use runtime federation only through an approved ADR with failure isolation, version negotiation, CSP, integrity, rollback, and observability controls.
- Authentication and tenant identity are established by the shell and Gateway. Product applications never trust client-supplied tenant identity as authorization evidence.

## Source rules

The authoritative inventory is `architecture/frontend-apps.json`. Every feature directory has exactly one product or platform owner. Sibling feature implementation imports are prohibited. Product code can depend on the design system, localization contract, generated API contracts, and narrowly scoped platform utilities.

`shared-utils` is transitional. New product API clients and business types belong to product-owned `data-access` libraries. Existing exports move behind generated contracts as each product is extracted; new cross-product exports are not accepted.

## Extraction order

1. Approvals, Calendar, Communications, and Services become independent route artifacts first.
2. HCM moves as one bounded product containing HCM, People, and Workforce capability modules.
3. Administration and Provider control planes move with stricter release and authorization gates.
4. Workspace and Account move after shell APIs are reduced to stable platform contracts.

The integrated shell remains a compatibility host only during extraction. A product is considered extracted only when its CI can build and test it from its declared project graph, deploy its artifact independently, and roll it back without rebuilding another product.

## Implemented topology

The deployment topology contains ten independently built browser applications:

| Deployment unit  | Owned routes                                          | Owned product modules                      |
| ---------------- | ----------------------------------------------------- | ------------------------------------------ |
| `platform-shell` | `/sign-in`, `/activate`, `/auth/oidc`, `/403`, `/404` | Authentication and platform error surfaces |
| `workspace`      | `/`, `/work`, `/ask`, `/activity`, `/apps`            | Workspace and work hub                     |
| `hcm`            | `/hr`, `/people`, `/workforce`                        | HCM, People, and Workforce                 |
| `approvals`      | `/approvals`                                          | Approval workflows                         |
| `calendar`       | `/calendar`                                           | Calendar                                   |
| `communications` | `/communications`                                     | Communications                             |
| `services`       | `/services`                                           | Employee services                          |
| `administration` | `/admin`                                              | Tenant administration and integrations     |
| `provider`       | `/provider`                                           | Provider control plane                     |
| `account`        | `/account`                                            | User account and preferences               |

Each unit has a dedicated Nx project, Vite entry, route graph, asset namespace, output directory,
bundle budget, cache input set, and Nginx route target. A build fails if its emitted module graph
contains a sibling product feature or page. The shared product runtime is platform infrastructure;
it provides bootstrap, authentication, theme, localization, error handling, and telemetry but does
not coordinate product business workflows.

## Build and cache invariants

- Nx cache inputs include the common runtime plus the owning route, page, and feature sources.
  A product source change therefore invalidates its artifact, while a cached success cannot hide a
  changed product implementation.
- Every independent artifact enforces entry, initial-load, request-count, and largest-async-chunk
  budgets from `scripts/product-bundle-budgets.json`.
- HCM, Administration, and Provider use view-level lazy imports so privileged or unrelated
  operational screens are not part of the initial route payload.
- `architecture:check`, `routes:check`, feature boundaries, API boundaries, type checking, unit
  tests, isolated product builds, accessibility, and performance checks are release-blocking CI
  gates.
- Node, package-manager behavior, CI actions, dependency licenses, vulnerability audit, and
  CycloneDX generation are pinned or verified as supply-chain evidence.

## Ingress and failure isolation

`deploy/nginx/dwp-product-routes.conf` is generated from the architecture manifest. HTML is served
with `no-store`; content-hashed product assets use immutable caching under
`/assets/dwp/{applicationId}/`. Route ownership can be deployed or rolled back one product at a
time without rebuilding sibling products.

Only `/api/**` and `/scim/v2/**` are proxied to the Gateway. Browser source checks reject direct
service ports, internal service routes, ad hoc Axios clients, `fetch`, WebSocket, EventSource, and
beacon transports. Cross-product workflows consequently use authenticated Gateway APIs or
versioned backend domain events rather than direct browser-to-service or app-to-app calls.

## Governance

The manifest, generated ingress configuration, OpenAPI snapshot, and CI checks are executable
architecture policy. Adding an application requires a unique route owner, independent Nx target,
product-aware cache input, isolated emitted module graph, backend ownership declaration, and bundle
budget. Runtime federation remains an exception requiring its own ADR and security review; it is
not an informal escape hatch around these controls.
