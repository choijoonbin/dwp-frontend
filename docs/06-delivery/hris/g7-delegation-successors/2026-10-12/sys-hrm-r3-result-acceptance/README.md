# SYS-007 / HRM-010 R3 result acceptance

This directory is an append-only successor to `sys-hrm-r2`. It does not amend
the R2 promotion receipt, start tokens, packet definitions, or migration lease.
It supplies the Control-side state machine that admits the two module results,
authorizes their exact integration, and closes both tokens after one shared
Control verification batch.

No receipt is effective merely because it exists in a working tree. Every
transition has a later carrier commit. Exactly one materializer phase,
`run-shared`, runs the seven post-integration Control commands once. It invokes
their exact argv directly without a shell and is the only accepted producer of
shared evidence; the other phases only inspect or materialize receipts.

## Authority boundary

- R2 remains the authority for module branches, base pins, allowed/protected
  paths, SYS V325, and the read-only HRM V54 prerequisite.
- The predecessor is frozen at promotion carrier
  `2fc4faa5d8631dda6a3cbabefeef9ba606feca52`, tree
  `06807365ae5d289eda8ca82a6cc5071abc315037`, and promotion-receipt SHA-256
  `d09e250da60b797404109dca5342db7cb6806144b51e3f5c92cd2ebc9925d275`.
  The R3 tooling carrier must be that commit's direct child, add exactly the
  eleven files listed by the toolchain (including the pinned Control patch),
  and preserve every predecessor tree entry.
- The four module commands are copied exactly from the R2 predecessor packets
  and form a closed set.
- The predecessor specifies four shared verification categories, but not their
  argv. R3 therefore labels the command mapping
  `CONTROL_PROPOSAL_NOT_PREDECESSOR_AUTHORITY` and closes it to the seven exact
  central-repository commands below. Neither an arbitrary argv nor a generic
  `PASS` log can satisfy closure.
- The tooling carrier remains exactly eleven files. A separate Control-owned
  source carrier must be its direct child. `prepare-source` applies the pinned
  `control-prerequisites.patch` to its exact six modified paths and adds only
  `e2e/hris-sys-hrm-responsive-accessibility.spec.ts`, whose deterministic
  template bytes are embedded independently in both tools. Both tools compare
  the carrier's complete six-path diff byte-for-byte with the committed patch,
  enforce the exact one-added/six-modified closed set, and pin that structure
  as `exactControlPrerequisites`. The source carrier is validated while it is
  clean, current, and exactly pushed; later phases pin its blobs, tree, parent,
  and pushed ancestry.
- `MOD-PER-COMPPLAN` is marked only as
  `CONTROL_PROPOSAL_READY_FOR_PACKET_PREPARATION`. No packet, start token,
  migration lease, source-change authority, or PAY readiness is issued here.

## Fresh-run sequence

Use a new lower-case run id and paths below
`.../sys-hrm-r3-result-acceptance/runs/<run-id>/`. Never reuse a run id.
The validator searches all locally reachable refs with full path history; a
previously added and deleted run directory, or the same id on an unrelated
reachable branch, is a hard failure. The three receipt filenames are reserved
and cannot be used by input evidence, plans, or output logs.

1. Apply the deterministic six-path Control prerequisite patch and generate
   the deterministic Control-owned Playwright source from the exact
   clean/pushed tooling carrier. Commit exactly the six modified paths plus
   that one added spec, push them, then validate the source carrier while it is
   the clean current upstream head.

   ```text
   python3 materialize_g7_sys_hrm_result_acceptance.py prepare-source \
     --tooling-carrier <tooling-carrier-commit>
   git add apps/dwp/src/routes/product-route-contract-source.test.ts \
     apps/dwp/src/routes/product-route-contract-source.ts \
     apps/dwp/src/routes/product-route-contracts.generated.test.ts \
     package.json scripts/internal-export-allowlist.json \
     scripts/production-reachability-allowlist.json \
     e2e/hris-sys-hrm-responsive-accessibility.spec.ts
   git commit && git push
   python3 validate_g7_sys_hrm_result_acceptance.py source \
     --carrier <shared-test-source-carrier-commit>
   ```

2. Control writes the sealed module-test input, four sanitized output logs, and
   a sealed shared-verification plan. Commit and push that evidence carrier.
   That single-parent carrier may add only those exact six files beneath the
   new run directory; source or unrelated documentation changes fail closed.
   Its parent must be the exact shared-test-source carrier from step 1.
3. Admit the exact four clean/pushed module branch heads. This writes only the
   result-admission receipt; `integrationMergeAuthorized` remains `false`.

   ```text
   python3 materialize_g7_sys_hrm_result_acceptance.py admit \
     --run-id <run-id> \
     --test-evidence-path <repo-relative-input-path> \
     --shared-plan-path <repo-relative-plan-path> \
     --input-carrier <evidence-carrier-commit>
   ```

4. Commit and push the admission receipt, then validate that exact carrier.
   The validator requires the carrier's sole diff to be the admission receipt
   and its first parent to be the input-evidence carrier.

   ```text
   python3 validate_g7_sys_hrm_result_acceptance.py admission \
     --run-id <run-id> --carrier <admission-carrier-commit>
   ```

5. Create the integration authorization. It pins the admission carrier, exact
   result commits/manifests, the proposed shared plan, and the clean/pushed
   backend pre-integration commit. It also repeats the exact shared-test-source
   pin. Its frontend pre-integration commit is deliberately the later
   authorization carrier, avoiding self-reference.

   ```text
   python3 materialize_g7_sys_hrm_result_acceptance.py authorize \
     --run-id <run-id> --admission-carrier <admission-carrier-commit> \
     --backend-pre-commit <exact-pushed-backend-module-base>
   ```

6. Commit and push the authorization receipt, then validate its exact carrier.
   Only a passing check makes `integrationMergeAuthorized=true` effective.
   The receipt does not and cannot name its own future carrier commit. Instead,
   it seals `AUTHORIZATION_CARRIER_COMMIT_EXACT`; the validator proves the
   supplied carrier's exact receipt blob, sole diff, pushed state, and parent,
   and only then interprets that carrier itself as the frontend integration
   base.

   ```text
   python3 validate_g7_sys_hrm_result_acceptance.py authorization \
     --run-id <run-id> --carrier <authorization-carrier-commit>
   ```

7. From that authorization carrier in frontend and the pinned backend
   pre-integration commit, cherry-pick/integrate only the four admitted result
   commits. Commit and push the exact central frontend/backend integration
   heads. The closure phase later proves their diffs equal the union of the
   admitted manifests byte-for-byte.
8. Run the canonical shared Control plan once against those two clean/pushed
   source-result heads. This command verifies authorization and exact union
   integration first, executes all seven argv in order with `shell=False`,
   checks that both heads remain clean/pushed after every command, and writes
   the sealed runner receipt plus exact stdout/stderr captures. There is no CLI
   option for substituting an executable or accepting hand-written evidence.

   ```text
   python3 materialize_g7_sys_hrm_result_acceptance.py run-shared \
     --run-id <run-id> \
     --authorization-carrier <authorization-carrier-commit> \
     --frontend-integrated <central-frontend-source-result-commit> \
     --backend-integrated <central-backend-source-result-commit>
   ```

   The runner pins each command's exact argv, timestamps, elapsed time, exit
   code, FE/BE commit+tree, stdout/stderr blobs and a chained record digest.
   Each structured result also binds exit code zero and the SHA-256 of both
   captured streams. The tools independently re-derive a command-specific
   semantic report from those committed bytes: exact authorization/OpenAPI
   markers, exact architecture marker order, a silent heap-budgeted TypeScript
   no-emit check, or a
   Vitest JSON report for the exact four requested files with every test
   passing. Generic text and synthetic `PASS` output are rejected.
   It also supplies the four exact FE/BE commit/tree pins as a closed
   subprocess environment. The Playwright journeys copy those values into
   four fixed JSON-reporter annotations; both tools derive and verify source
   provenance from the raw report instead of injecting closure expectations.
   Each record has a command-specific proof kind. The Playwright stdout must
   be a real 1.58 JSON report proving the project-major closed set of four
   execution specs (two journeys across `chromium` and `mobile`), each with
   one clean first-pass result under `--workers=1`. Commit only the
   generated evidence and streams in a single-parent frontend carrier directly
   after the frontend source-result commit, then push it. Do not rerun either
   module packet suite.
9. Create closure.

   ```text
   python3 materialize_g7_sys_hrm_result_acceptance.py close \
     --run-id <run-id> \
     --authorization-carrier <authorization-carrier-commit> \
     --frontend-integrated <central-frontend-source-result-commit> \
     --backend-integrated <central-backend-source-result-commit> \
     --shared-evidence-path <repo-relative-shared-evidence-path> \
     --shared-evidence-carrier <shared-evidence-carrier-commit>
   ```

10. Commit and push the closure receipt, then validate its exact carrier.
   Its first parent must be the shared-evidence carrier and its sole diff must
   be the closure receipt.

   ```text
   python3 validate_g7_sys_hrm_result_acceptance.py closure \
     --run-id <run-id> --carrier <closure-carrier-commit>
   ```

The materializer's `sequence` subcommand prints the same order and all expected
artifact names without modifying the repository.

## Required input invariants

The module-test input contains exactly `SYS_BACKEND_TARGETED`,
`SYS_FRONTEND_TARGETED`, `HRM_BACKEND_TARGETED`, and
`HRM_FRONTEND_TARGETED`. Every result pins the module result commit/tree, exact
argv, `exitCode: 0`, and a committed output blob by path, Git blob SHA-1,
SHA-256, and byte count. Its `executionBinding` is one of two exact contracts:

- `POST_COMMIT_EXACT_RESULT` uses `GIT_COMMIT_BOUND_EXACT_RESULT` and requires
  execution at or after the exact result commit.
- `PRE_COMMIT_FINAL_TREE` uses the explicitly Control-authored
  `CONTROL_ASSERTED_WORKTREE_TREE_EQUALS_RESULT_TREE` status. Its
  `testedTree` must equal the admitted result tree, execution must be before
  the result commit, and it must be no earlier than both the R2 token issuance
  and the pinned execution-base commit.

The latter records the safe meaning of final-working-tree tests performed
immediately before a result commit; it is an explicit Control assertion, not a
fabricated Git proof. Both modes reject a mismatched tree, pre-preparation
timestamp, post-expiry timestamp, or evidence later than its carrier.

The shared plan contains exactly these commands, in this order:

1. `corepack yarn authorization:check`
2. `python3 scripts/export-openapi-contracts.py --check --approved-snapshots`
3. `corepack yarn openapi:check`
4. `corepack yarn vitest run` with the exact generated route contract, HRIS
   shell access contract, SYS workspace, and HRM workspace test files
   followed by `--reporter=json`
5. `corepack yarn typecheck`
6. `corepack yarn architecture:check`
7. `env E2E_BASE_URL=http://127.0.0.1:4200 E2E_REUSE_EXISTING_SERVER=false
   VITE_HRIS_REFERENCE_CONFIGURATION_ENABLED=true
   VITE_HRIS_EMPLOYEE_CHANGE_ENABLED=true corepack yarn playwright test
   e2e/hris-sys-hrm-responsive-accessibility.spec.ts --project=chromium
   --project=mobile --workers=1 --reporter=json`

The tools independently require the corresponding `package.json` scripts,
dependencies, frontend test sources, backend OpenAPI exporter, and pinned
Playwright template to exist at the relevant Git revisions. The flags on the
exact Playwright argv are inherited by Playwright's configured web server, so
the spec requires both integrated workspaces to expose `data-runtime-state=ON`,
an owner-specific active marker, and an actually intercepted owner workbench
request. The R2 OFF placeholders therefore fail. Responsive 200% rendering and
serious/critical Axe checks remain mandatory on desktop Chromium and mobile.

Shared evidence is one-to-one with that seven-command list and can only be
created by `run-shared`. Every row carries a command-specific structured proof;
generic nonempty text or a manually asserted `PASS` is insufficient. The
authorization, backend OpenAPI, frontend OpenAPI, and architecture parsers
accept only their pinned scripts' closed success markers in exact order and
require empty stderr. Typecheck requires both streams empty and is bound to the
exact `typecheck: node --max-old-space-size=8192
./node_modules/typescript/bin/tsc --noEmit` package script. Architecture also
pins the 8192 MiB heap budget for the internal-export check. Vitest requires its JSON
reporter output to name exactly the four canonical files with nonzero tests,
all suites/tests passing, and no pending/todo/failure counts. Playwright 1.58
reporter files are accepted only as the exact spec basename (when
`config.rootDir` is `e2e`) or the canonical normalized spec path; suffix and
unrelated-spec matches fail closed. Its JSON must contain one root suite and
the exact project-major `(chromium SYS, chromium HRM, mobile SYS, mobile HRM)`
execution order; duplicate, missing, retried, logged, attached, or nested
results fail closed, and the Playwright process stderr must be empty. The
runner's self-test stub mode executes
real subprocesses over command-specific machine-readable fixtures, is not
exposed by the CLI, and is rejected by production closure validation.

