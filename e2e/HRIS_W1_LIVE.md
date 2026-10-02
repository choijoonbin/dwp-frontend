# HRIS W1 live synthetic acceptance

This suite is an opt-in browser gate for a disposable localhost HRIS runtime. It never fulfills a
request or replays a HAR. Its request interception is a safety firewall: reads and the exact
authority-evaluation endpoint continue to the live Gateway, while external traffic and owner
mutations are aborted before transmission. A collected test and a successful `--list` command are
not live acceptance evidence.

Current handoff status (2026-10-01): **HOLD — not live-executed**. Run only after the isolated
Gateway, version-33 authorization activation, and two synthetic tenants are ready. Never use a
production URL, customer tenant, or real account.

## Repository checkpoint bridge

`scripts/run-hris-w1-checkpoint.mjs` is the repository-owned executable for the backend W1
runner's external live checkpoint. The runner must invoke its absolute, non-symlink path and pin
the executable's SHA-256. The bridge accepts no command-line configuration and fails closed on
unknown `DWP_W1_*` variables.

The runner supplies one run id, its evidence directory and checkpoint-manifest path, active bundle
version/revision, seven distinct loopback service origins (`AUTH`, `PLATFORM`, `PEOPLE`, `PROVIDER`,
`PAYROLL`, `TIME`, and `GATEWAY`), and both synthetic tenant credentials. Each tenant binding
contains provider tenant/tenant/user ids; actor person, worker, assignment, and legal-employer
public ids; target person, worker, and assignment public ids; the exact target-population revision
and count; tenant key; email; and password. The exact actor legal-employer variable is
`DWP_W1_TENANT_<A|B>_ACTOR_LEGAL_EMPLOYER_PUBLIC_ID`; the bridge does not accept the deprecated
unqualified name.

Before the browser run, the bridge obtains the PAGE, browser DATA, and initial update ACTION
decisions needed to build the route matrices. After browser acceptance it independently evaluates
the update, simulate, receipt, and detail contracts while executing the owner chain. Every PAY
evaluation must preserve both the identical `contextKey` and `contextScopeKey`; matching only the
scope is insufficient. The People operations page, search, and detail contracts must likewise
preserve both values. A registered PAGE contract must return a live fail-closed decision before it
can become the browser denial case.

The bridge owns a new loopback frontend port and a new browser artifact, runs this existing
Playwright suite, and validates the complete `hris-w1-live-browser/v2` manifest before trusting it.
The browser PAY response records its raw body SHA-256 and the one expected configuration id. The
bridge then reuses the same authenticated Gateway session for PAY owner read, update, exact
idempotency replay, simulate, receipt lookup/lineage, and the author=self separation-of-duties read
model. The separation-of-duties assertion is explicitly read-model evidence: no publish command is
claimed because the live authority correctly requires a HIGH step-up challenge. The population
boundary requires an exact HTTP 200 for the runner's target person, binds the live response to the
target worker number, assignment key, and derived `policyRevision`, and records the runner-attested
target person/worker/assignment public ids. The real actor person supplies the contrasting 403/404;
invented UUIDs cannot count.

`runtime.json` is validated as a closed schema, including migration-control receipts, rollout and
Gateway authority projections, negative projection ids, PAY/TIM projections, payroll fixture, and
`payrollFoundationDatabaseObservation`. That preflight database observation is canonically
digested and bound to the same tenant, configuration, version 2, legal entity, author, command,
fixture receipt, definition, and dependency digests. The `path.browser-gateway-owner-db` assertion
then joins that DB digest to the browser response digest/configuration id and the owner update and
simulate command/result digests. After the bridge returns, the backend runner performs the
postflight database check for final version 4, SIMULATED state, last simulate command, singleton
UPDATE/SIMULATE receipts, and singleton version-3/version-4 command rows.

Each runtime tenant also carries an exact `authBindingExecution` gap record. It proves that the
official workforce-event contract was validated but honestly states that the already-provisioned
LOCAL administrator was bound through the run-bound local synthetic activation boundary rather
than claiming the official event itself executed.

The three stale/expired/revoked assertions are never synthesized by the bridge. They must already
exist in `runtime.json` at `projectionFeed.negativeObservations` with this closed schema:

```json
{
  "schemaVersion": 1,
  "observations": [
    {
      "assertionName": "negative.stale-evidence-denied",
      "source": "LIVE_GATEWAY_OWNER_REQUEST",
      "method": "GET",
      "path": "/api/payroll/v1/hris/payroll/foundation/configurations/<run-bound UUIDv5>",
      "tenantId": 1,
      "actorId": 2,
      "evidenceState": "STALE",
      "projectionId": "<dwp:<run-id>:payroll:negative:stale UUIDv5>",
      "projectionRevision": "<lowercase 64-hex revision>",
      "contextScopeKey": "hcm-scope-<40 hex>",
      "policyRevision": "rollout-<64 hex>",
      "authorizationRevision": "psr-<64 hex>",
      "databaseTransition": "BUILDING->ACTIVE->SUPERSEDED",
      "databaseStatus": "SUPERSEDED",
      "databaseValidity": "EXPIRED",
      "databaseMemberCount": 1,
      "projectionObservationSha256": "<canonical projection-record SHA-256>",
      "status": 503,
      "errorCode": "AUTHORITY_RESOLUTION_UNAVAILABLE",
      "ownerErrorMessage": "No current Payroll-owned legal-entity membership matches the authority.",
      "observedAt": "<UTC instant>",
      "responseBodySha256": "<lowercase SHA-256>",
      "observationSha256": "<SHA-256 of canonical JSON excluding this field>"
    }
  ],
  "aggregateSha256": "<SHA-256 of the ordered three-record array>"
}
```

There must be exactly three ordered observations, one for each assertion/evidence state. The bridge
derives each API target again from URL-namespace UUIDv5 name
`dwp:<run-id>:negative:<lowercase-state>` and independently derives each database projection id
from `dwp:<run-id>:payroll:negative:<lowercase-state>`. Stale uses configuration detail, expired
uses configuration versions, and revoked uses receipt detail. Each observation must be the exact
HTTP 503 / `AUTHORITY_RESOLUTION_UNAVAILABLE` caused by its matching run-bound projection and live
allowed Gateway authority. The bridge verifies the tenant-A actor, per-record canonical digest,
ordered aggregate digest, and restored positive projection state. A missing, reordered, relabelled,
or altered observation makes the checkpoint HOLD. The companion
`negativeObservationProjections` object is also closed: it contains schema version 1, lifecycle
flags, exact `STALE`/`EXPIRED`/`REVOKED` projection records, and their aggregate canonical digest.
The HTTP and DB projection fields—including projection, policy, and authorization revisions—must
be byte-for-byte equal. Expected database status/validity pairs are `SUPERSEDED/EXPIRED`,
`ACTIVE/EXPIRED`, and `REVOKED/EXPIRED`, respectively.

On success the bridge writes exactly 15 distinct assertion JSON files plus schema-version-1
`checkpoint/manifest.json`, with a SHA-256 binding for every assertion file. Provenance includes the
frontend Git HEAD and clean state, executable bytes, and closure hashes for every checkpoint helper,
the Playwright config, live spec, support modules, package metadata, Vite config, Node version, and
lockfile. The closure is read through `O_NOFOLLOW` single descriptors with metadata checked before
and after each read, then rechecked immediately after module import and at completion. TERM, INT,
normal exit, and post-suite cleanup terminate the detached Playwright process group and remove raw
HAR files; only `*.sanitized.har.json` evidence may survive.

Static verification commands for a frozen bridge change are:

```sh
node --check scripts/run-hris-w1-checkpoint.mjs
node --test scripts/run-hris-w1-checkpoint.test.mjs
yarn prettier --check scripts/run-hris-w1-checkpoint.mjs scripts/run-hris-w1-checkpoint.test.mjs e2e/HRIS_W1_LIVE.md
```

These checks do not produce live acceptance evidence. Only the backend runner's isolated full-mode
execution can change the handoff status from HOLD.

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
| `HRIS_W1_EXPECTED_PAYROLL_CONFIGURATION_ID`                    | Runner-attested PAY fixture UUID required in the browser response   |

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

Passing evidence includes route screenshots, the HIGH preview screenshot, a `.sanitized.har.json`, the
Playwright reports, and `synthetic-acceptance-manifest.json`. On orderly teardown, raw HAR files are
always sanitized and deleted; the exact raw path is also cleared before recording starts.
The sanitizer reads the raw HAR through one `O_NOFOLLOW` descriptor, checks file metadata before
and after the read, rejects hard links and files over 32 MiB, removes request bodies, response
bodies, cookies, credential-bearing headers, and all query values, then checks that the synthetic
email/password and collected session values do not remain. Every later browser-artifact read and
secret scan uses the same attested-read pattern and fails closed above 32 MiB rather than skipping
the file.

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
