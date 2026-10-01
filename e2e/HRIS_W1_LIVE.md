# HRIS W1 live synthetic acceptance

This suite is an opt-in browser gate for a disposable localhost HRIS runtime. It never fulfills a
request or replays a HAR. Its request interception is a safety firewall: reads and the exact
authority-evaluation endpoint continue to the live Gateway, while external traffic and owner
mutations are aborted before transmission. A collected test and a successful `--list` command are
not live acceptance evidence.

Current handoff status (2026-10-01): **HOLD — not live-executed**. Run only after the isolated
Gateway, version-33 authorization activation, and two synthetic tenants are ready. Never use a
production URL, customer tenant, or real account.

## Preconditions

- Use the repository's supported Node 24 runtime and an installed Chromium browser.
- Start an isolated Gateway on `http://127.0.0.1:<port>` with synthetic tenant A and tenant B.
- Tenant A must expose HCM rollout `111`, all three rollout flags enabled, and authority status
  `AVAILABLE`.
- Tenant B must remain at HCM rollout `000`, all three rollout flags disabled, and authority status
  `NOT_EVALUATED`. Its synthetic account must also be seeded without legacy HCM permission; each
  canonical route must therefore follow the current legacy guard to exact redirect `/403`. `000`
  alone selects the legacy boundary and does not itself deny a route.
- Provision synthetic account credentials through the runner's secret/environment mechanism. Do
  not put credential values in this repository, shell history, reports, or the route JSON.
- Choose a new artifact path for every attempt. Its parent must already exist.

## Required environment

| Variable                                                       | Contract                                                            |
| -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `HRIS_W1_LIVE_ACK`                                             | Exact value `LOCAL_SYNTHETIC_ONLY`                                  |
| `HRIS_W1_LIVE_RUN_ID`                                          | Unique 8-64 character lowercase/digit/hyphen id                     |
| `HRIS_W1_LIVE_BASE_URL`                                        | Owned `http://127.0.0.1:<frontend-port>/` URL                       |
| `HRIS_W1_LIVE_GATEWAY_URL`                                     | Different owned `http://127.0.0.1:<gateway-port>` URL               |
| `HRIS_W1_LIVE_ARTIFACT_DIR`                                    | New absolute path whose basename is `hris-w1-live-browser-<run-id>` |
| `HRIS_W1_TENANT_A_ID`, `HRIS_W1_TENANT_B_ID`                   | Distinct positive integer tenant ids                                |
| `HRIS_W1_TENANT_A_EMAIL`, `HRIS_W1_TENANT_B_EMAIL`             | Synthetic-only address using an accepted local/test suffix          |
| `HRIS_W1_TENANT_A_PASSWORD`, `HRIS_W1_TENANT_B_PASSWORD`       | Secret-injected synthetic password; never commit or print it        |
| `HRIS_W1_TENANT_A_ROUTES_JSON`, `HRIS_W1_TENANT_B_ROUTES_JSON` | Route matrices described below                                      |
| `HRIS_W1_LIVE_ASSERTION_TIMEOUT_MS`                            | Optional integer from 10000 through 120000; default 45000           |

After injecting every required variable without printing its value, run:

```sh
yarn test:e2e:hris-w1-live
```

The config starts an owned Vite process in dedicated `hris-w1-live` mode and proxies `/api` only to
the configured localhost Gateway. Credential variables and external LiveKit, telemetry, attachment,
notification, and Dwaion runtime variables are neutralized in the Vite child process.

## Route matrix schema

Each `*_ROUTES_JSON` value is a JSON array of one to twelve objects:

```json
{
  "id": "lowercase-kebab-id",
  "module": "HRM | PER | PAY | TIM | SYS",
  "pageRouteContractKey": "route.hcm.personal.example.page",
  "path": "/hr/or/sub-route",
  "outcome": "allowed | denied | authority-unavailable | redirected",
  "marker": "required concrete selector for an allowed route",
  "expectedScopeKey": "required server scope for an allowed route",
  "accessStates": ["route-denied"],
  "redirectPath": "/required/only/for/redirected",
  "api": [
    {
      "path": "/api/exact/path",
      "method": "GET",
      "statuses": [200]
    }
  ]
}
```

- Both matrices must cover all five canonical W1 modules. The parser binds each module to its exact
  path and PAGE contract; a caller-provided module label cannot make an arbitrary path count.
- Tenant A must allow each canonical route with the exact marker and a real 2xx GET below. It also
  requires a separate allowed HIGH preview and an explicit denied route.
- Tenant B rejects allowed and HIGH cases. Each of its five canonical entries must use
  `"outcome":"redirected"` with `"redirectPath":"/403"` in the seeded legacy-denied runtime;
  additional negative cases may cover authority-unavailable behavior.
- `accessStates` is required for denied and authority-unavailable outcomes. Supported values are
  validated by the environment parser.
- `redirectPath` is required only for a redirected outcome.
- `marker`, `expectedScopeKey`, and a non-empty `api` array are mandatory for every allowed route.
  Every allowed status must be 2xx and every expectation must be observed from a real response.
  Allowed GET evidence must carry the exact `contextScopeKey` query value and a non-empty body.

| Module | Canonical path          | PAGE contract                      | Required marker                                                  | Required live GET                 |
| ------ | ----------------------- | ---------------------------------- | ---------------------------------------------------------------- | --------------------------------- |
| HRM    | `/hr/operations/people` | `route.hcm.operations.people.page` | `input[aria-label="Search people"]`                              | `/api/people/v1/workforce/people` |
| PER    | `/hr/talent`            | `route.hcm.personal.talent.page`   | `[data-route="/hr/talent"][data-scope="personal-goal-progress"]` | `/api/people/v1/hr/talent`        |
| PAY    | `/hr/pay`               | `route.hcm.personal.pay.page`      | `[data-testid="hris-payroll-workspace"]`                         | `/api/people/v1/hr/pay`           |
| TIM    | `/hr/time`              | `route.hcm.personal.time.page`     | `[data-testid="hris-query-state"][data-query-state="ready"]`     | `/api/people/v1/hr/time`          |
| SYS    | `/hr/home`              | `route.hcm.personal.home.page`     | `[data-testid="hcm-home-overview"]`                              | `/api/people/v1/hr/home`          |

The tenant-A HIGH case adds this object:

```json
{
  "api": [
    {
      "path": "/api/auth/product-surface-access/evaluate",
      "method": "POST",
      "statuses": [200]
    }
  ],
  "highRiskPreview": {
    "clickSelectors": [
      "<selector that opens the review>",
      "<optional selector that advances to the HIGH authority dialog>"
    ],
    "dialogSelector": "[role=dialog]",
    "dialogText": "<expected localized HIGH dialog text>",
    "allowedRequestPaths": ["/api/auth/product-surface-access/evaluate"],
    "expectedRouteContractKey": "route.hcm.operations.payroll-foundation-publish.action",
    "expectedOperation": "HCM_PAYROLL_FOUNDATION_PUBLISH"
  }
}
```

HIGH coverage is deliberately **preview-only**. The suite requires a real HTTP 200 authority
evaluation whose request has the exact PRODUCT subject and ACTION route contract, and whose response
has `STEP_UP_REQUIRED`, the same reason code, a nonblank revision, and
`urn:dwp:assurance:high`. `expectedOperation` is verified against the repository's canonical HIGH
catalog; operation is intentionally not a field in the Gateway evaluation wire body. Operations
that share the same product/surface/route tuple are rejected at config load because the live wire
cannot distinguish them. Only after those checks can the dialog count as evidence. The firewall
permits only exact PAGE/ACTION authority tuples and no other same-origin non-read request;
step-up challenge issuance and payroll, time, performance, or other owner commands are aborted and
counted as acceptance failures. The dialog is captured and closed before any identity verification
or owner dispatch.

## Boundary and evidence contract

For each tenant, the suite performs a real `POST /api/auth/login`, verifies its own
`GET /api/auth/me`, and then repeats `/api/auth/me` with the opposite tenant id. The cross-tenant
request must fail closed with 401 or 403. Login, me, and rollout requests use zero redirects and
must return from the exact owned frontend origin/path. Login happens in a no-HAR context; its
in-memory storage state is then passed to the recorded route context.

Passing evidence includes route screenshots, the HIGH preview screenshot, a sanitized HAR, the
Playwright reports, and `synthetic-acceptance-manifest.json`. On orderly teardown, raw HAR files are
always sanitized and deleted; the exact raw path is also cleared before recording starts.
The sanitizer removes request bodies, response bodies, cookies, credential-bearing headers, and
all query values, then checks that the synthetic email/password and collected session values do
not remain.

The manifest can report `PASS` only after both browser contexts have closed and the global boundary
shows zero owner/mismatched-authority mutation attempts, zero external HTTP/WebSocket attempts,
zero unexpected evaluations, and zero forwarded owner mutations. This catches requests that occur
between route-level checks or during teardown.

Crash limit: although the password is never sent in the recorded context, an ungraceful process or
host termination can occur before sanitization and leave a raw HAR containing session cookies or
headers inside the mode-0700 artifact directory. Treat any `*-raw.har` as sensitive, never publish
it, and remove the abandoned artifact directory through the approved evidence-cleanup procedure.

Playwright trace capture is intentionally disabled because trace archives can retain credentials
and session cookies and have no supported safe-redaction path. Do not enable trace or video for
this gate without an independently verified redaction design.
